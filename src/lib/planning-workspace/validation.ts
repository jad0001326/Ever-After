import { z } from "zod";

export const planningWorkspaceIdSchema = z.string().uuid();
export const planningRecordIdSchema = z.string().uuid();
export const budgetPlanIdSchema = z.string().trim().min(1).max(100);
export const planningWorkspaceNameSchema = z.string().trim().min(1).max(120);

export const ensurePlanningWorkspaceSchema = z.object({
  budgetPlanId: budgetPlanIdSchema,
  name: planningWorkspaceNameSchema.default("Our wedding plan")
});

export const planningTaskInputSchema = z.object({
  workspaceId: planningWorkspaceIdSchema,
  title: z.string().trim().min(1).max(240),
  notes: z.string().trim().max(5000).nullable().default(null),
  category: z.enum(["venue", "photography", "budget", "guests", "tables", "general"]).default("general"),
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
  dueDate: z.iso.date().nullable().default(null),
  sortOrder: z.number().int().min(0).max(100000).default(0)
});

export const planningTaskUpdateSchema = planningTaskInputSchema
  .omit({ workspaceId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one task field is required.");

const optionalPlanningEmailSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const normalized = value.trim().toLowerCase();
    return normalized.length === 0 ? null : normalized;
  },
  z.email().max(320).nullable()
);

export const planningGuestInputSchema = z.object({
  workspaceId: planningWorkspaceIdSchema,
  name: z.string().trim().min(1).max(160),
  email: optionalPlanningEmailSchema.default(null),
  rsvpStatus: z.enum(["pending", "accepted", "declined"]).default("pending"),
  dietaryNotes: z.string().trim().max(2000).nullable().default(null),
  sortOrder: z.number().int().min(0).max(100000).default(0)
});

export const planningGuestUpdateSchema = planningGuestInputSchema
  .omit({ workspaceId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one guest field is required.");

export const planningTableInputSchema = z.object({
  workspaceId: planningWorkspaceIdSchema,
  name: z.string().trim().min(1).max(120),
  capacity: z.number().int().min(2).max(20).default(8),
  locked: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(100000).default(0)
});

export const planningTableUpdateSchema = planningTableInputSchema
  .omit({ workspaceId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one table field is required.");

export const planningSeatInputSchema = z.object({
  workspaceId: planningWorkspaceIdSchema,
  guestId: planningRecordIdSchema,
  tableId: planningRecordIdSchema,
  seatIndex: z.number().int().min(0).max(19)
});

export const planningSeatingRuleInputSchema = z.object({
  workspaceId: planningWorkspaceIdSchema,
  personAId: planningRecordIdSchema,
  personBId: planningRecordIdSchema,
  ruleType: z.enum(["must_next_to", "prefer_next_to", "must_not_next_to", "must_separate"])
}).refine((value) => value.personAId !== value.personBId, {
  message: "A seating rule needs two different guests."
});

export const createPlanningInviteSchema = z.object({
  workspaceId: planningWorkspaceIdSchema,
  email: z.preprocess(
    (value) => typeof value === "string" ? value.trim().toLowerCase() : value,
    z.email().max(320)
  )
});

export const planningInviteTokenSchema = z.string().min(32).max(256);
