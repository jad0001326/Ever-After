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
  id: planningRecordIdSchema.optional(),
  workspaceId: planningWorkspaceIdSchema,
  title: z.string().trim().min(1).max(240),
  notes: z.string().trim().max(5000).nullable().default(null),
  category: z.enum(["venue", "photography", "budget", "guests", "tables", "general"]).default("general"),
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
  dueDate: z.iso.date().nullable().default(null),
  sortOrder: z.number().int().min(0).max(100000).default(0)
});

export const planningTaskUpdateSchema = planningTaskInputSchema
  .omit({ id: true, workspaceId: true })
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

export const planningTablePlanSyncSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(120),
  guests: z.array(z.object({
    id: planningRecordIdSchema,
    name: z.string().trim().min(1).max(160),
    email: optionalPlanningEmailSchema.optional(),
    rsvpStatus: z.enum(["pending", "accepted", "declined"]).optional(),
    dietaryNotes: z.string().trim().max(2000).nullable().optional(),
    tableId: planningRecordIdSchema.nullable(),
    seatIndex: z.number().int().min(0).max(19).nullable(),
  })).max(1000),
  tables: z.array(z.object({
    id: planningRecordIdSchema,
    name: z.string().trim().min(1).max(120),
    capacity: z.number().int().min(2).max(20),
    locked: z.boolean(),
  })).max(200),
  rules: z.array(z.object({
    id: planningRecordIdSchema,
    personAId: planningRecordIdSchema,
    personBId: planningRecordIdSchema,
    type: z.enum(["must_next_to", "prefer_next_to", "must_not_next_to", "must_separate"]),
  }).refine((value) => value.personAId !== value.personBId)).max(2000),
  updatedAt: z.string(),
}).superRefine((plan, context) => {
  const tableIds = new Set(plan.tables.map((table) => table.id));
  const guestIds = new Set(plan.guests.map((guest) => guest.id));
  for (const guest of plan.guests) {
    if ((guest.tableId === null) !== (guest.seatIndex === null)) {
      context.addIssue({ code: "custom", message: "A guest needs both a table and seat, or neither." });
    }
    if (guest.tableId && !tableIds.has(guest.tableId)) {
      context.addIssue({ code: "custom", message: "A guest references an unavailable table." });
    }
  }
  for (const rule of plan.rules) {
    if (!guestIds.has(rule.personAId) || !guestIds.has(rule.personBId)) {
      context.addIssue({ code: "custom", message: "A seating rule references an unavailable guest." });
    }
  }
});

export const createPlanningInviteSchema = z.object({
  workspaceId: planningWorkspaceIdSchema,
  email: z.preprocess(
    (value) => typeof value === "string" ? value.trim().toLowerCase() : value,
    z.email().max(320)
  )
});

export const planningInviteTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, "Invitation tokens must use the generated secure format.");

const planningImportTaskSchema = z.object({
  id: planningRecordIdSchema,
  title: z.string().trim().min(1).max(240),
  notes: z.string().trim().max(5000).nullable(),
  category: z.enum(["venue", "photography", "budget", "guests", "tables", "general"]),
  status: z.enum(["todo", "in_progress", "done"]),
  dueDate: z.iso.date().nullable(),
  sortOrder: z.number().int().min(0).max(100000)
});

const planningImportGuestSchema = z.object({
  id: planningRecordIdSchema,
  name: z.string().trim().min(1).max(160),
  email: optionalPlanningEmailSchema,
  rsvpStatus: z.enum(["pending", "accepted", "declined"]),
  dietaryNotes: z.string().trim().max(2000).nullable()
});

const planningImportTableSchema = z.object({
  id: planningRecordIdSchema,
  name: z.string().trim().min(1).max(120),
  capacity: z.number().int().min(2).max(20),
  locked: z.boolean()
});

const planningImportSeatSchema = z.object({
  guestId: planningRecordIdSchema,
  tableId: planningRecordIdSchema,
  seatIndex: z.number().int().min(0).max(19)
});

const planningImportRuleSchema = z.object({
  id: planningRecordIdSchema,
  personAId: planningRecordIdSchema,
  personBId: planningRecordIdSchema,
  type: z.enum(["must_next_to", "prefer_next_to", "must_not_next_to", "must_separate"])
});

const weddingProfileContentShape = {
  schemaVersion: z.literal(1),
  weddingDate: z.iso.date().nullable(),
  guestCount: z.number().int().min(1).max(10000).nullable(),
  location: z.string().trim().min(1).max(160).nullable(),
  dateFlexibility: z.enum(["fixed", "few_days", "few_weeks", "season_only", "not_set"]),
  locationFlexible: z.boolean(),
  priorities: z.array(z.enum([
    "venue",
    "guest_experience",
    "photography",
    "food",
    "music",
    "style",
    "accommodation",
    "accessibility",
    "sustainability",
    "value"
  ])).max(5),
  venueStyles: z.array(z.string().trim().min(1).max(80)).max(8),
  photographyStyles: z.array(z.string().trim().min(1).max(80)).max(8),
  vision: z.string().trim().max(1000).nullable(),
};

