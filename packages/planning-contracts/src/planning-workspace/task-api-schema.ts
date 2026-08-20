import { z } from "zod";

const nullableDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const taskCategory = z.enum([
  "venue",
  "photography",
  "budget",
  "guests",
  "tables",
  "general",
]);
const taskStatus = z.enum(["todo", "in_progress", "done"]);

const taskContentShape = {
  title: z.string().trim().min(1).max(240),
  notes: z.string().trim().max(5000).nullable(),
  category: taskCategory,
  status: taskStatus,
  dueDate: nullableDate,
  sortOrder: z.number().int().min(0).max(100000),
};

export const planningTaskResourceSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  ...taskContentShape,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).meta({
  title: "EverAft Planning Task Resource v1",
  description: "A versioned Planning Hub task for web, iOS and Android clients.",
});

export const planningTaskCollectionSchema = z.strictObject({
  schemaVersion: z.literal(1),
  workspaceId: z.string().uuid(),
  tasks: z.array(planningTaskResourceSchema).max(100),
  page: z.strictObject({
    limit: z.number().int().min(1).max(100),
    offset: z.number().int().min(0).max(100000),
    hasMore: z.boolean(),
  }),
}).meta({
  title: "EverAft Planning Task Collection v1",
  description: "A bounded page of workspace tasks.",
});

export const planningTaskCreateRequestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  task: z.strictObject({
    id: z.string().uuid().optional(),
    ...taskContentShape,
  }),
}).meta({
  title: "EverAft Planning Task Create Request v1",
  description: "A complete new task with an optional stable client-generated identifier.",
});

export const planningTaskUpdateRequestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  expectedTaskUpdatedAt: z.string().datetime({ offset: true }),
  changes: z.strictObject(taskContentShape).partial().refine(
    (value) => Object.keys(value).length > 0,
    "At least one task field is required.",
  ),
}).meta({
  title: "EverAft Planning Task Update Request v1",
  description: "A partial task update guarded by the exact task version.",
});

export const planningTaskDeleteRequestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  expectedTaskUpdatedAt: z.string().datetime({ offset: true }),
}).meta({
  title: "EverAft Planning Task Delete Request v1",
  description: "A task deletion guarded by the exact task version.",
});

export const planningTaskDeleteSuccessSchema = z.strictObject({
  schemaVersion: z.literal(1),
  taskId: z.string().uuid(),
  deleted: z.literal(true),
}).meta({
  title: "EverAft Planning Task Delete Success v1",
  description: "Confirmation that one exact task version was deleted.",
});

export const planningTaskResourceJsonSchema = jsonSchema(
  planningTaskResourceSchema,
  "urn:everaft:planning-task-resource:v1",
);
export const planningTaskCollectionJsonSchema = jsonSchema(
  planningTaskCollectionSchema,
  "urn:everaft:planning-task-collection:v1",
);
export const planningTaskCreateRequestJsonSchema = jsonSchema(
  planningTaskCreateRequestSchema,
  "urn:everaft:planning-task-create-request:v1",
);
export const planningTaskUpdateRequestJsonSchema = jsonSchema(
  planningTaskUpdateRequestSchema,
  "urn:everaft:planning-task-update-request:v1",
);
export const planningTaskDeleteRequestJsonSchema = jsonSchema(
  planningTaskDeleteRequestSchema,
  "urn:everaft:planning-task-delete-request:v1",
);
export const planningTaskDeleteSuccessJsonSchema = jsonSchema(
  planningTaskDeleteSuccessSchema,
  "urn:everaft:planning-task-delete-success:v1",
);

function jsonSchema(schema: z.ZodType, id: string) {
  const generated = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    io: "output",
  }) as Record<string, unknown>;
  return Object.freeze({
    $schema: generated.$schema,
    $id: id,
    ...Object.fromEntries(
      Object.entries(generated).filter(([key]) => key !== "$schema"),
    ),
  });
}
