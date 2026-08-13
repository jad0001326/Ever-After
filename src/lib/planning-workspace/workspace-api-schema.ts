import { z } from "zod";

export const planningWorkspaceResourceSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  budgetPlanId: z.string().min(1).max(100).nullable(),
  role: z.enum(["owner", "partner"]),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).meta({
  title: "EverAft Planning Workspace Resource v1",
  description: "An RLS-visible Planning Hub workspace and the caller's role.",
});

export const planningWorkspaceCollectionSchema = z.strictObject({
  schemaVersion: z.literal(1),
  workspaces: z.array(planningWorkspaceResourceSchema).max(50),
  page: z.strictObject({
    limit: z.number().int().min(1).max(50),
    offset: z.number().int().min(0).max(100000),
    hasMore: z.boolean(),
  }),
}).meta({
  title: "EverAft Planning Workspace Collection v1",
  description: "A bounded page of Planning Hub workspaces visible to the caller.",
});

export const planningWorkspaceCollectionJsonSchema = jsonSchema(
  planningWorkspaceCollectionSchema,
  "urn:everaft:planning-workspace-collection:v1",
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
