import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  loadPlanningApiContractSchemas,
  planningApiContracts,
  planningApiRequest,
  validatePlanningApiContract,
} from "./lib/planning-api-http.mjs";
import { resolvePlanningApiTestConfig } from "./lib/planning-api-test-config.mjs";

const config = resolvePlanningApiTestConfig();
const sourceRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const contractSchemas = await loadPlanningApiContractSchemas(sourceRoot);
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

async function waitForProfiles(sessions) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const results = await Promise.all(sessions.map(({ client, id }) => (
      client.from("profiles").select("id").eq("id", id).maybeSingle()
    )));
    if (results.every((result, index) => (
      !result.error && result.data?.id === sessions[index].id
    ))) return;
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
  if (error || data.user?.id !== user.id || !data.session?.access_token) {
    throw new Error(`Signing in ${user.email} failed: ${describeError(error)}`);
  }
  return { client, accessToken: data.session.access_token };
}

function createBudgetPlan({ id, userId, totalBudgetPence, updatedAt }) {
  return {
    schemaVersion: 1,
    id,
    userId,
    name: "Planning API smoke budget",
    totalBudgetPence,
    currency: "GBP",
    weddingDate: null,
    guestCount: 80,
    location: "Perthshire",
    contingencyType: "none",
    contingencyValue: 0,
    createdAt: updatedAt,
    updatedAt,
    selectedVenueId: null,
    scenarioName: "Current plan",
    categories: [],
    items: [],
  };
}

async function cleanup() {
  const failures = [];
  const userIds = [...createdUserIds];
  for (const userId of [...createdUserIds].reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) failures.push(`${userId}: ${describeError(error)}`);
  }
  if (failures.length) {
    throw new Error(`Test-user cleanup failed:\n${failures.join("\n")}`);
  }
  for (const userId of userIds) {
    const { data } = await admin.auth.admin.getUserById(userId);
    if (data?.user) {
      failures.push(`${userId}: Auth user still exists after cleanup`);
    }
  }
  if (failures.length) {
    throw new Error(`Test-user cleanup verification failed:\n${failures.join("\n")}`);
  }
  if (userIds.length) console.log(`Temporary test-user deletion verified for ${userIds.length} Auth users; cascade counts require the release ledger check.`);
}

function apiPath(workspaceId, suffix = "") {
  return `/api/planning/v1/workspaces/${encodeURIComponent(workspaceId)}${suffix}`;
}

function assertRequestContract(contractId, body, label) {
  return validatePlanningApiContract(contractSchemas, contractId, body, label);
}

async function apiSuccess({
  body,
  contractId,
  label,
  method,
  path,
  status,
  token,
}) {
  return planningApiRequest({
    appUrl: config.appUrl,
    body,
    contractId,
    expectedStatus: status,
    label,
    method,
    path,
    schemas: contractSchemas,
    token,
  });
}

async function apiError({
  body,
  contractId,
  error,
  label,
  method,
  path,
  status,
  token,
}) {
  return planningApiRequest({
    appUrl: config.appUrl,
    body,
    contractId,
    expectedError: error,
    expectedStatus: status,
    label,
    method,
    path,
    schemas: contractSchemas,
    token,
  });
}

