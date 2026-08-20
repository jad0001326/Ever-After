import { z } from "zod";

const nonNegativeInteger = z.number().int().nonnegative();
const nullableDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

const paymentDeadlineSchema = z.strictObject({
  itemId: z.string().min(1),
  itemName: z.string().min(1),
  installmentId: z.string().min(1).nullable(),
  label: z.string().min(1),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountPence: nonNegativeInteger.nullable(),
  outstandingPence: nonNegativeInteger.nullable(),
  urgency: z.enum(["overdue", "due_soon", "upcoming"]),
});

const recommendationTargetSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("payment"),
    itemId: z.string().min(1),
  }),
  z.strictObject({
    kind: z.literal("venue-search"),
  }),
  z.strictObject({
    kind: z.literal("photography-search"),
  }),
  z.strictObject({
    kind: z.literal("supplier-roadmap"),
  }),
  z.strictObject({
    kind: z.literal("plan-item"),
    itemId: z.string().min(1),
    fallback: z.enum(["venue-search", "photography-search"]),
  }),
  z.strictObject({
    kind: z.literal("organise"),
    anchor: z.enum([
      "planning-tasks-title",
      "guest-readiness-title",
    ]).nullable(),
  }),
]);

export const planningDashboardSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime({ offset: true }),
  workspace: z.strictObject({
    id: z.string().min(1),
    name: z.string().min(1),
    budgetPlanId: z.string().min(1),
  }),
  versions: z.strictObject({
    workspaceUpdatedAt: z.string().datetime({ offset: true }),
    budgetUpdatedAt: z.string().datetime({ offset: true }),
  }),
  wedding: z.strictObject({
    date: nullableDate,
    guestCount: z.number().int().positive().nullable(),
    location: z.string().min(1).nullable(),
    currency: z.enum(["GBP", "EUR", "USD"]),
    profileCompletionPercentage: z.number().int().min(0).max(100),
  }),
  budget: z.strictObject({
    totalBudgetPence: nonNegativeInteger,
    spendableBudgetPence: nonNegativeInteger,
    plannedPence: nonNegativeInteger,
    committedPence: nonNegativeInteger,
    paidPence: nonNegativeInteger,
    remainingPence: z.number().int(),
    outstandingCommittedPence: nonNegativeInteger,
    uncommittedPlannedPence: nonNegativeInteger,
    percentUsed: nonNegativeInteger,
    missingPriceCount: nonNegativeInteger,
    activeItemCount: nonNegativeInteger,
    health: z.enum(["over", "close", "healthy"]),
  }),
  payments: z.strictObject({
    overdueCount: nonNegativeInteger,
    dueSoonCount: nonNegativeInteger,
    upcomingCount: nonNegativeInteger,
    next: paymentDeadlineSchema.nullable(),
  }),
  tasks: z.strictObject({
    openCount: nonNegativeInteger,
    overdueCount: nonNegativeInteger,
    dueTodayCount: nonNegativeInteger,
    dueSoonCount: nonNegativeInteger,
    nextTaskId: z.string().min(1).nullable(),
  }),
  guests: z.strictObject({
    totalCount: nonNegativeInteger,
    acceptedCount: nonNegativeInteger,
    pendingCount: nonNegativeInteger,
    declinedCount: nonNegativeInteger,
    dietaryCount: nonNegativeInteger,
    seatingGuestCount: nonNegativeInteger,
    assignedCount: nonNegativeInteger,
    unassignedCount: nonNegativeInteger,
    targetGap: nonNegativeInteger,
  }),
  recommendation: z.strictObject({
    stage: z.enum([
      "payments",
      "venue",
      "photography",
      "suppliers",
      "guests",
      "tables",
      "tasks",
    ]),
    title: z.string().min(1),
    reason: z.string().min(1),
    target: recommendationTargetSchema,
  }),
}).meta({
  title: "EverAft Planning Dashboard Snapshot v1",
  description: "Platform-neutral Planning Hub dashboard state for web, iOS and Android clients.",
});

const generatedJsonSchema = z.toJSONSchema(planningDashboardSnapshotSchema, {
  target: "draft-2020-12",
  io: "output",
}) as Record<string, unknown>;

export const planningDashboardSnapshotJsonSchema = Object.freeze({
  $schema: generatedJsonSchema.$schema,
  $id: "urn:everaft:planning-dashboard-snapshot:v1",
  ...Object.fromEntries(
    Object.entries(generatedJsonSchema).filter(([key]) => key !== "$schema"),
  ),
});

export type PlanningDashboardSnapshot = z.infer<
  typeof planningDashboardSnapshotSchema
>;
