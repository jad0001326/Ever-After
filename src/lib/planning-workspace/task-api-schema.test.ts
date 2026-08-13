import { describe, expect, it } from "vitest";
import checkedCollection from "../../../docs/planning-hub/contracts/planning-task-collection.v1.schema.json";
import checkedCreate from "../../../docs/planning-hub/contracts/planning-task-create-request.v1.schema.json";
import checkedDelete from "../../../docs/planning-hub/contracts/planning-task-delete-request.v1.schema.json";
import checkedDeleteSuccess from "../../../docs/planning-hub/contracts/planning-task-delete-success.v1.schema.json";
import checkedResource from "../../../docs/planning-hub/contracts/planning-task-resource.v1.schema.json";
import checkedUpdate from "../../../docs/planning-hub/contracts/planning-task-update-request.v1.schema.json";
import {
  planningTaskCollectionJsonSchema,
  planningTaskCollectionSchema,
  planningTaskCreateRequestJsonSchema,
  planningTaskCreateRequestSchema,
  planningTaskDeleteRequestJsonSchema,
  planningTaskDeleteRequestSchema,
  planningTaskDeleteSuccessJsonSchema,
  planningTaskDeleteSuccessSchema,
  planningTaskResourceJsonSchema,
  planningTaskResourceSchema,
  planningTaskUpdateRequestJsonSchema,
  planningTaskUpdateRequestSchema,
} from "./task-api-schema";

describe("Planning Task API contracts", () => {
  it("accepts strict task resources and bounded collection pages", () => {
    const task = taskResource();
    const collection = {
      schemaVersion: 1,
      workspaceId: task.workspaceId,
      tasks: [task],
      page: { limit: 50, offset: 0, hasMore: false },
    };

    expect(planningTaskResourceSchema.parse(task)).toEqual(task);
    expect(planningTaskCollectionSchema.parse(collection)).toEqual(collection);
    expect(planningTaskCollectionSchema.safeParse({
      ...collection,
      page: { ...collection.page, limit: 101 },
    }).success).toBe(false);
  });

  it("accepts a complete create request but rejects identity escape fields", () => {
    const request = {
      schemaVersion: 1,
      task: {
        id: "70000000-0000-4000-8000-000000000007",
        ...taskContent(),
      },
    };

    expect(planningTaskCreateRequestSchema.parse(request)).toEqual(request);
    expect(planningTaskCreateRequestSchema.safeParse({
      ...request,
      task: {
        ...request.task,
        workspaceId: "80000000-0000-4000-8000-000000000008",
      },
    }).success).toBe(false);
  });

  it("requires a non-empty strict update at an exact version", () => {
    const update = {
      schemaVersion: 1,
      expectedTaskUpdatedAt: "2026-07-29T12:00:00.000Z",
      changes: { status: "done" },
    };

    expect(planningTaskUpdateRequestSchema.parse(update)).toEqual(update);
    expect(planningTaskUpdateRequestSchema.safeParse({
      ...update,
      changes: {},
    }).success).toBe(false);
    expect(planningTaskUpdateRequestSchema.safeParse({
      ...update,
      changes: { status: "done", updatedAt: "client-version" },
    }).success).toBe(false);
  });

  it("defines exact-version deletion and strict confirmation", () => {
    const request = {
      schemaVersion: 1,
      expectedTaskUpdatedAt: "2026-07-29T12:00:00.000Z",
    };
    const success = {
      schemaVersion: 1,
      taskId: "70000000-0000-4000-8000-000000000007",
      deleted: true,
    };

    expect(planningTaskDeleteRequestSchema.parse(request)).toEqual(request);
    expect(planningTaskDeleteSuccessSchema.parse(success)).toEqual(success);
    expect(planningTaskDeleteSuccessSchema.safeParse({
      ...success,
      deleted: false,
    }).success).toBe(false);
  });

  it("keeps all checked language-neutral task schemas current", () => {
    expect(checkedResource).toEqual(planningTaskResourceJsonSchema);
    expect(checkedCollection).toEqual(planningTaskCollectionJsonSchema);
    expect(checkedCreate).toEqual(planningTaskCreateRequestJsonSchema);
    expect(checkedUpdate).toEqual(planningTaskUpdateRequestJsonSchema);
    expect(checkedDelete).toEqual(planningTaskDeleteRequestJsonSchema);
    expect(checkedDeleteSuccess).toEqual(
      planningTaskDeleteSuccessJsonSchema,
    );
    for (const schema of [
      checkedResource,
      checkedCollection,
      checkedCreate,
      checkedUpdate,
      checkedDelete,
      checkedDeleteSuccess,
    ]) {
      expect(schema).toMatchObject({ additionalProperties: false });
    }
  });
});

function taskContent() {
  return {
    title: "Confirm final guest numbers",
    notes: null,
    category: "guests" as const,
    status: "todo" as const,
    dueDate: "2027-07-01",
    sortOrder: 3,
  };
}

function taskResource() {
  return {
    schemaVersion: 1 as const,
    id: "70000000-0000-4000-8000-000000000007",
    workspaceId: "60000000-0000-4000-8000-000000000006",
    ...taskContent(),
    createdAt: "2026-07-29T11:00:00.000Z",
    updatedAt: "2026-07-29T12:00:00.000Z",
  };
}
