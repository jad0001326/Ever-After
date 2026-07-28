import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { resolvePlanningApiTestConfig } from "./lib/planning-api-test-config.mjs";

const config = resolvePlanningApiTestConfig();
const runId = `${Date.now()}-${randomBytes(4).toString("hex")}`;
const password = `EverAft-${randomBytes(16).toString("base64url")}!9a`;
const createdUserIds = [];

const clientOptions = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};

const admin = createClient(config.url, config.secretKey, clientOptions);
const anon = createClient(config.url, config.publishableKey, clientOptions);

function describeError(error) {
  if (!error) return "unknown error";
  return [error.code, error.message].filter(Boolean).join(": ");
}

function dataOrThrow(result, label) {
  if (result.error) {
    throw new Error(`${label} failed: ${describeError(result.error)}`);
  }
  return result.data;
}

function expectError(result, label, expectedCode = null) {
  assert(result.error, `${label} unexpectedly succeeded.`);
  if (expectedCode) {
    assert.equal(
      result.error.code,
      expectedCode,
      `${label} returned ${describeError(result.error)} instead of ${expectedCode}.`,
    );
  }
}

function expectEmptyOrDenied(result, label) {
  if (result.error) return;
  assert(Array.isArray(result.data), `${label} returned an unexpected payload.`);
  assert.equal(result.data.length, 0, `${label} exposed protected rows.`);
}

