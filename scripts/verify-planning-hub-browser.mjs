import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import {
  getPlanningBrowserJourney,
  getPlanningBrowserScenarios,
  PLANNING_LAB_INTERACTION_BUDGET_MS,
  resolvePlanningBrowserConfig,
  summarizeInteractionTimings,
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
const journey = getPlanningBrowserJourney();
const journeyOnly = process.env.PLANNING_HUB_BROWSER_JOURNEY_ONLY === "1";
const scenarios = journeyOnly ? [] : getPlanningBrowserScenarios();
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
        url: params.entry.url ?? "",
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
    await evaluate(
      client,
      `localStorage.clear();
       sessionStorage.clear();
       localStorage.setItem("everaft-cookie-preference-v2", "essential")`,
    );
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
      bodyFontFamily: getComputedStyle(document.body).fontFamily,
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
    assert(
      !state.bodyFontFamily.includes("var(")
        && (state.bodyFontFamily.includes("system-ui") || state.bodyFontFamily.includes("Segoe UI")),
      `${scenario.name} did not resolve the local sans-serif stack: ${state.bodyFontFamily}`,
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

  activeScenario = "venue-to-photography-mobile";
  runtimeErrors.length = 0;
  await verifyVenueToPhotographyJourney({
    axeSource,
    baseUrl: config.baseUrl,
    client,
    journey,
    runtimeErrors,
  });
  activeScenario = "venue-screen-reader-mobile";
  runtimeErrors.length = 0;
  await verifyVenueAccessibilityTree({
    client,
    journey,
    runtimeErrors,
  });
  activeScenario = "venue-keyboard-mobile";
  runtimeErrors.length = 0;
  await verifyVenueKeyboardJourney({
    client,
    journey,
    runtimeErrors,
  });
  activeScenario = "photography-screen-reader-mobile";
  runtimeErrors.length = 0;
  await verifyPhotographyAccessibilityTree({
    client,
    journey,
    runtimeErrors,
  });
  activeScenario = "organise-payment-mobile";
  runtimeErrors.length = 0;
  await verifyOrganisePaymentJourney({
    axeSource,
    baseUrl: config.baseUrl,
    client,
    journey,
    runtimeErrors,
  });
  activeScenario = "availability-lifecycle-mobile";
  runtimeErrors.length = 0;
  await verifyAvailabilityLifecycleJourney({
    axeSource,
    baseUrl: config.baseUrl,
    client,
    journey,
    runtimeErrors,
  });

  client.close();
  console.log(journeyOnly
    ? "Planning Hub browser verification passed the mobile state, payment, availability, lifecycle, long-list, keyboard and screen-reader journeys in interaction-only mode with no overflow, browser errors or accessibility findings."
    : `Planning Hub browser verification passed ${scenarios.length} optimized local scenarios plus the mobile state, payment, availability, lifecycle, long-list, keyboard and screen-reader journeys with no overflow, browser errors or accessibility findings.`);
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

async function verifyVenueToPhotographyJourney({
  axeSource: source,
  baseUrl,
  client,
  journey: journeyConfig,
  runtimeErrors,
}) {
  await evaluate(
    client,
    `localStorage.clear();
     sessionStorage.clear();
     localStorage.setItem("everaft-cookie-preference-v2", "essential")`,
  );
  await client.send("Emulation.setDeviceMetricsOverride", {
    deviceScaleFactor: 1,
    height: journeyConfig.viewport.height,
    mobile: true,
    width: journeyConfig.viewport.width,
  });
  await client.send("Page.navigate", {
    url: new URL("/planning-hub", baseUrl).href,
  });
  await waitForDocument(client, [
    "Turn venue browsing into your wedding plan.",
    "Find your venue",
  ]);
  await waitForCondition(
    client,
    `Boolean(document.querySelector('section[aria-label="Matching wedding venues"] article'))`,
    "a live venue result",
  );

  const firstVenueName = await clickFirstVenueAction(client, "Save");
  await waitForCondition(
    client,
    `document.querySelector('aside[aria-label="Connected wedding plan"]')?.innerText.includes("Sign in to save venue favourites.")`,
    "the signed-out favourite guard",
  );
  const savePressed = await evaluate(
    client,
    `document.querySelector('section[aria-label="Matching wedding venues"] article button[aria-pressed]')?.getAttribute("aria-pressed")`,
  );
  assert.equal(
    savePressed,
    "false",
    "The signed-out favourite guard must not present the venue as saved.",
  );

  await clickFirstVenueAction(client, "Compare");
  await waitForCondition(
    client,
    `document.body.innerText.toLowerCase().includes("venue comparison")
      && document.body.innerText.includes(${JSON.stringify(firstVenueName)})`,
    "the venue comparison panel",
  );

  await clickFirstVenueAction(client, "View");
  await waitForCondition(
    client,
    `document.querySelector('#venue-detail')?.getAttribute("aria-label") === ${JSON.stringify(`${firstVenueName} details`)}`,
    "the venue detail panel",
  );
  await evaluate(
    client,
    `document.querySelector('button[aria-label="Close venue details"]')?.click()`,
  );
  await waitForCondition(
    client,
    `!document.querySelector('#venue-detail')`,
    "the venue detail panel to close",
  );

  await setLabelledControl(client, "Total wedding budget", journeyConfig.totalBudget);
  await setLabelledControl(client, "Wedding date", journeyConfig.weddingDate);
  await setLabelledControl(client, "Guest count", journeyConfig.guestCount);
  await setLabelledControl(client, "Preferred location", journeyConfig.location);
  await waitForCondition(
    client,
    `document.querySelector('aside[aria-label="Connected wedding plan"]')?.innerText.includes("£30,000")`,
    "the updated wedding budget",
  );

  const manualDetailsOpened = await evaluate(
    client,
    `(() => {
      const details = document.querySelector("details#manual-venue");
      if (!details) return false;
      if (!details.open) details.querySelector("summary")?.click();
      return details.open;
    })()`,
  );
  assert.equal(manualDetailsOpened, true, "The manual venue form did not open.");
  await setControlValue(client, 'details#manual-venue input[name="name"]', journeyConfig.manualVenueName);
  await setControlValue(client, 'details#manual-venue input[name="cost"]', journeyConfig.manualVenueCost);
  await setControlValue(client, 'details#manual-venue select[name="status"]', "booked");
  const submitted = await evaluate(
    client,
    `(() => {
      const form = document.querySelector("details#manual-venue form");
      if (!form) return false;
      form.requestSubmit();
      return true;
    })()`,
  );
  assert.equal(submitted, true, "The manual venue form was not submitted.");
  await waitForCondition(
    client,
    `document.querySelector("#current-venue-planning h3")?.textContent?.trim() === ${JSON.stringify(journeyConfig.manualVenueName)}`,
    "the manually added venue",
  );

  const choseVenue = await clickButtonWithin(
    client,
    "#current-venue-planning",
    "Choose as main venue",
  );
  assert.equal(choseVenue, true, "The manual venue could not be chosen as the main venue.");
  await waitForCondition(
    client,
    `document.querySelector("#current-venue-planning")?.innerText.includes("This is your chosen venue")
      && document.querySelector('aside[aria-label="Connected wedding plan"]')?.innerText.includes("£25,000")`,
    "the chosen venue and immediately updated remaining budget",
  );
  await addPartialVenuePayment(client, journeyConfig);
  await waitForCondition(
    client,
    `document.querySelector('aside[aria-label="Connected wedding plan"]')?.innerText.includes("Next payment deadlines")
      && document.querySelector('aside[aria-label="Connected wedding plan"]')?.innerText.includes(${JSON.stringify(journeyConfig.paymentLabel)})
      && document.querySelector('aside[aria-label="Connected wedding plan"]')?.innerText.includes("1 Jun 2027")
      && document.querySelector('aside[aria-label="Connected wedding plan"]')?.innerText.includes("£500")`,
    "the saved partial payment and venue deadline",
  );

  const nextHref = await evaluate(
    client,
    `Array.from(document.querySelectorAll("a")).find((link) =>
      link.textContent?.includes("Next: choose your photographer")
    )?.href`,
  );
  assert(nextHref, "The Photography recommendation link is missing.");
  const nextUrl = new URL(nextHref);
  assert.equal(nextUrl.pathname, "/planning-hub/photography");
  assert.equal(nextUrl.searchParams.get("context"), "plan");
  assert.equal(nextUrl.searchParams.get("remainingPence"), "2500000");
  assert.equal(nextUrl.searchParams.get("venueName"), journeyConfig.manualVenueName);
  assert.equal(nextUrl.searchParams.get("planDate"), journeyConfig.weddingDate);
  assert.equal(nextUrl.searchParams.get("planLocation"), journeyConfig.location);
  assert.equal(
    nextUrl.searchParams.has("venue"),
    false,
    "A manual venue must not be sent as a catalogue venue filter.",
  );

  const followedRecommendation = await clickLinkByText(
    client,
    "Next: choose your photographer",
  );
  assert.equal(followedRecommendation, true, "The Photography recommendation link was not followed.");
  await waitForDocument(client, journeyConfig.expectedPhotographyText);
  await assertHealthyPage({
    axeSource: source,
    client,
    expectedText: journeyConfig.expectedPhotographyText,
    name: "venue-to-photography-mobile",
    runtimeErrors,
    viewport: journeyConfig.viewport,
  });

  await client.send("Page.navigate", {
    url: new URL("/planning-hub", baseUrl).href,
  });
  await waitForDocument(client, [
    journeyConfig.manualVenueName,
    "This is your chosen venue",
  ]);
  await waitForCondition(
    client,
    `document.querySelector('aside[aria-label="Connected wedding plan"]')?.innerText.includes("£25,000")
      && document.querySelector('aside[aria-label="Connected wedding plan"]')?.innerText.includes("£500")
      && document.querySelector('aside[aria-label="Connected wedding plan"]')?.innerText.includes(${JSON.stringify(journeyConfig.paymentLabel)})`,
    "the locally restored remaining budget and partial payment",
  );

  assert.deepEqual(
    runtimeErrors,
    [],
    `venue-to-photography-mobile emitted browser errors: ${JSON.stringify(runtimeErrors)}`,
  );
  console.log(
    `venue-to-photography-mobile: guest favourite guard, compare, detail, manual booked venue, £500 partial payment, £25,000 handoff and local restore passed at ${journeyConfig.viewport.width}x${journeyConfig.viewport.height}.`,
  );
}

async function addPartialVenuePayment(client, journeyConfig) {
  const opened = await evaluate(
    client,
    `(() => {
      const details = Array.from(
        document.querySelectorAll('aside[aria-label="Connected wedding plan"] details'),
      ).find((candidate) => candidate.querySelector(":scope > summary")?.textContent?.includes("Payments"));
      if (!details) return false;
      if (!details.open) details.querySelector(":scope > summary")?.click();
      details.setAttribute("data-browser-payment-schedule", "true");
      return details.open;
    })()`,
  );
  assert.equal(opened, true, "The venue payment schedule did not open.");
  const added = await clickButtonWithin(
    client,
    'details[data-browser-payment-schedule="true"]',
    "Add payment",
  );
  assert.equal(added, true, "A venue payment row could not be added.");
  await waitForCondition(
    client,
    `Boolean(document.querySelector('details[data-browser-payment-schedule="true"] ol[aria-label="Payment schedule"] li'))`,
    "the new venue payment row",
  );
  await setLabelledControlWithin(
    client,
    'details[data-browser-payment-schedule="true"]',
    "Label",
    journeyConfig.paymentLabel,
  );
  await setLabelledControlWithin(
    client,
    'details[data-browser-payment-schedule="true"]',
    "Amount",
    journeyConfig.paymentAmount,
  );
  await setLabelledControlWithin(
    client,
    'details[data-browser-payment-schedule="true"]',
    "Paid so far",
    journeyConfig.paymentPaid,
  );
  await setLabelledControlWithin(
    client,
    'details[data-browser-payment-schedule="true"]',
    "Due date",
    journeyConfig.paymentDueDate,
  );
  const editedSchedule = JSON.parse(await evaluate(
    client,
    `(() => {
      const root = document.querySelector('details[data-browser-payment-schedule="true"]');
      return JSON.stringify({
        text: root?.innerText ?? "",
        values: Object.fromEntries(Array.from(root?.querySelectorAll("label") ?? []).map((label) => [
          label.childNodes[0]?.textContent?.trim() ?? "",
          label.querySelector("input, select, textarea")?.value ?? ""
        ]))
      });
    })()`,
  ));
  assert.equal(editedSchedule.values.Label, journeyConfig.paymentLabel);
  assert.equal(editedSchedule.values.Amount, journeyConfig.paymentAmount);
  assert.equal(editedSchedule.values["Paid so far"], journeyConfig.paymentPaid);
  assert.equal(editedSchedule.values["Due date"], journeyConfig.paymentDueDate);
  await waitForCondition(
    client,
    `document.querySelector('details[data-browser-payment-schedule="true"]')?.innerText.includes("Scheduled")
      && document.querySelector('details[data-browser-payment-schedule="true"]')?.innerText.includes("£1,000")
      && document.querySelector('details[data-browser-payment-schedule="true"]')?.innerText.includes("Paid")
      && document.querySelector('details[data-browser-payment-schedule="true"]')?.innerText.includes("£500")`,
    "the edited payment schedule totals",
  );
  const saved = await clickButtonWithin(
    client,
    'details[data-browser-payment-schedule="true"]',
    "Save payment schedule",
  );
  assert.equal(saved, true, "The venue payment schedule could not be saved.");
}

async function verifyOrganisePaymentJourney({
  axeSource: source,
  baseUrl,
  client,
  journey: journeyConfig,
  runtimeErrors,
}) {
  await client.send("Page.navigate", {
    url: new URL("/planning-hub/organise", baseUrl).href,
  });
  const expectedText = [
    "Keep every moving part in one calm place.",
    "Budget & bookings",
    "Payments & deadlines",
    journeyConfig.manualVenueName,
    journeyConfig.paymentLabel,
    "1 Jun 2027",
    "Review payment plan",
  ];
  await waitForDocument(client, expectedText);
  await assertHealthyPage({
    axeSource: source,
    client,
    expectedText,
    name: "organise-payment-mobile",
    runtimeErrors,
    viewport: journeyConfig.viewport,
  });

  const paymentHref = await evaluate(
    client,
    `Array.from(document.querySelectorAll("a"))
      .find((candidate) => candidate.textContent?.includes("Review payment plan"))
      ?.href`,
  );
  assert(paymentHref, "The Organise payment commitment has no review link.");
  const paymentUrl = new URL(paymentHref);
  assert.equal(paymentUrl.pathname, "/planning-hub");
  assert(paymentUrl.searchParams.get("planItem"), "The payment review link must identify its plan item.");
  assert.equal(paymentUrl.hash, "#current-venue-payments");

  const followedPayment = await clickLinkByText(client, "Review payment plan");
  assert.equal(followedPayment, true, "The Organise payment review link was not followed.");
  await waitForDocument(client, [
    journeyConfig.manualVenueName,
    "Next payment deadlines",
    journeyConfig.paymentLabel,
  ]);
  await waitForCondition(
    client,
    `Boolean(document.querySelector("#current-venue-payments"))
      && document.querySelector("#current-venue-planning h3")?.textContent?.trim() === ${JSON.stringify(journeyConfig.manualVenueName)}`,
    "the exact venue and its payment editor",
  );
  const returnedPaymentState = JSON.parse(await evaluate(
    client,
    `(() => {
      const details = document.querySelector("#current-venue-payments");
      const summary = details?.querySelector(":scope > summary");
      return JSON.stringify({
        activeElement: document.activeElement?.outerHTML?.slice(0, 300) ?? "",
        focused: document.activeElement === summary,
        open: details?.open ?? false,
        paymentText: details?.innerText ?? "",
        url: window.location.href,
        values: Object.fromEntries(Array.from(details?.querySelectorAll("label") ?? []).map((label) => [
          label.childNodes[0]?.textContent?.trim() ?? "",
          label.querySelector("input, select, textarea")?.value ?? ""
        ]))
      });
    })()`,
  ));
  assert.equal(returnedPaymentState.open, true, JSON.stringify(returnedPaymentState));
  assert.equal(returnedPaymentState.focused, true, JSON.stringify(returnedPaymentState));
  assert(
    returnedPaymentState.values.Label === journeyConfig.paymentLabel,
    JSON.stringify(returnedPaymentState),
  );
  assert.equal(
    returnedPaymentState.values["Paid so far"],
    journeyConfig.paymentPaid,
    JSON.stringify(returnedPaymentState),
  );
  const returnedUrl = new URL(await evaluate(client, "window.location.href"));
  assert.equal(returnedUrl.searchParams.get("planItem"), paymentUrl.searchParams.get("planItem"));
  assert.equal(returnedUrl.hash, "#current-venue-payments");
  assert.deepEqual(
    runtimeErrors,
    [],
    `organise-payment-mobile emitted browser errors: ${JSON.stringify(runtimeErrors)}`,
  );
  console.log(
    `organise-payment-mobile: the ${journeyConfig.paymentLabel} commitment returned to its exact venue payment editor, opened it and focused its summary.`,
  );
}

async function verifyAvailabilityLifecycleJourney({
  axeSource: source,
  baseUrl,
  client,
  journey: journeyConfig,
  runtimeErrors,
}) {
  const availabilityOpened = await evaluate(
    client,
    `(() => {
      const details = Array.from(
        document.querySelectorAll('aside[aria-label="Connected wedding plan"] details'),
      ).find((candidate) => candidate.querySelector(":scope > summary")?.textContent?.includes("Date availability"));
      if (!details) return false;
      details.setAttribute("data-browser-availability", "true");
      if (!details.open) details.querySelector(":scope > summary")?.click();
      return details.open;
    })()`,
  );
  assert.equal(availabilityOpened, true, "The venue availability control did not open.");
  await setControlValue(
    client,
    'details[data-browser-availability="true"] select',
    "available",
  );
  await waitForCondition(
    client,
    `document.querySelector('details[data-browser-availability="true"]')
      ?.innerText.includes("You recorded that the business is available on 12 Jun 2027.")`,
    "the explicit venue availability state",
  );

  await setLabelledControl(
    client,
    "Wedding date",
    journeyConfig.laterWeddingDate,
  );
  await waitForCondition(
    client,
    `document.querySelector('details[data-browser-availability="true"]')
      ?.innerText.includes("This was last checked for 12 Jun 2027.")
      && document.querySelector('details[data-browser-availability="true"]')
        ?.innerText.includes("Confirm availability again for 19 Jun 2027.")
      && document.querySelector('details[data-browser-availability="true"] select')?.value === "not_checked"`,
    "the stale-date availability warning",
  );

  const seededPlan = JSON.parse(await evaluate(
    client,
    `(() => {
      const storageKey = "everaft:wedding-budget:v1";
      const plan = JSON.parse(localStorage.getItem(storageKey));
      const sourceItem = plan.items.find((item) => item.itemName === ${JSON.stringify(journeyConfig.manualVenueName)});
      if (!sourceItem) return JSON.stringify({ itemCount: 0, paymentCount: 0, sourceItemId: null });
      const retainedItems = plan.items.filter((item) => !String(item.id).startsWith("browser-long-list-"));
      const clones = Array.from(
        { length: ${journeyConfig.longListItemCount - 1} },
        (_, index) => {
          const itemNumber = index + 2;
          const itemId = "browser-long-list-" + itemNumber;
          return {
            ...sourceItem,
            id: itemId,
            itemName: "Browser overflow venue " + itemNumber,
            supplierName: "Browser overflow venue " + itemNumber,
            listingId: null,
            listingUrl: null,
            availabilityDate: null,
            availabilityStatus: "not_checked",
            installments: sourceItem.installments.map((installment) => ({
              ...installment,
              id: itemId + "-payment",
              label: "Browser instalment " + itemNumber,
              paidPence: 0,
              dueDate: "2027-06-" + String(itemNumber).padStart(2, "0")
            })),
            depositPaidPence: 0,
            totalPaidPence: 0,
            paymentStatus: "unpaid",
            costStatus: "confirmed",
            sortOrder: retainedItems.length + index,
            createdAt: new Date(Date.now() + itemNumber).toISOString(),
            updatedAt: new Date(Date.now() + itemNumber).toISOString()
          };
        },
      );
      plan.items = [...retainedItems, ...clones];
      plan.updatedAt = new Date(Date.now() + 60_000).toISOString();
      localStorage.setItem(storageKey, JSON.stringify(plan));
      return JSON.stringify({
        itemCount: plan.items.filter((item) => item.bookingStatus !== "cancelled").length,
        paymentCount: plan.items.reduce((count, item) => count + item.installments.length, 0),
        sourceItemId: sourceItem.id
      });
    })()`,
  ));
  assert.equal(seededPlan.itemCount, journeyConfig.longListItemCount);
  assert.equal(seededPlan.paymentCount, journeyConfig.longListItemCount);
  assert(seededPlan.sourceItemId, "The long-list fixture lost its source venue.");

  await client.send("Page.navigate", {
    url: new URL("/planning-hub/organise", baseUrl).href,
  });
  await waitForDocument(client, [
    "Budget & bookings",
    "Payments & deadlines",
    "7 booked",
    "7 need action",
    "Availability needs rechecking",
    "Show 1 more booking",
    "Show 2 more payments",
  ]);
  const initialLongListState = JSON.parse(await evaluate(
    client,
    `JSON.stringify({
      bookings: document.querySelectorAll("#planning-hub-booking-pipeline > li").length,
      payments: document.querySelectorAll("#planning-hub-payment-commitments > li").length
    })`,
  ));
  assert.deepEqual(initialLongListState, { bookings: 6, payments: 5 });

  assert.equal(
    await clickButtonWithin(client, "main", "Show 1 more booking"),
    true,
    "The remaining booking could not be revealed.",
  );
  assert.equal(
    await clickButtonWithin(client, "main", "Show 2 more payments"),
    true,
    "The remaining payments could not be revealed.",
  );
  await waitForCondition(
    client,
    `document.querySelectorAll("#planning-hub-booking-pipeline > li").length === 7
      && document.querySelectorAll("#planning-hub-payment-commitments > li").length === 7
      && Array.from(document.querySelectorAll("button")).filter((button) =>
        button.textContent?.includes("Show fewer")
      ).length === 2`,
    "all bookings and payments to become reachable",
  );
  await assertHealthyPage({
    axeSource: source,
    client,
    expectedText: [
      "Browser overflow venue 7",
      "Browser instalment 7",
      "Show fewer bookings",
      "Show fewer payments",
    ],
    name: "organise-long-lists-mobile",
    runtimeErrors,
    viewport: journeyConfig.viewport,
  });

  await client.send("Page.navigate", {
    url: new URL(
      `/planning-hub?planItem=${encodeURIComponent(seededPlan.sourceItemId)}#current-venue-planning`,
      baseUrl,
    ).href,
  });
  await waitForDocument(client, [journeyConfig.manualVenueName, "Remove from plan"]);
  assert.equal(
    await clickButtonWithin(
      client,
      'aside[aria-label="Connected wedding plan"]',
      "Remove from plan",
    ),
    true,
    "The venue removal confirmation did not open.",
  );
  await waitForCondition(
    client,
    `document.querySelector('[role="group"]')?.innerText.includes(${JSON.stringify(`Remove ${journeyConfig.manualVenueName} from your plan?`)})
      && document.activeElement?.textContent?.includes("Keep in plan")`,
    "the focused venue removal confirmation",
  );
  assert.equal(
    await clickButtonWithin(
      client,
      'aside[aria-label="Connected wedding plan"]',
      "Yes, remove from plan",
    ),
    true,
    "The venue removal was not confirmed.",
  );
  await waitForCondition(
    client,
    `document.querySelector("#current-venue-planning h3")?.textContent?.trim() === "Open a venue to plan it"
      && document.activeElement === document.querySelector("#current-venue-planning h3")
      && !document.querySelector('aside button')?.textContent?.includes("This is your chosen venue")
      && !document.querySelector('aside')?.innerText.includes(${JSON.stringify(journeyConfig.paymentLabel)})`,
    "the removed venue to leave active planning and totals",
  );

  const firstVenueName = await clickFirstVenueAction(client, "View");
  await waitForCondition(
    client,
    `document.querySelector('#venue-detail')?.getAttribute("aria-label") === ${JSON.stringify(`${firstVenueName} details`)}`,
    "a catalogue venue detail before lifecycle verification",
  );
  await evaluate(
    client,
    `document.querySelector('button[aria-label="Close venue details"]')?.click()`,
  );
  await waitForCondition(
    client,
    `document.querySelector("#current-venue-planning h3")?.textContent?.trim() === ${JSON.stringify(firstVenueName)}
      && !document.querySelector("#venue-detail")`,
    "the catalogue venue planning panel",
  );
  assert.equal(
    await clickButtonWithin(client, "#current-venue-planning", "Add venue to plan"),
    true,
    "The catalogue venue could not be added to the plan.",
  );
  await waitForCondition(
    client,
    `document.querySelector("#current-venue-planning")?.innerText.includes("Update venue plan")`,
    "the active catalogue venue",
  );
  assert.equal(
    await clickButtonWithin(
      client,
      'aside[aria-label="Connected wedding plan"]',
      "Remove from plan",
    ),
    true,
    "The catalogue venue removal confirmation did not open.",
  );
  assert.equal(
    await clickButtonWithin(
      client,
      'aside[aria-label="Connected wedding plan"]',
      "Yes, remove from plan",
    ),
    true,
    "The catalogue venue removal was not confirmed.",
  );
  await waitForCondition(
    client,
    `document.querySelector("#current-venue-planning")?.innerText.includes("Add venue to plan")`,
    "the catalogue venue to become available for reactivation",
  );
  assert.equal(
    await clickButtonWithin(client, "#current-venue-planning", "Add venue to plan"),
    true,
    "The catalogue venue could not be reactivated.",
  );
  await waitForCondition(
    client,
    `document.querySelector("#current-venue-planning")?.innerText.includes("Update venue plan")`,
    "the reactivated catalogue venue",
  );
  const reactivationState = JSON.parse(await evaluate(
    client,
    `(() => {
      const plan = JSON.parse(localStorage.getItem("everaft:wedding-budget:v1"));
      const currentHeading = document.querySelector("#current-venue-planning h3")?.textContent?.trim();
      const matchingItems = plan.items.filter((item) => item.itemName === currentHeading);
      return JSON.stringify({
        activeCount: matchingItems.filter((item) => item.bookingStatus !== "cancelled").length,
        totalCount: matchingItems.length
      });
    })()`,
  ));
  assert.deepEqual(
    reactivationState,
    { activeCount: 1, totalCount: 1 },
    "Reactivation must reuse the retained catalogue item without duplication.",
  );
  assert.deepEqual(
    runtimeErrors,
    [],
    `availability-lifecycle-mobile emitted browser errors: ${JSON.stringify(runtimeErrors)}`,
  );
  const screenshotPath = process.env.PLANNING_HUB_BROWSER_SCREENSHOT_PATH?.trim();
  if (screenshotPath) {
    assert(path.isAbsolute(screenshotPath), "PLANNING_HUB_BROWSER_SCREENSHOT_PATH must be absolute.");
    const screenshot = await client.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
    });
    await writeFile(screenshotPath, screenshot.data, "base64");
  }
  console.log(
    "availability-lifecycle-mobile: explicit availability, stale-date warning, Organise summaries, complete booking/payment expansion, focused removal and duplicate-free catalogue reactivation passed.",
  );
}

