import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";

const projectRef = "fryfdniacyhpubfiqnxj";
const supabaseUrl = `https://${projectRef}.supabase.co`;
const approvedMigration = "20260820184100_normalize_planning_version_conflicts.sql";
const cleanupConfirmation = "delete-temporary-users-and-cascaded-planning-data";
const port = 3011;
const appUrl = `http://127.0.0.1:${port}`;
function readConfirmation() {
  const confirmIndex = process.argv.indexOf("--confirm");
  assert.equal(
    process.argv[confirmIndex + 1],
    approvedMigration,
    `Refusing production smoke without --confirm ${approvedMigration}`,
  );
}

function loadProjectKeys() {
  const result = spawnSync(
    process.env.ComSpec ?? "cmd.exe",
    [
      "/d",
      "/s",
      "/c",
      `npx.cmd --yes supabase@2.101.0 projects api-keys --project-ref ${projectRef} --output json`,
    ],
    {
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(result.status, 0, "Supabase API-key lookup failed.");
  const keys = JSON.parse(result.stdout);
  const publishableKey = keys.find((key) => key.name === "anon")?.api_key
    ?? keys.find((key) => key.type === "publishable")?.api_key;
  const secretKey = keys.find((key) => key.name === "service_role")?.api_key
    ?? keys.find((key) => key.type === "secret")?.api_key;
  assert(publishableKey, "Production publishable key was not found.");
  assert(secretKey, "Production secret key was not found.");
  return { publishableKey, secretKey };
}

async function waitForLocalApp(server, output) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) break;
    try {
      const response = await fetch(`${appUrl}/api/planning/v1/workspaces`, {
        redirect: "manual",
      });
      if (response.status === 401) return;
    } catch {
      // The server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Local production build did not become ready.\n${output()}`);
}

async function stopServer(server) {
  if (server.exitCode !== null) return;
  const exited = once(server, "exit");
  server.kill();
  await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (server.exitCode === null) server.kill("SIGKILL");
}

readConfirmation();
const { publishableKey, secretKey } = loadProjectKeys();
let serverOutput = "";
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)],
  {
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      PLANNING_WORKSPACE_CLOUD_ENABLED: "true",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);
for (const stream of [server.stdout, server.stderr]) {
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    serverOutput = `${serverOutput}${chunk}`.slice(-8_000);
  });
}

let smokeStatus = null;
try {
  await waitForLocalApp(server, () => serverOutput);
  console.log("Local candidate is ready with connected planning enabled only for this test process.");
  const smoke = spawnSync(process.execPath, ["scripts/verify-planning-workspace-api.mjs"], {
    env: {
      ...process.env,
      PLANNING_API_TEST_ALLOW_PRODUCTION: "true",
      PLANNING_API_TEST_APP_URL: appUrl,
      PLANNING_API_TEST_CONFIRM_CLEANUP: cleanupConfirmation,
      PLANNING_API_TEST_CONFIRM_PRODUCTION_PROJECT: projectRef,
      SUPABASE_TEST_PUBLISHABLE_KEY: publishableKey,
      SUPABASE_TEST_SECRET_KEY: secretKey,
      SUPABASE_TEST_URL: supabaseUrl,
    },
    stdio: "inherit",
    windowsHide: true,
  });
  smokeStatus = smoke.status;
} finally {
  await stopServer(server);
}

assert.equal(smokeStatus, 0, "Controlled production Planning Hub security test failed.");