async function createTestUser(role) {
  const email = `everaft-planning-${role}-${runId}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: { full_name: `Planning API ${role}` },
  });
  if (error || !data.user) {
    throw new Error(`Creating ${role} Auth user failed: ${describeError(error)}`);
  }
  createdUserIds.push(data.user.id);
  return { email, id: data.user.id };
}

async function waitForProfiles(userIds) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await admin.from("profiles").select("id").in("id", userIds);
    if (!result.error && result.data?.length === userIds.length) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    "Auth users were created, but matching public profiles did not appear. Verify the local baseline schema and handle_new_user trigger.",
  );
}

async function signIn(user) {
  const client = createClient(config.url, config.publishableKey, clientOptions);
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (error || data.user?.id !== user.id) {
    throw new Error(`Signing in ${user.email} failed: ${describeError(error)}`);
  }
  return client;
}

async function cleanup() {
  const failures = [];
  for (const userId of [...createdUserIds].reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) failures.push(`${userId}: ${describeError(error)}`);
  }
  if (failures.length) {
    throw new Error(`Test-user cleanup failed:\n${failures.join("\n")}`);
  }
}

async function verifyPlanningApiBoundary() {
  const owner = await createTestUser("owner");
  const partner = await createTestUser("partner");
  const outsider = await createTestUser("outsider");
  await waitForProfiles([owner.id, partner.id, outsider.id]);

  const ownerClient = await signIn(owner);
  const partnerClient = await signIn(partner);
  const outsiderClient = await signIn(outsider);

  const budgetPlanId = `api-smoke-${runId}`.slice(0, 100);
  dataOrThrow(await ownerClient.from("budget_plans").insert({
    currency: "GBP",
    id: budgetPlanId,
    name: "Planning API smoke budget",
    plan_json: { apiSmoke: runId, schemaVersion: 1 },
    scenario_name: "Current plan",
    total_budget_pence: 2_500_000,
    user_id: owner.id,
  }).select("id").single(), "Owner budget creation");

  const workspaceId = randomUUID();
  const importedTaskId = randomUUID();
  const importedGuestId = randomUUID();
  const importedTableId = randomUUID();
  const snapshot = {
    budgetPlanId,
    guests: [{
      dietaryNotes: "Vegetarian",
      email: null,
      id: importedGuestId,
      name: "API Test Guest",
      rsvpStatus: "accepted",
    }],
    id: workspaceId,
    name: "Planning API smoke workspace",
    profile: {
      dateFlexibility: "few_weeks",
      guestCount: 80,
      location: "Perthshire",
      locationFlexible: false,
      photographyStyles: ["Documentary"],
      priorities: ["venue", "guest_experience"],
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      venueStyles: ["Castle"],
      vision: "A calm local API verification wedding.",
      weddingDate: null,
    },
    rules: [],
    seats: [{
      guestId: importedGuestId,
      seatIndex: 0,
      tableId: importedTableId,
    }],
    tables: [{
      capacity: 8,
      id: importedTableId,
      locked: false,
      name: "API Table",
    }],
    tasks: [{
      category: "venue",
      dueDate: null,
      id: importedTaskId,
      notes: null,
      sortOrder: 0,
      status: "todo",
      title: "Verify the connected plan",
    }],
  };

  const imported = dataOrThrow(await ownerClient.rpc(
    "import_planning_workspace_snapshot_v2",
    {
      expected_updated_at: null,
      target_workspace_id: null,
      workspace_snapshot: snapshot,
    },
  ), "Owner snapshot import");
  assert.equal(imported?.[0]?.workspace_id, workspaceId);

  const ownerMembers = dataOrThrow(
    await ownerClient.from("planning_workspace_members")
      .select("user_id, role")
      .eq("workspace_id", workspaceId),
    "Owner membership read",
  );
  assert.deepEqual(ownerMembers, [{ role: "owner", user_id: owner.id }]);

  expectEmptyOrDenied(
    await outsiderClient.from("planning_workspaces").select("id").eq("id", workspaceId),
    "Outsider workspace read",
  );
  expectEmptyOrDenied(
    await outsiderClient.from("planning_tasks").select("id").eq("workspace_id", workspaceId),
    "Outsider task read",
  );
  expectError(
    await anon.from("planning_workspaces").select("id").eq("id", workspaceId),
    "Anonymous workspace read",
  );

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  dataOrThrow(await ownerClient.from("planning_workspace_invites").insert({
    email_normalized: partner.email,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    invited_by: owner.id,
    token_hash: tokenHash,
    workspace_id: workspaceId,
  }).select("id").single(), "Owner invitation creation");

  expectError(
    await outsiderClient.rpc("accept_planning_workspace_invite", { raw_token: rawToken }),
    "Wrong-email invitation acceptance",
  );
  const acceptedWorkspace = dataOrThrow(
    await partnerClient.rpc("accept_planning_workspace_invite", { raw_token: rawToken }),
    "Partner invitation acceptance",
  );
  assert.equal(acceptedWorkspace, workspaceId);
  expectError(
    await partnerClient.rpc("accept_planning_workspace_invite", { raw_token: rawToken }),
    "Single-use invitation replay",
  );

  const partnerWorkspace = dataOrThrow(
    await partnerClient.from("planning_workspaces").select("id, owner_id").eq("id", workspaceId).single(),
    "Partner workspace read",
  );
  assert.equal(partnerWorkspace.owner_id, owner.id);
  assert.equal(
    dataOrThrow(
      await partnerClient.from("planning_tasks").select("id").eq("workspace_id", workspaceId),
      "Partner task read",
    ).length,
    1,
  );

  dataOrThrow(await partnerClient.from("planning_tasks").insert({
    category: "general",
    notes: null,
    sort_order: 1,
    status: "todo",
    title: "Partner API task",
    workspace_id: workspaceId,
  }).select("id").single(), "Partner task creation");

  dataOrThrow(await partnerClient.from("budget_plans").update({
    plan_json: { apiSmoke: runId, partnerUpdated: true, schemaVersion: 1 },
    updated_at: new Date().toISOString(),
  }).eq("user_id", owner.id).eq("id", budgetPlanId).select("id").single(), "Partner linked-budget update");

  expectEmptyOrDenied(
    await partnerClient.from("planning_workspace_invites").select("id").eq("workspace_id", workspaceId),
    "Partner invitation read",
  );
  expectEmptyOrDenied(
    await partnerClient.from("planning_workspaces").delete().eq("id", workspaceId).select("id"),
    "Partner workspace deletion",
  );
  expectEmptyOrDenied(
    await partnerClient.from("planning_workspace_members")
      .update({ role: "owner" })
      .eq("workspace_id", workspaceId)
      .eq("user_id", partner.id)
      .select("role"),
    "Partner role promotion",
  );
  expectError(
    await outsiderClient.from("planning_tasks").insert({
      category: "general",
      notes: null,
      sort_order: 2,
      status: "todo",
      title: "Outsider task",
      workspace_id: workspaceId,
    }),
    "Outsider task creation",
  );

  const version = dataOrThrow(
    await partnerClient.from("planning_workspaces").select("updated_at").eq("id", workspaceId).single(),
    "Workspace version read",
  ).updated_at;
  const tablePlan = {
    guests: [{
      dietaryNotes: null,
      email: null,
      id: importedGuestId,
      name: "API Test Guest",
      rsvpStatus: "accepted",
      seatIndex: 0,
      tableId: importedTableId,
    }],
    id: `table-plan-${runId}`.slice(0, 100),
    name: "API table plan",
    rules: [],
    schemaVersion: 1,
    tables: [{
      capacity: 8,
      id: importedTableId,
      locked: false,
      name: "API Table",
    }],
    updatedAt: new Date().toISOString(),
  };
  const synced = dataOrThrow(await partnerClient.rpc("sync_planning_table_plan", {
    expected_updated_at: version,
    table_plan: tablePlan,
    target_workspace_id: workspaceId,
  }), "Partner table-plan sync");
  assert(synced?.[0]?.workspace_updated_at);
  expectError(await partnerClient.rpc("sync_planning_table_plan", {
    expected_updated_at: version,
    table_plan: tablePlan,
    target_workspace_id: workspaceId,
  }), "Stale table-plan sync", "40001");

  assert.equal(
    dataOrThrow(
      await partnerClient.from("planning_guests").select("id").eq("workspace_id", workspaceId),
      "Partner guest read",
    ).length,
    1,
  );
  expectEmptyOrDenied(
    await outsiderClient.from("budget_plans").select("id").eq("user_id", owner.id).eq("id", budgetPlanId),
    "Outsider linked-budget read",
  );
  expectError(
    await anon.rpc("accept_planning_workspace_invite", { raw_token: rawToken }),
    "Anonymous invitation RPC",
  );
}

let verificationError = null;
try {
  console.log(`Planning workspace API verification starting against ${config.local ? "local loopback" : "approved disposable"} Supabase.`);
  await verifyPlanningApiBoundary();
  console.log(
    "Planning workspace API verification passed: Auth sessions, Data API grants/RLS, invitation binding, partner access, outsider isolation and stale-write conflicts.",
  );
} catch (error) {
  verificationError = error;
} finally {
  try {
    await cleanup();
  } catch (cleanupError) {
    verificationError = verificationError
      ? new AggregateError([verificationError, cleanupError], "Verification and cleanup both failed.")
      : cleanupError;
  }
}

if (verificationError) throw verificationError;