async function verifyVenueKeyboardJourney({
  client,
  journey: journeyConfig,
  runtimeErrors,
}) {
  await waitForCondition(
    client,
    `Boolean(document.querySelector('section[aria-label="Matching wedding venues"] article'))`,
    "a live venue result for keyboard verification",
  );
  await startInteractionTiming(client);

  const firstVenueName = await focusFirstVenueAction(client, "View");
  await pressKey(client, "Enter");
  await waitForCondition(
    client,
    `document.querySelector('#venue-detail')?.getAttribute("aria-label") === ${JSON.stringify(`${firstVenueName} details`)}
      && document.activeElement?.id === "venue-detail"`,
    "Enter to open venue details and transfer focus",
  );
  const detailAccessibility = await getAccessibilitySnapshot(client);
  assertAccessibilityNode(detailAccessibility, {
    label: "opened venue detail region",
    name: `${firstVenueName} details`,
    role: "region",
  });
  assertAccessibilityNode(detailAccessibility, {
    label: "venue detail close control",
    name: "Close venue details",
    role: "button",
  });

  await pressKey(client, "Tab");
  await waitForCondition(
    client,
    `document.activeElement?.getAttribute("aria-label") === "Close venue details"`,
    "Tab to reach the venue detail close button",
  );
  await pressKey(client, "Enter");
  await waitForCondition(
    client,
    `!document.querySelector("#venue-detail")
      && document.activeElement?.textContent?.trim() === "View"
      && Boolean(document.activeElement?.closest('section[aria-label="Matching wedding venues"] article'))`,
    "Enter to close venue details and restore focus to View",
  );

  await focusFirstVenueAction(client, "Compare");
  await pressKey(client, "Space");
  await waitForCondition(
    client,
    `document.activeElement?.textContent?.trim() === "Compare"
      && document.activeElement?.getAttribute("aria-pressed") === "true"
      && document.body.innerText.toLowerCase().includes("venue comparison")`,
    "Space to add the venue to comparison",
  );

  const manualSummaryFocused = await evaluate(
    client,
    `(() => {
      const summary = document.querySelector("details#manual-venue > summary");
      if (!(summary instanceof HTMLElement)) return false;
      summary.focus();
      return document.activeElement === summary;
    })()`,
  );
  assert.equal(
    manualSummaryFocused,
    true,
    "The manual venue summary could not receive keyboard focus.",
  );
  await pressKey(client, "Enter");
  await waitForCondition(
    client,
    `document.querySelector("details#manual-venue")?.open === true
      && document.activeElement === document.querySelector("details#manual-venue > summary")`,
    "Enter to expand the manual venue form",
  );
  await pressKey(client, "Tab");
  await waitForCondition(
    client,
    `document.activeElement?.matches('details#manual-venue input[name="name"]')`,
    "Tab to enter the expanded manual venue form",
  );
  const expandedAccessibility = await getAccessibilitySnapshot(client);
  assertAccessibilityNode(expandedAccessibility, {
    label: "pressed comparison state",
    name: "Compare",
    properties: { pressed: "true" },
    role: "button",
  });
  assertAccessibilityNode(expandedAccessibility, {
    label: "expanded manual venue disclosure",
    name: "Venue not listed?",
    properties: { expanded: true },
    role: "DisclosureTriangle",
  });
  assertAccessibilityNode(expandedAccessibility, {
    label: "manual venue name field",
    name: "Venue name",
    role: "textbox",
  });
  const interactionTiming = await readInteractionTiming(client);
  assert(
    interactionTiming.interactionCount >= 4,
    `Expected at least four real keyboard interactions, received ${JSON.stringify(interactionTiming)}.`,
  );
  assert(
    interactionTiming.maxDurationMs <= PLANNING_LAB_INTERACTION_BUDGET_MS,
    `The slowest lab interaction exceeded ${PLANNING_LAB_INTERACTION_BUDGET_MS} ms: ${JSON.stringify(interactionTiming.slowestInteraction)}.`,
  );

  const recommendationFocused = await focusLinkByText(
    client,
    "Next: choose your photographer",
  );
  assert.equal(
    recommendationFocused,
    true,
    "The Photography recommendation could not receive keyboard focus.",
  );
  await pressKey(client, "Enter");
  await waitForDocument(client, journeyConfig.expectedPhotographyText);
  const currentUrl = new URL(await evaluate(client, "window.location.href"));
  assert.equal(currentUrl.pathname, "/planning-hub/photography");
  assert.equal(currentUrl.searchParams.get("remainingPence"), "2500000");
  assert.equal(currentUrl.searchParams.get("venueName"), journeyConfig.manualVenueName);
  assert.deepEqual(
    runtimeErrors,
    [],
    `venue-keyboard-mobile emitted browser errors: ${JSON.stringify(runtimeErrors)}`,
  );

  console.log(
    `venue-keyboard-mobile: Enter opened detail, Tab reached Close, Enter restored View focus, Space compared, Enter expanded manual entry, Tab reached its first field and Enter followed Photography. ${interactionTiming.interactionCount} lab interactions measured; slowest ${interactionTiming.maxDurationMs} ms.`,
  );
}

