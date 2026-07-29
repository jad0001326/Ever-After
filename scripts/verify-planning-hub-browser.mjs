import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import {
  getPlanningBrowserScenarios,
  resolvePlanningBrowserConfig,
} from "./lib/planning-browser-verification.mjs";

class CdpClient {
  static async connect(url) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      socket.addEventListener("open", () => resolve(new CdpClient(socket)), { once: true });
      socket.addEventListener(
        "error",
        () => reject(new Error("Could not connect to the Chrome debugging socket.")),
        { once: true },
      );
    });
  }

  constructor(socket) {
    this.listeners = new Map();
    this.nextId = 1;
    this.pending = new Map();
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result ?? {});
        return;
      }
      for (const listener of this.listeners.get(message.method) ?? []) {
        listener(message.params ?? {});
      }
    });
    socket.addEventListener("close", () => {
      for (const pending of this.pending.values()) {
        pending.reject(new Error("Chrome debugging socket closed unexpectedly."));
      }
      this.pending.clear();
    });
  }

  close() {
    this.socket.close();
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { reject, resolve });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
}

const require = createRequire(import.meta.url);
const config = resolvePlanningBrowserConfig({ exists: existsSync });
const scenarios = getPlanningBrowserScenarios();
const axeSource = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
const profileDirectory = await mkdtemp(path.join(tmpdir(), "everaft-planning-browser-"));
const debuggingPort = await reservePort();
const browser = spawn(config.browserPath, [
  "--headless=new",
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-gpu",
  "--disable-sync",
  "--hide-scrollbars",
  "--no-default-browser-check",
  "--no-first-run",
  `--remote-debugging-port=${debuggingPort}`,
  `--user-data-dir=${profileDirectory}`,
  "--window-size=1440,900",
  config.baseUrl,
], {
  stdio: ["ignore", "ignore", "pipe"],
});

let browserDiagnostics = "";
browser.stderr.setEncoding("utf8");
browser.stderr.on("data", (chunk) => {
  browserDiagnostics = `${browserDiagnostics}${chunk}`.slice(-8_000);
});

try {
  await assertLocalServer(config.baseUrl);
  const page = await waitForDebuggablePage(debuggingPort);
  const client = await CdpClient.connect(page.webSocketDebuggerUrl);
  const runtimeErrors = [];
  let activeScenario = null;

  client.on("Runtime.exceptionThrown", (params) => {
    runtimeErrors.push({
      scenario: activeScenario,
      text: params.exceptionDetails?.text ?? "Uncaught browser exception",
    });
  });
  client.on("Log.entryAdded", (params) => {
    if (params.entry?.level === "error") {
      runtimeErrors.push({
        scenario: activeScenario,
        text: params.entry.text,
      });
    }
  });

  await client.send("Runtime.enable");
  await client.send("Log.enable");
  await client.send("Page.navigate", {
    url: new URL("/planning-hub", config.baseUrl).href,
  });
  await waitForDocument(client);
  await evaluate(
    client,
    `localStorage.setItem("everaft-cookie-preference-v2", "essential")`,
  );

  for (const scenario of scenarios) {
    activeScenario = scenario.name;
    runtimeErrors.length = 0;
    await client.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: scenario.viewport.height,
      mobile: scenario.viewport.width < 600,
      width: scenario.viewport.width,
    });
    await client.send("Page.navigate", {
      url: new URL(scenario.path, config.baseUrl).href,
    });
    await waitForDocument(client, scenario.expectedText);

    const pageState = await evaluate(client, `JSON.stringify({
      bodyText: document.body?.innerText ?? "",
      bodyWidth: document.body?.scrollWidth ?? 0,
      documentHeight: document.documentElement.scrollHeight,
      documentWidth: document.documentElement.scrollWidth,
      hasDevelopmentOverlay: Boolean(document.querySelector("nextjs-portal")),
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth
    })`);
    const state = JSON.parse(pageState);

    assert.equal(
      state.hasDevelopmentOverlay,
      false,
      `${scenario.name} is using a development server. Run the verifier against an optimized "next start" server.`,
    );
    assert.equal(
      state.innerWidth,
      scenario.viewport.width,
      `${scenario.name} rendered at ${state.innerWidth}px instead of ${scenario.viewport.width}px.`,
    );
    assert(
      state.documentWidth <= state.innerWidth,
      `${scenario.name} overflows horizontally: document ${state.documentWidth}px, viewport ${state.innerWidth}px.`,
    );
    assert(
      state.bodyWidth <= state.innerWidth,
      `${scenario.name} body overflows horizontally: body ${state.bodyWidth}px, viewport ${state.innerWidth}px.`,
    );
    assert(
      !state.bodyText.includes("Application error"),
      `${scenario.name} rendered an application error.`,
    );
    for (const expected of scenario.expectedText) {
      assert(
        state.bodyText.includes(expected),
        `${scenario.name} did not render expected text: ${expected}`,
      );
    }

    await evaluate(client, axeSource);
    const axePayload = await evaluate(
      client,
      `axe.run(document).then((results) => JSON.stringify({
        incomplete: results.incomplete.map((item) => ({
          id: item.id,
          nodes: item.nodes.length
        })),
        passes: results.passes.length,
        violations: results.violations.map((item) => ({
          id: item.id,
          impact: item.impact,
          nodes: item.nodes.length
        }))
      }))`,
      true,
    );
    const axe = JSON.parse(axePayload);

    assert.deepEqual(
      axe.violations,
      [],
      `${scenario.name} has axe violations: ${JSON.stringify(axe.violations)}`,
    );
    assert.deepEqual(
      axe.incomplete,
      [],
      `${scenario.name} has indeterminate axe checks: ${JSON.stringify(axe.incomplete)}`,
    );
    assert.deepEqual(
      runtimeErrors,
      [],
      `${scenario.name} emitted browser errors: ${JSON.stringify(runtimeErrors)}`,
    );

    console.log(
      `${scenario.name}: ${state.innerWidth}x${state.innerHeight}, document ${state.documentWidth}px wide, axe ${axe.passes} passes.`,
    );
  }

  client.close();
  console.log(
    `Planning Hub browser verification passed ${scenarios.length} optimized local scenarios with no overflow, browser errors or axe findings.`,
  );
} catch (error) {
  if (browserDiagnostics.trim()) {
    console.error(browserDiagnostics.trim());
  }
  throw error;
} finally {
  if (browser.exitCode === null && !browser.killed) browser.kill();
  if (browser.exitCode === null) {
    await Promise.race([
      once(browser, "exit"),
      delay(3_000),
    ]);
  }
  await removeOwnedProfileDirectory(profileDirectory);
}

