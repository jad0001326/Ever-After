import { z } from "zod";
import { budgetPlanSchema } from "../budget/validation.ts";

export const planningBudgetUpdateRequestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  expectedBudgetUpdatedAt: z.string().datetime({ offset: true }),
  plan: budgetPlanSchema.strict(),
}).superRefine((request, context) => {
  if (request.plan.updatedAt !== request.expectedBudgetUpdatedAt) {
    context.addIssue({
      code: "custom",
      path: ["plan", "updatedAt"],
      message: "The plan version must match expectedBudgetUpdatedAt.",
    });
  }
}).meta({
  title: "EverAft Planning Budget Update Request v1",
  description: "Conflict-safe full budget-plan update from a web, iOS or Android client.",
});

export const planningBudgetUpdateSuccessSchema = z.strictObject({
  schemaVersion: z.literal(1),
  budgetPlanId: z.string().min(1).max(100),
  savedAt: z.string().datetime({ offset: true }),
}).meta({
  title: "EverAft Planning Budget Update Success v1",
  description: "Version returned after a Planning Hub budget update succeeds.",
});

export type PlanningBudgetUpdateRequest = z.infer<
  typeof planningBudgetUpdateRequestSchema
>;
export type PlanningBudgetUpdateSuccess = z.infer<
  typeof planningBudgetUpdateSuccessSchema
>;

export const planningBudgetUpdateRequestJsonSchema = jsonSchema(
  planningBudgetUpdateRequestSchema,
  "urn:everaft:planning-budget-update-request:v1",
);
export const planningBudgetUpdateSuccessJsonSchema = jsonSchema(
  planningBudgetUpdateSuccessSchema,
  "urn:everaft:planning-budget-update-success:v1",
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