async function verifyVenueAccessibilityTree({
  client,
  journey: journeyConfig,
  runtimeErrors,
}) {
  const nodes = await getAccessibilitySnapshot(client);
  assert.equal(
    nodes.filter((node) => node.role === "banner").length,
    1,
    "The Venue page must expose exactly one banner landmark.",
  );
  assert.equal(
    nodes.filter((node) => node.role === "main").length,
    1,
    "The Venue page must expose exactly one main landmark.",
  );
  for (const landmark of [
    { name: "Primary navigation", role: "navigation" },
    { name: "Planning stages", role: "navigation" },
    { name: "Venue result pages", role: "navigation" },
    { name: "Venue filters", role: "complementary" },
    { name: "Connected wedding plan", role: "complementary" },
    { name: "Matching wedding venues", role: "region" },
  ]) {
    assertAccessibilityNode(nodes, {
      ...landmark,
      label: `${landmark.name} landmark`,
    });
  }
  for (const heading of [
    { level: 1, name: "Turn venue browsing into your wedding plan." },
    { level: 2, name: "Matching wedding venues" },
    { level: 2, name: "Budget at a glance" },
    { level: 3, name: journeyConfig.manualVenueName },
  ]) {
    assertAccessibilityNode(nodes, {
      label: `${heading.name} heading`,
      name: heading.name,
      properties: { level: heading.level },
      role: "heading",
    });
  }
  assertAccessibilityNode(nodes, {
    label: "chosen venue pressed state",
    name: "This is your chosen venue",
    properties: { pressed: "true" },
    role: "button",
  });
  assertAccessibilityNode(nodes, {
    label: "collapsed manual venue disclosure",
    name: "Venue not listed?",
    properties: { expanded: false },
    role: "DisclosureTriangle",
  });
  assertAccessibilityNode(nodes, {
    label: "remaining budget text",
    name: "£25,000",
    role: "StaticText",
  });
  const nextStage = assertAccessibilityNode(nodes, {
    label: "Photography recommendation link",
    nameIncludes: "Next: choose your photographer",
    role: "link",
  });
  const nextUrl = new URL(nextStage.properties.url);
  assert.equal(nextUrl.searchParams.get("remainingPence"), "2500000");
  assert.equal(nextUrl.searchParams.get("venueName"), journeyConfig.manualVenueName);
  assert.equal(nextUrl.searchParams.get("planDate"), journeyConfig.weddingDate);
  assert.equal(nextUrl.searchParams.get("planLocation"), journeyConfig.location);
  assert.equal(nextUrl.searchParams.has("venue"), false);
  assert.deepEqual(
    runtimeErrors,
    [],
    `venue-screen-reader-mobile emitted browser errors: ${JSON.stringify(runtimeErrors)}`,
  );
  console.log(
    "venue-screen-reader-mobile: unique banner/main, named navigation, filters, results and plan landmarks, heading levels, chosen/collapsed states, remaining budget and next-stage link passed.",
  );
}