function validateWeddingProfileChoices(
  profile: {
    priorities: string[];
    venueStyles: string[];
    photographyStyles: string[];
  },
  context: z.RefinementCtx,
) {
  for (const field of ["priorities", "venueStyles", "photographyStyles"] as const) {
    if (new Set(profile[field]).size !== profile[field].length) {
      context.addIssue({
        code: "custom",
        message: `${field} cannot contain duplicate choices.`,
        path: [field]
      });
    }
  }
}

export const weddingProfileContentSchema = z
  .strictObject(weddingProfileContentShape)
  .superRefine(validateWeddingProfileChoices);

export const weddingProfileSchema = z
  .strictObject({
    ...weddingProfileContentShape,
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .superRefine(validateWeddingProfileChoices);

export const planningWorkspaceImportSnapshotSchema = z.object({
  id: planningWorkspaceIdSchema,
  budgetPlanId: budgetPlanIdSchema,
  name: planningWorkspaceNameSchema,
  profile: weddingProfileSchema,
  tasks: z.array(planningImportTaskSchema).max(500),
  guests: z.array(planningImportGuestSchema).max(1000),
  tables: z.array(planningImportTableSchema).max(200),
  seats: z.array(planningImportSeatSchema).max(1000),
  rules: z.array(planningImportRuleSchema).max(2000)
}).superRefine((snapshot, context) => {
  const ensureUnique = (values: string[], path: string, label: string) => {
    if (new Set(values).size !== values.length) {
      context.addIssue({
        code: "custom",
        message: `Duplicate ${label} identifiers are not allowed.`,
        path: [path]
      });
    }
  };

  ensureUnique(snapshot.tasks.map((task) => task.id), "tasks", "task");
  ensureUnique(snapshot.guests.map((guest) => guest.id), "guests", "guest");
  ensureUnique(snapshot.tables.map((table) => table.id), "tables", "table");
  ensureUnique(snapshot.rules.map((rule) => rule.id), "rules", "seating rule");

  const guests = new Set(snapshot.guests.map((guest) => guest.id));
  const tables = new Map(snapshot.tables.map((table) => [table.id, table]));
  const seatedGuests = new Set<string>();
  const occupiedSeats = new Set<string>();

  snapshot.seats.forEach((seat, index) => {
    if (!guests.has(seat.guestId)) {
      context.addIssue({ code: "custom", message: "A seat references an unknown guest.", path: ["seats", index, "guestId"] });
    }
    const table = tables.get(seat.tableId);
    if (!table) {
      context.addIssue({ code: "custom", message: "A seat references an unknown table.", path: ["seats", index, "tableId"] });
    } else if (seat.seatIndex >= table.capacity) {
      context.addIssue({ code: "custom", message: "A seat is outside its table capacity.", path: ["seats", index, "seatIndex"] });
    }
    if (seatedGuests.has(seat.guestId)) {
      context.addIssue({ code: "custom", message: "A guest can only have one seat.", path: ["seats", index, "guestId"] });
    }
    seatedGuests.add(seat.guestId);
    const seatKey = `${seat.tableId}:${seat.seatIndex}`;
    if (occupiedSeats.has(seatKey)) {
      context.addIssue({ code: "custom", message: "A table seat can only hold one guest.", path: ["seats", index] });
    }
    occupiedSeats.add(seatKey);
  });

  snapshot.rules.forEach((rule, index) => {
    if (!guests.has(rule.personAId) || !guests.has(rule.personBId)) {
      context.addIssue({ code: "custom", message: "A seating rule references an unknown guest.", path: ["rules", index] });
    }
    if (rule.personAId === rule.personBId) {
      context.addIssue({ code: "custom", message: "A seating rule needs two different guests.", path: ["rules", index] });
    }
  });
});

export const importPlanningWorkspaceSchema = z.object({
  snapshot: planningWorkspaceImportSnapshotSchema,
  targetWorkspaceId: planningWorkspaceIdSchema.nullable(),
  expectedUpdatedAt: z.iso.datetime({ offset: true }).nullable()
}).superRefine((input, context) => {
  if (input.targetWorkspaceId && !input.expectedUpdatedAt) {
    context.addIssue({
      code: "custom",
      message: "An existing cloud workspace needs a version token.",
      path: ["expectedUpdatedAt"]
    });
  }
  if (!input.targetWorkspaceId && input.expectedUpdatedAt) {
    context.addIssue({
      code: "custom",
      message: "A new cloud workspace cannot have a previous version.",
      path: ["expectedUpdatedAt"]
    });
  }
});
