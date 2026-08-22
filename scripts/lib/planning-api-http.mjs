import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

export const planningApiContracts = Object.freeze({
  budgetRequest: "urn:everaft:planning-budget-update-request:v1",
  budgetSuccess: "urn:everaft:planning-budget-update-success:v1",
  dashboard: "urn:everaft:planning-dashboard-snapshot:v1",
  profileRequest: "urn:everaft:planning-profile-update-request:v1",
  profileResource: "urn:everaft:planning-profile-resource:v1",
  tablePlanRequest: "urn:everaft:planning-table-plan-update-request:v1",
  tablePlanResource: "urn:everaft:planning-table-plan-resource:v1",
  tablePlanSuccess: "urn:everaft:planning-table-plan-update-success:v1",
  taskCollection: "urn:everaft:planning-task-collection:v1",
  taskCreateRequest: "urn:everaft:planning-task-create-request:v1",
  taskDeleteRequest: "urn:everaft:planning-task-delete-request:v1",
  taskDeleteSuccess: "urn:everaft:planning-task-delete-success:v1",
  taskResource: "urn:everaft:planning-task-resource:v1",
  taskUpdateRequest: "urn:everaft:planning-task-update-request:v1",
  workspaceCollection: "urn:everaft:planning-workspace-collection:v1",
});

const contractFiles = Object.freeze({
  [planningApiContracts.budgetRequest]: "planning-budget-update-request.v1.schema.json",
  [planningApiContracts.budgetSuccess]: "planning-budget-update-success.v1.schema.json",
  [planningApiContracts.dashboard]: "planning-dashboard-snapshot.v1.schema.json",
  [planningApiContracts.profileRequest]: "planning-profile-update-request.v1.schema.json",
  [planningApiContracts.profileResource]: "planning-profile-resource.v1.schema.json",
  [planningApiContracts.tablePlanRequest]: "planning-table-plan-update-request.v1.schema.json",
  [planningApiContracts.tablePlanResource]: "planning-table-plan-resource.v1.schema.json",
  [planningApiContracts.tablePlanSuccess]: "planning-table-plan-update-success.v1.schema.json",
  [planningApiContracts.taskCollection]: "planning-task-collection.v1.schema.json",
  [planningApiContracts.taskCreateRequest]: "planning-task-create-request.v1.schema.json",
  [planningApiContracts.taskDeleteRequest]: "planning-task-delete-request.v1.schema.json",
  [planningApiContracts.taskDeleteSuccess]: "planning-task-delete-success.v1.schema.json",
  [planningApiContracts.taskResource]: "planning-task-resource.v1.schema.json",
  [planningApiContracts.taskUpdateRequest]: "planning-task-update-request.v1.schema.json",
  [planningApiContracts.workspaceCollection]: "planning-workspace-collection.v1.schema.json",
});

export async function loadPlanningApiContractSchemas(sourceRoot) {
  const entries = await Promise.all(Object.entries(contractFiles).map(
    async ([contractId, filename]) => {
      const path = join(sourceRoot, "docs", "planning-hub", "contracts", filename);
      const jsonSchema = JSON.parse(await readFile(path, "utf8"));
      assert.equal(jsonSchema.$id, contractId, `${filename} has an unexpected contract ID.`);
      return [contractId, z.fromJSONSchema(preserveCheckedDateTimePatterns(jsonSchema))];
    },
  ));
  return new Map(entries);
}

function preserveCheckedDateTimePatterns(value) {
  if (Array.isArray(value)) return value.map(preserveCheckedDateTimePatterns);
  if (!value || typeof value !== "object") return value;
  const converted = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, preserveCheckedDateTimePatterns(child)]),
  );
  if (converted.format === "date-time" && typeof converted.pattern === "string") {
    delete converted.format;
  }
  return converted;
}

export function validatePlanningApiContract(schemas, contractId, body, label) {
  const schema = schemas.get(contractId);
  assert(schema, `${label} references an unavailable checked schema: ${contractId}`);
  const result = schema.safeParse(body);
  assert(
    result.success,
    `${label} does not match ${contractId}: ${result.error?.message ?? "invalid payload"}`,
  );
  return result.data;
}

export async function planningApiRequest({
  appUrl,
  body,
  contractId,
  expectedError = null,
  expectedStatus = 200,
  fetchImpl = fetch,
  label,
  method = "GET",
  path,
  schemas,
  token = null,
}) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetchImpl(new URL(path, appUrl), {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const responseBody = await response.json().catch(() => null);

  assert.equal(response.status, expectedStatus, `${label} returned ${response.status}: ${JSON.stringify(responseBody)}`);
  assert.equal(response.headers.get("x-everaft-contract"), contractId, `${label} returned the wrong contract header.`);
  assert.match(response.headers.get("cache-control") ?? "", /(?:^|,)\s*private\b/i, `${label} is not private.`);
  assert.match(response.headers.get("cache-control") ?? "", /(?:^|,)\s*no-store\b/i, `${label} is cacheable.`);
  assert.match(response.headers.get("vary") ?? "", /authorization/i, `${label} does not vary by authorization.`);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff", `${label} is missing nosniff.`);

  if (expectedError !== null) {
    assert.deepEqual(responseBody, { error: expectedError }, `${label} returned the wrong error contract.`);
    return responseBody;
  }
  return validatePlanningApiContract(schemas, contractId, responseBody, label);
}