async function verifyPhotographyAccessibilityTree({
  client,
  journey: journeyConfig,
  runtimeErrors,
}) {
  const nodes = await getAccessibilitySnapshot(client);
  assert.equal(
    nodes.filter((node) => node.role === "banner").length,
    1,
    "The Photography page must expose exactly one banner landmark.",
  );
  assert.equal(
    nodes.filter((node) => node.role === "main").length,
    1,
    "The Photography page must expose exactly one main landmark.",
  );
  for (const landmark of [
    { name: "Primary navigation", role: "navigation" },
    { name: "Planning stages", role: "navigation" },
    { name: "Photographer result pages", role: "navigation" },
    { name: "Photography filters", role: "complementary" },
    { name: "Connected wedding plan", role: "complementary" },
    { name: "Matching wedding photographers", role: "region" },
  ]) {
    assertAccessibilityNode(nodes, {
      ...landmark,
      label: `${landmark.name} landmark`,
    });
  }
  for (const heading of [
    { level: 1, name: "Choose photography that fits your real plan." },
    { level: 2, name: "Photographers for your plan" },
    { level: 2, name: "Budget at a glance" },
  ]) {
    assertAccessibilityNode(nodes, {
      label: `${heading.name} heading`,
      name: heading.name,
      properties: { level: heading.level },
      role: "heading",
    });
  }
  for (const accessibleText of [
    `Venue: ${journeyConfig.manualVenueName}`,
    "Date: 12 Jun 2027",
    "£25,000",
  ]) {
    assertAccessibilityNode(nodes, {
      label: `${accessibleText} transported plan context`,
      name: accessibleText,
      role: "StaticText",
    });
  }
  assertAccessibilityNode(nodes, {
    label: "photographer comparison control",
    name: "Compare",
    properties: { pressed: "false" },
    role: "button",
  });
  assertAccessibilityNode(nodes, {
    label: "photographer planning control",
    name: "View & plan",
    role: "button",
  });
  assertAccessibilityNode(nodes, {
    label: "return-to-venue link",
    name: "Review venue and wedding basics",
    role: "link",
  });
  assert.deepEqual(
    runtimeErrors,
    [],
    `photography-screen-reader-mobile emitted browser errors: ${JSON.stringify(runtimeErrors)}`,
  );
  console.log(
    "photography-screen-reader-mobile: unique banner/main, named navigation, filters, results and plan landmarks, heading levels, venue/date/budget context and result controls passed.",
  );
}

