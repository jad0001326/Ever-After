"use client";

import { CheckCircle2, ChevronDown, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import {
  profileCompletion,
  profileVenueSearchHref,
  weddingPriorityOptions,
} from "@/lib/planning-workspace/profile";
import { withPlanningWorkspace } from "@/lib/planning-hub/navigation";
import type {
  WeddingDateFlexibility,
  WeddingPriority,
  WeddingProfile,
} from "@/lib/planning-workspace/profile";

const priorityLabels: Record<WeddingPriority, string> = {
  venue: "Venue",
  guest_experience: "Guest experience",
  photography: "Photography",
  food: "Food",
  music: "Music",
  style: "Look & feel",
  accommodation: "Accommodation",
  accessibility: "Accessibility",
  sustainability: "Sustainability",
  value: "Value for money",
};

const venueStyleOptions = [
  "Castle",
  "Country house",
  "Barn",
  "Hotel",
  "Coastal",
  "City",
  "Outdoor",
  "Intimate",
];

const photographyStyleOptions = [
  "Documentary",
  "Editorial",
  "Natural",
  "Fine art",
  "Traditional",
  "Film-inspired",
  "Dramatic",
  "Relaxed",
];

export function PlanningHubProfile({
  profile,
  totalBudgetPence,
  onSave,
  workspaceId = null,
}: {
  profile: WeddingProfile;
  totalBudgetPence: number;
  onSave: (profile: WeddingProfile, totalBudgetPence: number) => void;
  workspaceId?: string | null;
}) {
  const [message, setMessage] = useState("");
  const completion = profileCompletion(profile);

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const priorities = formData.getAll("priorities").map(String) as WeddingPriority[];
    const venueStyles = formData.getAll("venueStyles").map(String);
    const photographyStyles = formData.getAll("photographyStyles").map(String);
    if (priorities.length > 5) {
      setMessage("Choose up to five priorities.");
      return;
    }

    const weddingDate = optionalText(formData.get("weddingDate"));
    const guestCountText = optionalText(formData.get("guestCount"));
    const budgetPounds = Number(formData.get("totalBudgetPounds") || 0);
    const guestCount = guestCountText ? Number(guestCountText) : null;
    if (
      !Number.isFinite(budgetPounds)
      || budgetPounds < 0
      || (guestCount !== null && (
        !Number.isInteger(guestCount)
        || guestCount < 1
        || guestCount > 10_000
      ))
    ) {
      setMessage("Check the budget and guest count before saving.");
      return;
    }
    const selectedDateFlexibility = String(formData.get("dateFlexibility")) as WeddingDateFlexibility;
    const nextProfile: WeddingProfile = {
      schemaVersion: 1,
      weddingDate,
      guestCount,
      location: optionalText(formData.get("location")),
      dateFlexibility: weddingDate && selectedDateFlexibility === "not_set"
        ? "fixed"
        : (!weddingDate && selectedDateFlexibility === "fixed" ? "not_set" : selectedDateFlexibility),
      locationFlexible: formData.get("locationFlexible") === "on",
      priorities,
      venueStyles,
      photographyStyles,
      vision: optionalText(formData.get("vision")),
      updatedAt: new Date().toISOString(),
    };

    onSave(nextProfile, Math.max(0, Math.round(budgetPounds * 100)));
    setMessage("Wedding profile saved on this device.");
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-[#d8c7a7] bg-white">
      <details open={completion.percentage < 100}>
        <summary className="focus-ring flex cursor-pointer list-none items-center gap-4 p-5 sm:p-6 [&::-webkit-details-marker]:hidden">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#edf2ec] text-[#31533b]">
            <SlidersHorizontal size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-[#95502b]">Your wedding profile</span>
            <span className="mt-1 block font-display text-2xl font-semibold text-[#173526]">
              Help EverAft narrow the choices
            </span>
            <span className="mt-1 block text-sm leading-5 text-[#625f57]">
              {completion.completed} of {completion.total} useful details added
            </span>
          </span>
          <ChevronDown aria-hidden="true" className="shrink-0 text-[#31533b]" size={20} />
        </summary>

        <form
          className="border-t border-[#e5ddd1] p-5 sm:p-6"
          key={`${profile.updatedAt}:${totalBudgetPence}`}
          onSubmit={saveProfile}
        >
          <p className="max-w-3xl text-sm leading-6 text-[#625f57]">
            Your budget, date, guest count and location are the same details used by the Budget Planner. Preferences help shape discovery without hiding other choices.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Total wedding budget">
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-[#625f57]">£</span>
                <input
                  aria-label="Total wedding budget"
                  className="focus-ring min-h-11 w-full rounded-xl border border-[var(--line)] pl-7 pr-3 text-sm"
                  defaultValue={totalBudgetPence > 0 ? totalBudgetPence / 100 : ""}
                  min="0"
                  name="totalBudgetPounds"
                  placeholder="25000"
                  step="0.01"
                  type="number"
                />
              </div>
            </Field>
            <Field label="Wedding date">
              <input
                className="focus-ring min-h-11 w-full rounded-xl border border-[var(--line)] px-3 text-sm"
                defaultValue={profile.weddingDate ?? ""}
                name="weddingDate"
                type="date"
              />
            </Field>
            <Field label="Estimated guests">
              <input
                className="focus-ring min-h-11 w-full rounded-xl border border-[var(--line)] px-3 text-sm"
                defaultValue={profile.guestCount ?? ""}
                max="10000"
                min="1"
                name="guestCount"
                placeholder="90"
                type="number"
              />
            </Field>
            <Field label="Preferred area">
              <input
                className="focus-ring min-h-11 w-full rounded-xl border border-[var(--line)] px-3 text-sm"
                defaultValue={profile.location ?? ""}
                maxLength={160}
                name="location"
                placeholder="e.g. Perthshire"
              />
            </Field>
            <Field label="Date flexibility">
              <select
                className="focus-ring min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
                defaultValue={profile.dateFlexibility}
                name="dateFlexibility"
              >
                <option value="not_set">Not decided</option>
                <option value="fixed">Fixed date</option>
                <option value="few_days">A few days either side</option>
                <option value="few_weeks">A few weeks either side</option>
                <option value="season_only">A season or time of year</option>
              </select>
            </Field>
            <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border border-[var(--line)] px-3 text-sm font-medium text-[#25221e]">
              <input className="size-4 accent-[#31533b]" defaultChecked={profile.locationFlexible} name="locationFlexible" type="checkbox" />
              We are flexible on location
            </label>
          </div>

          <ChoiceGroup
            description="Choose up to five."
            labels={priorityLabels}
            legend="What matters most?"
            name="priorities"
            options={[...weddingPriorityOptions]}
            selected={profile.priorities}
          />
          <ChoiceGroup
            description="Select any styles that feel right."
            legend="Venue styles"
            name="venueStyles"
            options={venueStyleOptions}
            selected={profile.venueStyles}
          />
          <ChoiceGroup
            description="These will help shape the photography shortlist."
            legend="Photography styles"
            name="photographyStyles"
            options={photographyStyleOptions}
            selected={profile.photographyStyles}
          />

          <Field label="Describe the wedding you have in mind">
            <textarea
              className="focus-ring mt-2 min-h-28 w-full rounded-xl border border-[var(--line)] p-3 text-sm leading-6"
              defaultValue={profile.vision ?? ""}
              maxLength={1000}
              name="vision"
              placeholder="Relaxed, warm and full of time with our favourite people…"
            />
          </Field>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button className="focus-ring min-h-11 rounded-full bg-[#173526] px-5 text-sm font-semibold text-white" type="submit">
              Save wedding profile
            </button>
            <Link
              className="focus-ring inline-flex min-h-11 items-center justify-center rounded-full border border-[#31533b] px-5 text-sm font-semibold text-[#173526]"
              href={withPlanningWorkspace(profileVenueSearchHref(profile, totalBudgetPence), workspaceId)}
            >
              Find matching venues
            </Link>
            <span className="flex items-center gap-2 text-xs text-[#58705f]" role="status">
              {message ? <CheckCircle2 aria-hidden="true" size={16} /> : null}
              {message}
            </span>
          </div>
        </form>
      </details>
    </section>
  );
}

function ChoiceGroup<T extends string>({
  description,
  labels,
  legend,
  name,
  options,
  selected,
}: {
  description: string;
  labels?: Record<T, string>;
  legend: string;
  name: string;
  options: T[];
  selected: string[];
}) {
  return (
    <fieldset className="mt-6">
      <legend className="text-sm font-semibold text-[#25221e]">{legend}</legend>
      <p className="mt-1 text-xs text-[#625f57]">{description}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <label className="cursor-pointer" key={option}>
            <input
              className="peer sr-only"
              defaultChecked={selected.includes(option)}
              name={name}
              type="checkbox"
              value={option}
            />
            <span className="peer-focus-visible:ring-2 peer-focus-visible:ring-[#31533b] peer-checked:border-[#31533b] peer-checked:bg-[#edf2ec] peer-checked:text-[#173526] inline-flex min-h-10 items-center rounded-full border border-[#d8cfc1] px-3 text-sm text-[#625f57]">
              {labels?.[option] ?? option}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="block text-sm font-semibold text-[#25221e]">
      <span className="mb-2 block">{label}</span>
      {children}
    </label>
  );
}

function optionalText(value: FormDataEntryValue | null) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
}
