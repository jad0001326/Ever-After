import { z } from "zod";
import { budgetPlanSchema } from "@everaft/planning-domain/budget/validation";
import {
  planningWorkspaceImportSnapshotSchema,
  weddingProfileSchema,
} from "@everaft/planning-domain/planning-workspace/validation";

import { planningProfileContentSchema } from "@everaft/planning-contracts/planning-workspace/profile-api-schema";
import { planningWorkspaceResourceSchema } from "@everaft/planning-contracts/planning-workspace/workspace-api-schema";

export const planningConnectionVersionsSchema = z.strictObject({
  workspaceUpdatedAt: z.string().datetime({ offset: true }),
  budgetUpdatedAt: z.string().datetime({ offset: true }),
  profileUpdatedAt: z.string().datetime({ offset: true }),
});

export const planningConnectedPlanResourceSchema = z.strictObject({
  schemaVersion: z.literal(1),
  workspace: planningWorkspaceResourceSchema,
  budgetPlan: budgetPlanSchema.strict(),
  profile: weddingProfileSchema,
  versions: planningConnectionVersionsSchema,
}).meta({
  title: "EverAft Connected Plan Resource v1",
  description: "Canonical connected workspace, budget and profile state after import or setup.",
});

export const planningWorkspaceImportRequestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  snapshot: planningWorkspaceImportSnapshotSchema,
  budgetPlan: budgetPlanSchema.strict(),
  targetWorkspaceId: z.string().uuid().nullable(),
  expectedWorkspaceUpdatedAt: z.string().datetime({ offset: true }).nullable(),
}).superRefine((input, context) => {
  if (input.snapshot.budgetPlanId !== input.budgetPlan.id) {
    context.addIssue({
      code: "custom",
      message: "The workspace and budget plan must match.",
      path: ["snapshot", "budgetPlanId"],
    });
  }
  if (input.targetWorkspaceId && !input.expectedWorkspaceUpdatedAt) {
    context.addIssue({
      code: "custom",
      message: "An existing workspace requires its expected version.",
      path: ["expectedWorkspaceUpdatedAt"],
    });
  }
  if (!input.targetWorkspaceId && input.expectedWorkspaceUpdatedAt) {
    context.addIssue({
      code: "custom",
      message: "A new workspace cannot have a previous version.",
      path: ["expectedWorkspaceUpdatedAt"],
    });
  }
});

export const planningSetupUpdateRequestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  expectedVersions: z.strictObject({
    workspaceUpdatedAt: z.string().datetime({ offset: true }),
    budgetUpdatedAt: z.string().datetime({ offset: true }),
    profileUpdatedAt: z.string().datetime({ offset: true }).nullable(),
  }),
  setup: z.strictObject({
    totalBudgetPence: z.number().int().min(0).max(1_000_000_000),
    profile: planningProfileContentSchema,
  }),
}).meta({
  title: "EverAft Connected Setup Update Request v1",
  description: "Conflict-safe atomic budget and wedding-profile setup update.",
});

export type PlanningConnectedPlanResource = z.infer<
  typeof planningConnectedPlanResourceSchema
>;
export type PlanningWorkspaceImportRequest = z.infer<
  typeof planningWorkspaceImportRequestSchema
>;
export type PlanningSetupUpdateRequest = z.infer<
  typeof planningSetupUpdateRequestSchema
>;

export const planningConnectedPlanResourceJsonSchema = jsonSchema(
  planningConnectedPlanResourceSchema,
  "urn:everaft:planning-connected-plan-resource:v1",
);
export const planningWorkspaceImportRequestJsonSchema = jsonSchema(
  planningWorkspaceImportRequestSchema,
  "urn:everaft:planning-workspace-import-request:v1",
);
export const planningSetupUpdateRequestJsonSchema = jsonSchema(
  planningSetupUpdateRequestSchema,
  "urn:everaft:planning-setup-update-request:v1",
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