async function assertHealthyPage({
  axeSource: source,
  client,
  expectedText,
  name,
  runtimeErrors,
  viewport,
}) {
  const pageState = JSON.parse(await evaluate(client, `JSON.stringify({
    bodyText: document.body?.innerText ?? "",
    bodyWidth: document.body?.scrollWidth ?? 0,
    documentWidth: document.documentElement.scrollWidth,
    hasDevelopmentOverlay: Boolean(document.querySelector("nextjs-portal")),
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth
  })`));
  assert.equal(pageState.hasDevelopmentOverlay, false, `${name} rendered a Next.js overlay.`);
  assert.equal(pageState.innerWidth, viewport.width, `${name} rendered at the wrong width.`);
  assert(
    pageState.documentWidth <= pageState.innerWidth && pageState.bodyWidth <= pageState.innerWidth,
    `${name} overflows horizontally.`,
  );
  for (const expected of expectedText) {
    assert(pageState.bodyText.includes(expected), `${name} did not render expected text: ${expected}`);
  }

  await evaluate(client, source);
  const axe = JSON.parse(await evaluate(
    client,
    `axe.run(document).then((results) => JSON.stringify({
      incomplete: results.incomplete.map((item) => ({
        id: item.id,
        nodes: item.nodes.map((node) => ({
          failureSummary: node.failureSummary,
          target: node.target
        }))
      })),
      passes: results.passes.length,
      violations: results.violations.map((item) => ({
        id: item.id,
        impact: item.impact,
        nodes: item.nodes.length
      }))
    }))`,
    true,
  ));
  assert.deepEqual(axe.violations, [], `${name} has axe violations: ${JSON.stringify(axe.violations)}`);
  assert.deepEqual(axe.incomplete, [], `${name} has indeterminate axe checks: ${JSON.stringify(axe.incomplete)}`);
  assert.deepEqual(runtimeErrors, [], `${name} emitted browser errors: ${JSON.stringify(runtimeErrors)}`);
}

