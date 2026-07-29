import { z } from "zod";
import { planningTablePlanSyncSchema } from "./validation.ts";

export const planningTablePlanResourceSchema = z.strictObject({
  schemaVersion: z.literal(1),
  workspaceId: z.string().uuid(),
  workspaceUpdatedAt: z.string().datetime({ offset: true }),
  tablePlan: planningTablePlanSyncSchema.strict(),
}).meta({
  title: "EverAft Planning Table Plan Resource v1",
  description: "Complete guest, table, seat and seating-rule state for web, iOS and Android clients.",
});

export const planningTablePlanUpdateRequestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  expectedWorkspaceUpdatedAt: z.string().datetime({ offset: true }),
  tablePlan: planningTablePlanSyncSchema.strict(),
}).meta({
  title: "EverAft Planning Table Plan Update Request v1",
  description: "Conflict-safe guest, table, seat and seating-rule update from a web, iOS or Android client.",
});

export const planningTablePlanUpdateSuccessSchema = z.strictObject({
  schemaVersion: z.literal(1),
  workspaceId: z.string().uuid(),
  savedAt: z.string().datetime({ offset: true }),
}).meta({
  title: "EverAft Planning Table Plan Update Success v1",
  description: "Workspace version returned after a Planning Hub table-plan sync succeeds.",
});

export const planningTablePlanUpdateRequestJsonSchema = jsonSchema(
  planningTablePlanUpdateRequestSchema,
  "urn:everaft:planning-table-plan-update-request:v1",
);
export const planningTablePlanResourceJsonSchema = jsonSchema(
  planningTablePlanResourceSchema,
  "urn:everaft:planning-table-plan-resource:v1",
);
export const planningTablePlanUpdateSuccessJsonSchema = jsonSchema(
  planningTablePlanUpdateSuccessSchema,
  "urn:everaft:planning-table-plan-update-success:v1",
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