async function assertLocalServer(baseUrl) {
  let response;
  try {
    response = await fetch(new URL("/planning-hub", baseUrl), {
      redirect: "manual",
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new Error(
      `Planning Hub is not reachable at ${baseUrl}. Start an optimized local server before running browser verification.`,
    );
  }
  assert(
    response.status >= 200 && response.status < 400,
    `Planning Hub returned HTTP ${response.status} at ${baseUrl}.`,
  );
}

async function reservePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => {
        if (error) reject(error);
        else if (port === null) reject(new Error("Could not reserve a browser debugging port."));
        else resolve(port);
      });
    });
  });
}

async function waitForDebuggablePage(port) {
  const endpoint = `http://127.0.0.1:${port}/json`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const pages = await fetch(endpoint, {
        signal: AbortSignal.timeout(1_000),
      }).then((response) => response.json());
      const page = pages.find((candidate) => candidate.type === "page");
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      // Chrome has not opened the debugging endpoint yet.
    }
    await delay(250);
  }
  throw new Error("Chrome did not expose a debuggable page within 20 seconds.");
}

async function waitForDocument(client, expectedText = []) {
  let lastState = { readyState: "unknown", text: "" };
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const payload = await evaluate(client, `JSON.stringify({
      readyState: document.readyState,
      text: document.body?.innerText ?? ""
    })`);
    const state = JSON.parse(payload);
    lastState = state;
    if (
      state.readyState === "complete"
      && expectedText.every((expected) => state.text.includes(expected))
    ) {
      await delay(250);
      return;
    }
    await delay(250);
  }
  const missing = expectedText.filter((expected) => !lastState.text.includes(expected));
  throw new Error(
    `The Planning Hub page did not finish rendering within 20 seconds.`
    + ` Ready state: ${lastState.readyState}.`
    + `${missing.length ? ` Missing: ${missing.join(" | ")}` : ""}`,
  );
}

async function evaluate(client, expression, awaitPromise = false) {
  const result = await client.send("Runtime.evaluate", {
    awaitPromise,
    expression,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description
      ?? result.exceptionDetails.text
      ?? "Browser evaluation failed.",
    );
  }
  return result.result?.value;
}

async function removeOwnedProfileDirectory(directory) {
  const resolvedDirectory = path.resolve(directory);
  const resolvedTemp = path.resolve(tmpdir());
  assert(
    resolvedDirectory.startsWith(`${resolvedTemp}${path.sep}`)
      && path.basename(resolvedDirectory).startsWith("everaft-planning-browser-"),
    `Refusing to remove an unexpected browser profile directory: ${resolvedDirectory}`,
  );
  await rm(resolvedDirectory, {
    force: true,
    maxRetries: 3,
    recursive: true,
    retryDelay: 100,
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