async function verifyPlanningApplicationBoundary({
  budgetPlanId,
  owner,
  ownerClient,
  ownerPlan,
  ownerSession,
  partnerSession,
  outsiderSession,
  workspaceId,
}) {
  const collectionPath = "/api/planning/v1/workspaces";
  await apiError({
    contractId: planningApiContracts.workspaceCollection,
    error: "authentication_required",
    label: "Unsigned application readiness request",
    path: collectionPath,
    status: 401,
  });

  const secondaryBudgetId = `api-secondary-${runId}`.slice(0, 100);
  const secondaryBudgetVersion = new Date().toISOString();
  const secondaryPlan = createBudgetPlan({
    id: secondaryBudgetId,
    userId: owner.id,
    totalBudgetPence: 1_800_000,
    updatedAt: secondaryBudgetVersion,
  });
  dataOrThrow(await ownerClient.from("budget_plans").insert({
    currency: "GBP",
    id: secondaryBudgetId,
    name: "Planning API secondary budget",
    plan_json: secondaryPlan,
    scenario_name: "Current plan",
    total_budget_pence: secondaryPlan.totalBudgetPence,
    updated_at: secondaryBudgetVersion,
    user_id: owner.id,
  }).select("id").single(), "Secondary budget creation");

  const secondaryWorkspaceId = randomUUID();
  const secondaryTaskId = randomUUID();
  const secondarySnapshot = {
    budgetPlanId: secondaryBudgetId,
    guests: [],
    id: secondaryWorkspaceId,
    name: "Planning API secondary workspace",
    profile: {
      dateFlexibility: "not_set",
      guestCount: null,
      location: null,
      locationFlexible: false,
      photographyStyles: [],
      priorities: [],
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      venueStyles: [],
      vision: null,
      weddingDate: null,
    },
    rules: [],
    seats: [],
    tables: [],
    tasks: [{
      category: "general",
      dueDate: null,
      id: secondaryTaskId,
      notes: null,
      sortOrder: 0,
      status: "todo",
      title: "Secondary workspace task",
    }],
  };
  dataOrThrow(await ownerClient.rpc("import_planning_workspace_snapshot_v2", {
    expected_updated_at: null,
    target_workspace_id: null,
    workspace_snapshot: secondarySnapshot,
  }), "Secondary workspace import");
  dataOrThrow(await ownerClient.from("planning_workspace_profiles")
    .delete()
    .eq("workspace_id", secondaryWorkspaceId)
    .select("workspace_id")
    .single(), "Secondary profile removal");

  const ownerFirstPage = await apiSuccess({
    contractId: planningApiContracts.workspaceCollection,
    label: "Owner workspace first page",
    path: `${collectionPath}?limit=1&offset=0`,
    token: ownerSession.accessToken,
  });
  assert.equal(ownerFirstPage.workspaces.length, 1);
  assert.equal(ownerFirstPage.workspaces[0].id, secondaryWorkspaceId);
  assert.equal(ownerFirstPage.workspaces[0].role, "owner");
  assert.equal(ownerFirstPage.page.hasMore, true);
  assert(!("ownerId" in ownerFirstPage.workspaces[0]));
  assert(!("members" in ownerFirstPage.workspaces[0]));

  const ownerSecondPage = await apiSuccess({
    contractId: planningApiContracts.workspaceCollection,
    label: "Owner workspace second page",
    path: `${collectionPath}?limit=1&offset=1`,
    token: ownerSession.accessToken,
  });
  assert.equal(ownerSecondPage.workspaces[0]?.id, workspaceId);

  const partnerCollection = await apiSuccess({
    contractId: planningApiContracts.workspaceCollection,
    label: "Partner workspace collection",
    path: `${collectionPath}?limit=10&offset=0`,
    token: partnerSession.accessToken,
  });
  assert.deepEqual(
    partnerCollection.workspaces.map(({ id, role }) => ({ id, role })),
    [{ id: workspaceId, role: "partner" }],
  );
  const outsiderCollection = await apiSuccess({
    contractId: planningApiContracts.workspaceCollection,
    label: "Outsider workspace collection",
    path: collectionPath,
    token: outsiderSession.accessToken,
  });
  assert.deepEqual(outsiderCollection.workspaces, []);
  await apiError({
    contractId: planningApiContracts.workspaceCollection,
    error: "authentication_required",
    label: "Rejected application bearer",
    path: collectionPath,
    status: 401,
    token: "eyJhbGciOiJub25lIn0.eyJleHAiOjF9.",
  });

  const dashboardPath = apiPath(workspaceId, "/dashboard");
  const ownerDashboard = await apiSuccess({
    contractId: planningApiContracts.dashboard,
    label: "Owner dashboard",
    path: dashboardPath,
    token: ownerSession.accessToken,
  });
  const partnerDashboard = await apiSuccess({
    contractId: planningApiContracts.dashboard,
    label: "Partner dashboard",
    path: dashboardPath,
    token: partnerSession.accessToken,
  });
  assert.equal(ownerDashboard.workspace.id, workspaceId);
  assert.equal(partnerDashboard.workspace.id, workspaceId);
  assert.deepEqual(partnerDashboard.budget, ownerDashboard.budget);
  assert.deepEqual(partnerDashboard.wedding, ownerDashboard.wedding);
  await apiError({
    contractId: planningApiContracts.dashboard,
    error: "workspace_unavailable",
    label: "Outsider dashboard denial",
    path: dashboardPath,
    status: 404,
    token: outsiderSession.accessToken,
  });
  await apiError({
    contractId: planningApiContracts.dashboard,
    error: "authentication_required",
    label: "Rejected dashboard bearer",
    path: dashboardPath,
    status: 401,
    token: "expired.invalid.token",
  });

  const budgetPath = apiPath(workspaceId, "/budget");
  let currentPlan = {
    ...ownerPlan,
    name: "Owner route budget",
    updatedAt: ownerDashboard.versions.budgetUpdatedAt,
  };
  const ownerBudgetRequest = {
    schemaVersion: 1,
    expectedBudgetUpdatedAt: currentPlan.updatedAt,
    plan: currentPlan,
  };
  assertRequestContract(planningApiContracts.budgetRequest, ownerBudgetRequest, "Owner budget request");
  const ownerBudgetSaved = await apiSuccess({
    body: ownerBudgetRequest,
    contractId: planningApiContracts.budgetSuccess,
    label: "Owner budget update",
    method: "PATCH",
    path: budgetPath,
    token: ownerSession.accessToken,
  });
  currentPlan = {
    ...currentPlan,
    name: "Partner route budget",
    totalBudgetPence: 2_600_000,
    updatedAt: ownerBudgetSaved.savedAt,
  };
  const partnerBudgetRequest = {
    schemaVersion: 1,
    expectedBudgetUpdatedAt: currentPlan.updatedAt,
    plan: currentPlan,
  };
  assertRequestContract(planningApiContracts.budgetRequest, partnerBudgetRequest, "Partner budget request");
  const partnerBudgetSaved = await apiSuccess({
    body: partnerBudgetRequest,
    contractId: planningApiContracts.budgetSuccess,
    label: "Partner budget update",
    method: "PATCH",
    path: budgetPath,
    token: partnerSession.accessToken,
  });
  const staleBudgetRequest = {
    ...ownerBudgetRequest,
    plan: { ...ownerBudgetRequest.plan, name: "Stale budget write" },
  };
  assertRequestContract(planningApiContracts.budgetRequest, staleBudgetRequest, "Stale budget request");
  await apiError({
    body: staleBudgetRequest,
    contractId: planningApiContracts.budgetSuccess,
    error: "version_conflict",
    label: "Stale budget update",
    method: "PATCH",
    path: budgetPath,
    status: 409,
    token: ownerSession.accessToken,
  });
  const currentBudgetRequest = {
    schemaVersion: 1,
    expectedBudgetUpdatedAt: partnerBudgetSaved.savedAt,
    plan: { ...currentPlan, updatedAt: partnerBudgetSaved.savedAt },
  };
  assertRequestContract(planningApiContracts.budgetRequest, currentBudgetRequest, "Current budget request");
  await apiError({
    body: currentBudgetRequest,
    contractId: planningApiContracts.budgetSuccess,
    error: "workspace_unavailable",
    label: "Outsider budget update",
    method: "PATCH",
    path: budgetPath,
    status: 404,
    token: outsiderSession.accessToken,
  });
  const storedBudget = dataOrThrow(await ownerClient.from("budget_plans")
    .select("user_id, total_budget_pence, updated_at")
    .eq("id", budgetPlanId)
    .single(), "Stored budget verification");
  assert.equal(storedBudget.user_id, owner.id);
  assert.equal(storedBudget.total_budget_pence, 2_600_000);
  assert.equal(storedBudget.updated_at, partnerBudgetSaved.savedAt);

  const tablePlanPath = apiPath(workspaceId, "/table-plan");
  const ownerTablePlan = await apiSuccess({
    contractId: planningApiContracts.tablePlanResource,
    label: "Owner table-plan read",
    path: tablePlanPath,
    token: ownerSession.accessToken,
  });
  const partnerTablePlan = await apiSuccess({
    contractId: planningApiContracts.tablePlanResource,
    label: "Partner table-plan read",
    path: tablePlanPath,
    token: partnerSession.accessToken,
  });
  assert.deepEqual(partnerTablePlan, ownerTablePlan);
  const changedTablePlan = {
    ...ownerTablePlan.tablePlan,
    name: "Partner verified table plan",
    updatedAt: ownerTablePlan.workspaceUpdatedAt,
  };
  const tablePlanRequest = {
    schemaVersion: 1,
    expectedWorkspaceUpdatedAt: ownerTablePlan.workspaceUpdatedAt,
    tablePlan: changedTablePlan,
  };
  assertRequestContract(planningApiContracts.tablePlanRequest, tablePlanRequest, "Table-plan update request");
  await apiSuccess({
    body: tablePlanRequest,
    contractId: planningApiContracts.tablePlanSuccess,
    label: "Partner table-plan update",
    method: "PATCH",
    path: tablePlanPath,
    token: partnerSession.accessToken,
  });
  await apiError({
    body: tablePlanRequest,
    contractId: planningApiContracts.tablePlanSuccess,
    error: "version_conflict",
    label: "Stale table-plan update",
    method: "PATCH",
    path: tablePlanPath,
    status: 409,
    token: partnerSession.accessToken,
  });
  await apiError({
    body: tablePlanRequest,
    contractId: planningApiContracts.tablePlanSuccess,
    error: "workspace_unavailable",
    label: "Outsider table-plan update",
    method: "PATCH",
    path: tablePlanPath,
    status: 404,
    token: outsiderSession.accessToken,
  });
  const updatedTablePlan = await apiSuccess({
    contractId: planningApiContracts.tablePlanResource,
    label: "Updated table-plan read",
    path: tablePlanPath,
    token: ownerSession.accessToken,
  });
  assert.equal(updatedTablePlan.tablePlan.name, "Partner verified table plan");

  const impossibleGuestId = randomUUID();
  try {
    dataOrThrow(await admin.from("planning_guests").insert({
      dietary_notes: null,
      email: null,
      id: impossibleGuestId,
      name: "Impossible API seat",
      rsvp_status: "pending",
      sort_order: 999,
      workspace_id: workspaceId,
    }), "Impossible guest setup");
    dataOrThrow(await admin.from("planning_seats").insert({
      guest_id: impossibleGuestId,
      seat_index: 19,
      table_id: updatedTablePlan.tablePlan.tables[0].id,
      workspace_id: workspaceId,
    }), "Impossible seat setup");
    await apiError({
      contractId: planningApiContracts.tablePlanResource,
      error: "table_plan_unavailable",
      label: "Impossible stored seating denial",
      path: tablePlanPath,
      status: 500,
      token: ownerSession.accessToken,
    });
  } finally {
    await admin.from("planning_guests").delete().eq("id", impossibleGuestId);
  }

  const profilePath = apiPath(workspaceId, "/profile");
  const ownerProfile = await apiSuccess({
    contractId: planningApiContracts.profileResource,
    label: "Owner profile read",
    path: profilePath,
    token: ownerSession.accessToken,
  });
  const partnerProfile = await apiSuccess({
    contractId: planningApiContracts.profileResource,
    label: "Partner profile read",
    path: profilePath,
    token: partnerSession.accessToken,
  });
  assert.deepEqual(partnerProfile, ownerProfile);
  await apiError({
    contractId: planningApiContracts.profileResource,
    error: "workspace_unavailable",
    label: "Outsider profile denial",
    path: profilePath,
    status: 404,
    token: outsiderSession.accessToken,
  });

  const secondaryProfilePath = apiPath(secondaryWorkspaceId, "/profile");
  const emptyProfile = await apiSuccess({
    contractId: planningApiContracts.profileResource,
    label: "Empty profile read",
    path: secondaryProfilePath,
    token: ownerSession.accessToken,
  });
  assert.equal(emptyProfile.profile, null);
  const profileContent = {
    schemaVersion: 1,
    weddingDate: "2027-08-14",
    guestCount: 72,
    location: "Perthshire",
    dateFlexibility: "few_weeks",
    locationFlexible: false,
    priorities: ["venue", "guest_experience"],
    venueStyles: ["Castle"],
    photographyStyles: ["Documentary"],
    vision: "A calm connected planning API test.",
  };
  const createProfileRequest = {
    schemaVersion: 1,
    expectedProfileUpdatedAt: null,
    profile: profileContent,
  };
  assertRequestContract(planningApiContracts.profileRequest, createProfileRequest, "Create profile request");
  const createdProfile = await apiSuccess({
    body: createProfileRequest,
    contractId: planningApiContracts.profileResource,
    label: "Profile creation",
    method: "PATCH",
    path: secondaryProfilePath,
    token: ownerSession.accessToken,
  });
  const updateProfileRequest = {
    schemaVersion: 1,
    expectedProfileUpdatedAt: createdProfile.profile.updatedAt,
    profile: { ...profileContent, guestCount: 80 },
  };
  assertRequestContract(planningApiContracts.profileRequest, updateProfileRequest, "Update profile request");
  const updatedProfile = await apiSuccess({
    body: updateProfileRequest,
    contractId: planningApiContracts.profileResource,
    label: "Profile update",
    method: "PATCH",
    path: secondaryProfilePath,
    token: ownerSession.accessToken,
  });
  assert.equal(updatedProfile.profile.guestCount, 80);
  await apiError({
    body: updateProfileRequest,
    contractId: planningApiContracts.profileResource,
    error: "version_conflict",
    label: "Stale profile update",
    method: "PATCH",
    path: secondaryProfilePath,
    status: 409,
    token: ownerSession.accessToken,
  });

  const tasksPath = apiPath(workspaceId, "/tasks");
  const ownerTasks = await apiSuccess({
    contractId: planningApiContracts.taskCollection,
    label: "Owner task collection",
    path: `${tasksPath}?limit=100&offset=0`,
    token: ownerSession.accessToken,
  });
  const partnerTasks = await apiSuccess({
    contractId: planningApiContracts.taskCollection,
    label: "Partner task collection",
    path: `${tasksPath}?limit=100&offset=0`,
    token: partnerSession.accessToken,
  });
  assert.deepEqual(partnerTasks, ownerTasks);
  assert.deepEqual(
    ownerTasks.tasks.map(({ sortOrder }) => sortOrder),
    [...ownerTasks.tasks.map(({ sortOrder }) => sortOrder)].sort((a, b) => a - b),
  );
  await apiError({
    contractId: planningApiContracts.taskCollection,
    error: "workspace_unavailable",
    label: "Outsider task collection denial",
    path: tasksPath,
    status: 404,
    token: outsiderSession.accessToken,
  });

  const serverTaskRequest = {
    schemaVersion: 1,
    task: {
      title: "Server generated API task",
      notes: null,
      category: "general",
      status: "todo",
      dueDate: null,
      sortOrder: 10,
    },
  };
  assertRequestContract(planningApiContracts.taskCreateRequest, serverTaskRequest, "Server task request");
  await apiSuccess({
    body: serverTaskRequest,
    contractId: planningApiContracts.taskResource,
    label: "Server generated task creation",
    method: "POST",
    path: tasksPath,
    status: 201,
    token: ownerSession.accessToken,
  });

  const stableTaskId = randomUUID();
  const stableTaskRequest = {
    schemaVersion: 1,
    task: {
      ...serverTaskRequest.task,
      id: stableTaskId,
      title: "Stable partner API task",
      sortOrder: 11,
    },
  };
  assertRequestContract(planningApiContracts.taskCreateRequest, stableTaskRequest, "Stable task request");
  const stableTask = await apiSuccess({
    body: stableTaskRequest,
    contractId: planningApiContracts.taskResource,
    label: "Stable partner task creation",
    method: "POST",
    path: tasksPath,
    status: 201,
    token: partnerSession.accessToken,
  });
  await apiError({
    body: stableTaskRequest,
    contractId: planningApiContracts.taskResource,
    error: "version_conflict",
    label: "Duplicate stable task denial",
    method: "POST",
    path: tasksPath,
    status: 409,
    token: partnerSession.accessToken,
  });

  const stableTaskPath = `${tasksPath}/${encodeURIComponent(stableTaskId)}`;
  const updateTaskRequest = {
    schemaVersion: 1,
    expectedTaskUpdatedAt: stableTask.updatedAt,
    changes: { status: "in_progress" },
  };
  assertRequestContract(planningApiContracts.taskUpdateRequest, updateTaskRequest, "Task update request");
  const updatedTask = await apiSuccess({
    body: updateTaskRequest,
    contractId: planningApiContracts.taskResource,
    label: "Partner task update",
    method: "PATCH",
    path: stableTaskPath,
    token: partnerSession.accessToken,
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  const racedTask = dataOrThrow(await ownerClient.from("planning_tasks")
    .update({ title: "Concurrent owner task update" })
    .eq("workspace_id", workspaceId)
    .eq("id", stableTaskId)
    .select("updated_at")
    .single(), "Concurrent task update");
  const racedUpdateRequest = {
    schemaVersion: 1,
    expectedTaskUpdatedAt: updatedTask.updatedAt,
    changes: { status: "done" },
  };
  assertRequestContract(planningApiContracts.taskUpdateRequest, racedUpdateRequest, "Raced task update request");
  await apiError({
    body: racedUpdateRequest,
    contractId: planningApiContracts.taskResource,
    error: "version_conflict",
    label: "Post-read task race",
    method: "PATCH",
    path: stableTaskPath,
    status: 409,
    token: partnerSession.accessToken,
  });
  const currentUpdateRequest = {
    schemaVersion: 1,
    expectedTaskUpdatedAt: racedTask.updated_at,
    changes: { status: "done" },
  };
  assertRequestContract(planningApiContracts.taskUpdateRequest, currentUpdateRequest, "Current task update request");
  const currentTask = await apiSuccess({
    body: currentUpdateRequest,
    contractId: planningApiContracts.taskResource,
    label: "Current task update",
    method: "PATCH",
    path: stableTaskPath,
    token: partnerSession.accessToken,
  });
  const staleDeleteRequest = {
    schemaVersion: 1,
    expectedTaskUpdatedAt: racedTask.updated_at,
  };
  assertRequestContract(planningApiContracts.taskDeleteRequest, staleDeleteRequest, "Stale task delete request");
  await apiError({
    body: staleDeleteRequest,
    contractId: planningApiContracts.taskDeleteSuccess,
    error: "version_conflict",
    label: "Stale task deletion",
    method: "DELETE",
    path: stableTaskPath,
    status: 409,
    token: partnerSession.accessToken,
  });
  const currentDeleteRequest = {
    schemaVersion: 1,
    expectedTaskUpdatedAt: currentTask.updatedAt,
  };
  assertRequestContract(planningApiContracts.taskDeleteRequest, currentDeleteRequest, "Current task delete request");
  const deletedTask = await apiSuccess({
    body: currentDeleteRequest,
    contractId: planningApiContracts.taskDeleteSuccess,
    label: "Current task deletion",
    method: "DELETE",
    path: stableTaskPath,
    token: partnerSession.accessToken,
  });
  assert.equal(deletedTask.taskId, stableTaskId);

  const crossWorkspaceTaskPath = `${tasksPath}/${encodeURIComponent(secondaryTaskId)}`;
  await apiError({
    body: currentUpdateRequest,
    contractId: planningApiContracts.taskResource,
    error: "task_unavailable",
    label: "Cross-workspace task denial",
    method: "PATCH",
    path: crossWorkspaceTaskPath,
    status: 404,
    token: ownerSession.accessToken,
  });

  const finalDashboard = await apiSuccess({
    contractId: planningApiContracts.dashboard,
    label: "Final connected dashboard",
    path: dashboardPath,
    token: partnerSession.accessToken,
  });
  assert.equal(finalDashboard.budget.totalBudgetPence, 2_600_000);
  assert.equal(finalDashboard.workspace.id, workspaceId);
}

async function verifyPlanningApiBoundary() {
  const owner = await createTestUser("owner");
  const partner = await createTestUser("partner");
  const outsider = await createTestUser("outsider");

  const ownerSession = await signIn(owner);
  const partnerSession = await signIn(partner);
  const outsiderSession = await signIn(outsider);
  await waitForProfiles([
    { client: ownerSession.client, id: owner.id },
    { client: partnerSession.client, id: partner.id },
    { client: outsiderSession.client, id: outsider.id },
  ]);
  const ownerClient = ownerSession.client;
  const partnerClient = partnerSession.client;
  const outsiderClient = outsiderSession.client;

  const budgetPlanId = `api-smoke-${runId}`.slice(0, 100);
  const privateBudgetPlanId = `api-private-${runId}`.slice(0, 100);
  const initialBudgetVersion = new Date().toISOString();
  const submittedOwnerPlan = createBudgetPlan({
    id: budgetPlanId,
    userId: outsider.id,
    totalBudgetPence: 2_500_000,
    updatedAt: initialBudgetVersion,
  });
  const privatePlan = createBudgetPlan({
    id: privateBudgetPlanId,
    userId: owner.id,
    totalBudgetPence: 1_500_000,
    updatedAt: initialBudgetVersion,
  });
  dataOrThrow(await ownerClient.from("budget_plans").insert({
      currency: "GBP",
      id: privateBudgetPlanId,
      name: "Planning API private owner budget",
      plan_json: privatePlan,
      scenario_name: "Private plan",
      total_budget_pence: 1_500_000,
      updated_at: initialBudgetVersion,
      user_id: owner.id,
  }).select("id"), "Private owner budget creation");

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

  const rollbackBudgetPlanId = `api-rollback-${runId}`.slice(0, 100);
  const rollbackPlan = createBudgetPlan({
    id: rollbackBudgetPlanId,
    userId: outsider.id,
    totalBudgetPence: 1_700_000,
    updatedAt: initialBudgetVersion,
  });
  expectError(await ownerClient.rpc(
    "import_planning_workspace_with_budget",
    {
      budget_plan: rollbackPlan,
      expected_updated_at: null,
      target_workspace_id: null,
      workspace_snapshot: {
        ...snapshot,
        budgetPlanId: rollbackBudgetPlanId,
        id: randomUUID(),
        tasks: "invalid",
      },
    },
  ), "Atomic import rollback");
  assert.equal(dataOrThrow(
    await ownerClient.from("budget_plans").select("id").eq("id", rollbackBudgetPlanId),
    "Atomic rollback budget verification",
  ).length, 0);

  const imported = dataOrThrow(await ownerClient.rpc(
    "import_planning_workspace_with_budget",
    {
      budget_plan: submittedOwnerPlan,
      expected_updated_at: null,
      target_workspace_id: null,
      workspace_snapshot: snapshot,
    },
  ), "Owner snapshot import");
  assert.equal(imported?.[0]?.workspace_id, workspaceId);

  const storedImportedBudget = dataOrThrow(
    await ownerClient.from("budget_plans").select("plan_json, user_id").eq("id", budgetPlanId).single(),
    "Atomic imported budget verification",
  );
  assert.equal(storedImportedBudget.user_id, owner.id);
  assert.equal(storedImportedBudget.plan_json.userId, owner.id);
  const ownerPlan = { ...submittedOwnerPlan, userId: owner.id };

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

  const partnerBudgetVersion = new Date(Date.parse(initialBudgetVersion) + 1_000).toISOString();
  const partnerPlan = {
    ...ownerPlan,
    name: "Partner verified planning budget",
    updatedAt: partnerBudgetVersion,
  };
  dataOrThrow(await partnerClient.from("budget_plans").update({
    name: partnerPlan.name,
    plan_json: partnerPlan,
    updated_at: partnerBudgetVersion,
  }).eq("user_id", owner.id).eq("id", budgetPlanId).select("id").single(), "Partner linked-budget update");
  expectEmptyOrDenied(
    await partnerClient.from("budget_plans")
      .select("id")
      .eq("user_id", owner.id)
      .eq("id", privateBudgetPlanId),
    "Partner unlinked-budget read",
  );
  expectError(
    await partnerClient.from("planning_workspaces")
      .update({ budget_plan_id: privateBudgetPlanId })
      .eq("id", workspaceId),
    "Partner workspace budget relink",
  );
  assert.equal(
    dataOrThrow(
      await partnerClient.from("planning_workspaces")
        .select("budget_plan_id")
        .eq("id", workspaceId)
        .single(),
      "Partner workspace budget-link verification",
    ).budget_plan_id,
    budgetPlanId,
  );

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

  await verifyPlanningApplicationBoundary({
    budgetPlanId,
    owner,
    ownerClient,
    ownerPlan: partnerPlan,
    ownerSession,
    partnerSession,
    outsiderSession,
    workspaceId,
  });
}

let verificationError = null;
try {
  console.log(`Planning workspace API verification starting against ${config.targetClass} Supabase and ${config.appUrl}.`);
  await verifyPlanningApiBoundary();
  console.log(
    "Planning workspace API verification passed: atomic import/rollback, Auth sessions, Data API grants/RLS, invitation binding, checked Next.js route contracts, owner/partner access, outsider isolation and stale-write conflicts.",
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
