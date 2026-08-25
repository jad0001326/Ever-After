import { budgetPlanSchema } from "@everaft/planning-domain/budget/validation";
import {
  planningTablePlanSyncSchema,
  weddingProfileSchema,
} from "@everaft/planning-domain/planning-workspace/validation";
import { z } from "zod";

import type { DevicePlanData } from "./device-plan-model";

export const maximumDevicePlanBytes = 1024 * 1024;

const taskSchema = z.strictObject({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(240),
  notes: z.string().trim().max(5000).nullable(),
  category: z.enum(["venue", "photography", "budget", "guests", "tables", "general"]),
  status: z.enum(["todo", "in_progress", "done"]),
  dueDate: z.iso.date().nullable(),
  sortOrder: z.number().int().min(0).max(100000),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

const workspaceSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  cloudWorkspaceId: z.string().uuid().nullable(),
  ownerId: z.string().uuid().nullable(),
  budgetPlanId: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(120),
  profile: weddingProfileSchema,
  tasks: z.array(taskSchema).max(500),
  tablePlan: planningTablePlanSyncSchema,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

const devicePlanSchema = z.strictObject({
  format: z.literal("everaft-device-plan"),
  formatVersion: z.literal(1),
  localPreferences: z.strictObject({
    weddingSeason: z.string().trim().min(1).max(80).nullable(),
  }),
  budgetPlan: budgetPlanSchema,
  workspace: workspaceSchema,
}).superRefine((data, context) => {
  if (data.workspace.budgetPlanId !== data.budgetPlan.id) {
    context.addIssue({
      code: "custom",
      message: "The workspace must reference the stored budget plan.",
      path: ["workspace", "budgetPlanId"],
    });
  }
  if (data.workspace.cloudWorkspaceId !== null || data.workspace.ownerId !== null) {
    context.addIssue({
      code: "custom",
      message: "A device-only plan cannot claim cloud ownership.",
      path: ["workspace", "cloudWorkspaceId"],
    });
  }
});

const recoveryFixtureSchema = z.strictObject({
  fixture: z.literal("everaft-device-plan-recovery"),
  fixtureVersion: z.literal(1),
  exportedAt: z.iso.datetime({ offset: true }),
  data: devicePlanSchema,
});

export class DevicePlanCorruptError extends Error {
  constructor(message = "The saved plan could not be validated.") {
    super(message);
    this.name = "DevicePlanCorruptError";
  }
}

export function encodeDevicePlan(data: DevicePlanData) {
  const validated = devicePlanSchema.parse(data);
  return encodeWithinLimit(validated);
}

export function decodeDevicePlan(encoded: string): DevicePlanData {
  assertWithinLimit(encoded);
  try {
    return devicePlanSchema.parse(JSON.parse(encoded)) as DevicePlanData;
  } catch (error) {
    if (error instanceof DevicePlanCorruptError) throw error;
    throw new DevicePlanCorruptError();
  }
}

export function encodeRecoveryFixture(data: DevicePlanData, exportedAt = new Date()) {
  return encodeWithinLimit({
    fixture: "everaft-device-plan-recovery",
    fixtureVersion: 1,
    exportedAt: exportedAt.toISOString(),
    data: devicePlanSchema.parse(data),
  });
}

export function decodeRecoveryFixture(encoded: string): DevicePlanData {
  assertWithinLimit(encoded);
  try {
    return recoveryFixtureSchema.parse(JSON.parse(encoded)).data as DevicePlanData;
  } catch (error) {
    if (error instanceof DevicePlanCorruptError) throw error;
    throw new DevicePlanCorruptError("The recovery fixture is invalid or unsupported.");
  }
}

function encodeWithinLimit(value: unknown) {
  const encoded = JSON.stringify(value);
  assertWithinLimit(encoded);
  return encoded;
}

function assertWithinLimit(value: string) {
  if (new TextEncoder().encode(value).byteLength > maximumDevicePlanBytes) {
    throw new DevicePlanCorruptError("The saved plan exceeds the one-megabyte safety limit.");
  }
}
