import { z } from "zod";

import { createPlanningId } from "../ids";
import { getGuestRsvpStatus, type GuestRsvpStatus } from "./guests";
import type { TablePlan, TablePlanGuest } from "./types";

export const maximumTablePlanGuests = 1000;

export type TablePlanGuestInput = Readonly<{
  name: string;
  email?: string | null;
  rsvpStatus?: GuestRsvpStatus;
  dietaryNotes?: string | null;
}>;

export type TablePlanGuestChanges = Partial<TablePlanGuestInput>;

type GuestMutationOptions = Readonly<{
  createId?: () => string;
  now?: Date;
}>;

export class TablePlanGuestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TablePlanGuestValidationError";
  }
}

const guestNameSchema = z.string().trim().min(1).max(160);
const guestEmailSchema = z.email().max(320);
const guestDietaryNotesSchema = z.string().trim().max(2000);

export function parseTablePlanGuestNames(value: string) {
  return value
    .split(/[\n,;]+/)
    .map((name) => normalizeGuestName(name))
    .filter((name): name is string => name !== null);
}

export function addTablePlanGuest(
  plan: TablePlan,
  input: TablePlanGuestInput,
  options: GuestMutationOptions = {},
): TablePlan {
  assertGuestCapacity(plan.guests.length, 1);
  const guest = createGuest(input, options.createId ?? createPlanningId);
  return withGuests(plan, [...plan.guests, guest], options.now);
}

export function addTablePlanGuests(
  plan: TablePlan,
  names: readonly string[],
  options: GuestMutationOptions = {},
): TablePlan {
  const normalizedNames = names.map((name) => {
    const normalized = normalizeGuestName(name);
    if (!normalized) throw new TablePlanGuestValidationError("Enter at least one guest name.");
    return normalized;
  });
  if (normalizedNames.length === 0) {
    throw new TablePlanGuestValidationError("Enter at least one guest name.");
  }
  assertGuestCapacity(plan.guests.length, normalizedNames.length);
  const createId = options.createId ?? createPlanningId;
  const guests = normalizedNames.map((name) => createGuest({ name }, createId));
  return withGuests(plan, [...plan.guests, ...guests], options.now);
}

export function updateTablePlanGuest(
  plan: TablePlan,
  guestId: string,
  changes: TablePlanGuestChanges,
  now = new Date(),
): TablePlan {
  const index = plan.guests.findIndex((guest) => guest.id === guestId);
  if (index < 0) throw new TablePlanGuestValidationError("This guest is no longer available.");
  const current = plan.guests[index];
  const rsvpStatus = changes.rsvpStatus ?? getGuestRsvpStatus(current);
  const next: TablePlanGuest = {
    ...current,
    ...(changes.name !== undefined ? { name: requiredGuestName(changes.name) } : {}),
    ...(changes.email !== undefined ? { email: normalizeGuestEmail(changes.email) } : {}),
    ...(changes.dietaryNotes !== undefined
      ? { dietaryNotes: normalizeDietaryNotes(changes.dietaryNotes) }
      : {}),
    ...(changes.rsvpStatus !== undefined ? { rsvpStatus } : {}),
    ...(rsvpStatus === "declined" ? { tableId: null, seatIndex: null } : {}),
  };
  const guests = [...plan.guests];
  guests[index] = next;
  return withGuests(plan, guests, now);
}

export function removeTablePlanGuest(
  plan: TablePlan,
  guestId: string,
  now = new Date(),
): TablePlan {
  if (!plan.guests.some((guest) => guest.id === guestId)) {
    throw new TablePlanGuestValidationError("This guest is no longer available.");
  }
  return {
    ...plan,
    guests: plan.guests.filter((guest) => guest.id !== guestId),
    rules: plan.rules.filter(
      (rule) => rule.personAId !== guestId && rule.personBId !== guestId,
    ),
    updatedAt: now.toISOString(),
  };
}

export function searchTablePlanGuests(
  guests: readonly TablePlanGuest[],
  query: string,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase("en-GB");
  return guests
    .filter((guest) => !normalizedQuery
      || guest.name.toLocaleLowerCase("en-GB").includes(normalizedQuery)
      || guest.email?.toLocaleLowerCase("en-GB").includes(normalizedQuery))
    .sort((left, right) => left.name.localeCompare(right.name, "en-GB")
      || left.id.localeCompare(right.id));
}

function createGuest(
  input: TablePlanGuestInput,
  createId: () => string,
): TablePlanGuest {
  return {
    id: createId(),
    name: requiredGuestName(input.name),
    email: normalizeGuestEmail(input.email ?? null),
    rsvpStatus: input.rsvpStatus ?? "pending",
    dietaryNotes: normalizeDietaryNotes(input.dietaryNotes ?? null),
    tableId: null,
    seatIndex: null,
  };
}

function normalizeGuestName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = guestNameSchema.safeParse(trimmed);
  if (!parsed.success) {
    throw new TablePlanGuestValidationError("Guest names must be 160 characters or fewer.");
  }
  return parsed.data;
}

function requiredGuestName(value: string) {
  const normalized = normalizeGuestName(value);
  if (!normalized) throw new TablePlanGuestValidationError("Enter a guest name.");
  return normalized;
}

function normalizeGuestEmail(value: string | null) {
  const normalized = value?.trim().toLocaleLowerCase("en-GB") ?? "";
  if (!normalized) return null;
  const parsed = guestEmailSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new TablePlanGuestValidationError("Enter a valid guest email address.");
  }
  return parsed.data;
}

function normalizeDietaryNotes(value: string | null) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  const parsed = guestDietaryNotesSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new TablePlanGuestValidationError("Dietary or accessibility notes must be 2,000 characters or fewer.");
  }
  return parsed.data;
}

function assertGuestCapacity(currentCount: number, addedCount: number) {
  if (currentCount + addedCount > maximumTablePlanGuests) {
    throw new TablePlanGuestValidationError(
      `A table plan can contain up to ${maximumTablePlanGuests.toLocaleString("en-GB")} guests.`,
    );
  }
}

function withGuests(
  plan: TablePlan,
  guests: TablePlanGuest[],
  now = new Date(),
): TablePlan {
  return { ...plan, guests, updatedAt: now.toISOString() };
}