async function getAccessibilitySnapshot(client) {
  await client.send("Accessibility.enable");
  const { nodes } = await client.send("Accessibility.getFullAXTree");
  return nodes
    .filter((node) => !node.ignored)
    .map((node) => ({
      name: node.name?.value ?? "",
      properties: Object.fromEntries(
        (node.properties ?? []).map((property) => [
          property.name,
          property.value?.value,
        ]),
      ),
      role: node.role?.value ?? "",
    }));
}

function assertAccessibilityNode(nodes, {
  label,
  name,
  nameIncludes,
  properties = {},
  role,
}) {
  const matches = nodes.filter((node) => (
    node.role === role
      && (name === undefined || node.name === name)
      && (nameIncludes === undefined || node.name.includes(nameIncludes))
      && Object.entries(properties).every(([property, value]) => (
        node.properties[property] === value
      ))
  ));
  assert(
    matches.length > 0,
    `${label} is missing from the accessibility tree.`
    + ` Available ${role} nodes: ${JSON.stringify(
      nodes
        .filter((node) => node.role === role)
        .map((node) => ({ name: node.name, properties: node.properties }))
        .slice(0, 20),
    )}`,
  );
  return matches[0];
}

async function clickFirstVenueAction(client, text) {
  const result = JSON.parse(await evaluate(
    client,
    `(() => {
      const card = document.querySelector('section[aria-label="Matching wedding venues"] article');
      const button = Array.from(card?.querySelectorAll("button") ?? [])
        .find((candidate) => candidate.textContent?.trim() === ${JSON.stringify(text)});
      const venueName = card?.querySelector("h3")?.textContent?.trim();
      if (!button || !venueName) return JSON.stringify({ clicked: false, venueName: null });
      button.click();
      return JSON.stringify({ clicked: true, venueName });
    })()`,
  ));
  assert.equal(result.clicked, true, `The first venue's ${text} action was not available.`);
  return result.venueName;
}

