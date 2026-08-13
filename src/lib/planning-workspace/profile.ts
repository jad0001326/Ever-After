import type { BudgetPlan } from "@/lib/budget/types";

export const weddingPriorityOptions = [
  "venue",
  "guest_experience",
  "photography",
  "food",
  "music",
  "style",
  "accommodation",
  "accessibility",
  "sustainability",
  "value",
] as const;

export type WeddingPriority = typeof weddingPriorityOptions[number];
export type WeddingDateFlexibility = "fixed" | "few_days" | "few_weeks" | "season_only" | "not_set";

export type WeddingProfile = {
  schemaVersion: 1;
  weddingDate: string | null;
  guestCount: number | null;
  location: string | null;
  dateFlexibility: WeddingDateFlexibility;
  locationFlexible: boolean;
  priorities: WeddingPriority[];
  venueStyles: string[];
  photographyStyles: string[];
  vision: string | null;
  updatedAt: string;
};

export function createWeddingProfile(
  budgetPlan?: Pick<BudgetPlan, "weddingDate" | "guestCount" | "location" | "updatedAt">,
): WeddingProfile {
  return {
    schemaVersion: 1,
    weddingDate: budgetPlan?.weddingDate ?? null,
    guestCount: budgetPlan?.guestCount ?? null,
    location: budgetPlan?.location ?? null,
    dateFlexibility: budgetPlan?.weddingDate ? "fixed" : "not_set",
    locationFlexible: false,
    priorities: [],
    venueStyles: [],
    photographyStyles: [],
    vision: null,
    updatedAt: budgetPlan?.updatedAt ?? new Date().toISOString(),
  };
}

export function restoreWeddingProfile(
  value: unknown,
  fallback: WeddingProfile,
): WeddingProfile {
  if (!value || typeof value !== "object") return fallback;
  const profile = value as Partial<WeddingProfile>;
  if (
    profile.schemaVersion !== 1
    || !isNullableDate(profile.weddingDate)
    || !isNullableBoundedString(profile.location, 160)
    || !(profile.guestCount === null || (
      typeof profile.guestCount === "number"
      && Number.isInteger(profile.guestCount)
      && profile.guestCount > 0
      && profile.guestCount <= 10_000
    ))
    || !["fixed", "few_days", "few_weeks", "season_only", "not_set"].includes(profile.dateFlexibility ?? "")
    || typeof profile.locationFlexible !== "boolean"
    || !isStringArray(profile.priorities)
    || !profile.priorities.every((priority) => weddingPriorityOptions.includes(priority as WeddingPriority))
    || profile.priorities.length > 5
    || !hasUniqueValues(profile.priorities)
    || !isBoundedStringArray(profile.venueStyles, 8, 80)
    || !hasUniqueValues(profile.venueStyles)
    || !isBoundedStringArray(profile.photographyStyles, 8, 80)
    || !hasUniqueValues(profile.photographyStyles)
    || !isNullableBoundedString(profile.vision, 1000)
    || typeof profile.updatedAt !== "string"
    || Number.isNaN(Date.parse(profile.updatedAt))
  ) {
    return fallback;
  }

  return profile as WeddingProfile;
}

export function profileCompletion(profile: WeddingProfile) {
  const checks = [
    profile.weddingDate !== null || profile.dateFlexibility === "season_only",
    profile.guestCount !== null,
    profile.location !== null,
    profile.priorities.length > 0,
    profile.venueStyles.length > 0 || profile.photographyStyles.length > 0,
  ];
  const completed = checks.filter(Boolean).length;
  return { completed, total: checks.length, percentage: Math.round((completed / checks.length) * 100) };
}

function isNullableBoundedString(value: unknown, maxLength: number): value is string | null {
  return value === null || (
    typeof value === "string"
    && value.trim().length > 0
    && value.length <= maxLength
  );
}

function isNullableDate(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isBoundedStringArray(value: unknown, maxItems: number, maxLength: number): value is string[] {
  return isStringArray(value)
    && value.length <= maxItems
    && value.every((item) => item.trim().length > 0 && item.length <= maxLength);
}

function hasUniqueValues(values: string[]) {
  return new Set(values).size === values.length;
}