async function focusFirstVenueAction(client, text) {
  const result = JSON.parse(await evaluate(
    client,
    `(() => {
      const card = document.querySelector('section[aria-label="Matching wedding venues"] article');
      const button = Array.from(card?.querySelectorAll("button") ?? [])
        .find((candidate) => candidate.textContent?.trim() === ${JSON.stringify(text)});
      const venueName = card?.querySelector("h3")?.textContent?.trim();
      if (!button || !venueName) return JSON.stringify({ focused: false, venueName: null });
      button.focus();
      return JSON.stringify({ focused: document.activeElement === button, venueName });
    })()`,
  ));
  assert.equal(result.focused, true, `The first venue's ${text} action could not receive focus.`);
  return result.venueName;
}

async function clickButtonWithin(client, selector, text) {
  return evaluate(
    client,
    `(() => {
      const root = document.querySelector(${JSON.stringify(selector)});
      const button = Array.from(root?.querySelectorAll("button") ?? [])
        .find((candidate) => candidate.textContent?.includes(${JSON.stringify(text)}));
      button?.click();
      return Boolean(button);
    })()`,
  );
}

async function clickLinkByText(client, text) {
  return evaluate(
    client,
    `(() => {
      const link = Array.from(document.querySelectorAll("a"))
        .find((candidate) => candidate.textContent?.includes(${JSON.stringify(text)}));
      link?.click();
      return Boolean(link);
    })()`,
  );
}

async function focusLinkByText(client, text) {
  return evaluate(
    client,
    `(() => {
      const link = Array.from(document.querySelectorAll("a"))
        .find((candidate) => candidate.textContent?.includes(${JSON.stringify(text)}));
      link?.focus();
      return document.activeElement === link;
    })()`,
  );
}

async function pressKey(client, key) {
  const keyConfig = {
    Enter: {
      code: "Enter",
      key: "Enter",
      text: "\r",
      unmodifiedText: "\r",
      windowsVirtualKeyCode: 13,
    },
    Space: {
      code: "Space",
      key: " ",
      text: " ",
      unmodifiedText: " ",
      windowsVirtualKeyCode: 32,
    },
    Tab: {
      code: "Tab",
      key: "Tab",
      windowsVirtualKeyCode: 9,
    },
  }[key];
  assert(keyConfig, `Unsupported browser verification key: ${key}`);
  await client.send("Input.dispatchKeyEvent", {
    type: key === "Tab" ? "rawKeyDown" : "keyDown",
    ...keyConfig,
  });
  await client.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    ...keyConfig,
  });
  await delay(100);
}

async function startInteractionTiming(client) {
  const supported = await evaluate(
    client,
    `(() => {
      window.__planningBrowserInteractionObserver?.disconnect();
      window.__planningBrowserInteractionEntries = [];
      if (!PerformanceObserver.supportedEntryTypes?.includes("event")) return false;
      window.__planningBrowserInteractionObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const target = entry.target instanceof Element
            ? [
                entry.target.tagName.toLowerCase(),
                entry.target.getAttribute("aria-label")
                  || entry.target.textContent?.trim().slice(0, 80)
                  || entry.target.id
                  || ""
              ].filter(Boolean).join(":")
            : "";
          window.__planningBrowserInteractionEntries.push({
            duration: entry.duration,
            interactionId: entry.interactionId,
            name: entry.name,
            target
          });
        }
      });
      window.__planningBrowserInteractionObserver.observe({
        buffered: true,
        durationThreshold: 16,
        type: "event"
      });
      return true;
    })()`,
  );
  assert.equal(
    supported,
    true,
    "This browser does not expose the Event Timing API required for the lab interaction gate.",
  );
}

async function readInteractionTiming(client) {
  const entries = JSON.parse(await evaluate(
    client,
    `(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return JSON.stringify(window.__planningBrowserInteractionEntries ?? []);
    })()`,
    true,
  ));
  return summarizeInteractionTimings(entries);
}

async function setLabelledControl(client, labelText, value) {
  await setLabelledControlWithin(
    client,
    'aside[aria-label="Connected wedding plan"]',
    labelText,
    value,
  );
}

async function setLabelledControlWithin(client, rootSelector, labelText, value) {
  const selector = await evaluate(
    client,
    `(() => {
      const root = document.querySelector(${JSON.stringify(rootSelector)});
      const labels = Array.from(root?.querySelectorAll("label") ?? []);
      const index = labels.findIndex((label) => label.childNodes[0]?.textContent?.trim() === ${JSON.stringify(labelText)});
      const control = index >= 0 ? labels[index].querySelector("input, select, textarea") : null;
      if (!control) return null;
      document.querySelectorAll("[data-browser-control]")
        .forEach((candidate) => candidate.removeAttribute("data-browser-control"));
      const marker = "planning-browser-control-" + Date.now() + "-" + index;
      control.setAttribute("data-browser-control", marker);
      return '[data-browser-control="' + marker + '"]';
    })()`,
  );
  assert(selector, `Could not find the ${labelText} control.`);
  await setControlValue(client, selector, value);
}

async function setControlValue(client, selector, value) {
  const changed = await evaluate(
    client,
    `(() => {
      const control = document.querySelector(${JSON.stringify(selector)});
      if (!(control instanceof HTMLInputElement
        || control instanceof HTMLSelectElement
        || control instanceof HTMLTextAreaElement)) return false;
      const prototype = control instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : control instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLTextAreaElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value").set.call(
        control,
        ${JSON.stringify(value)},
      );
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`,
  );
  assert.equal(changed, true, `Could not set browser control ${selector}.`);
  await delay(100);
}

async function waitForCondition(client, expression, description) {
  let lastText = "";
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await evaluate(client, expression)) {
      await delay(100);
      return;
    }
    if (attempt === 79) {
      lastText = await evaluate(
        client,
        `(document.body?.innerText ?? "").slice(0, 2_000)`,
      );
    }
    await delay(250);
  }
  throw new Error(
    `Timed out waiting for ${description}.`
    + `${lastText ? ` Page text: ${JSON.stringify(lastText)}` : ""}`,
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
