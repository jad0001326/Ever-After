"use client";

import Link from "next/link";
import { ArrowUpRight, Check, MapPin, UsersRound } from "lucide-react";
import { useState } from "react";
import {
  VenuePassport,
  type VenuePassportVariant,
  type VenuePassportVenue
} from "@/components/venue/venue-passport";

export type VenuePassportReviewVenue = VenuePassportVenue & {
  summary: string;
  capacityMax: number;
};

export function VenuePassportReview({ venues }: { venues: VenuePassportReviewVenue[] }) {
  const [activeVariant, setActiveVariant] = useState<VenuePassportVariant>("heritage");
  const comparisonVenue = venues.find((venue) => venue.slug === "sorn-castle") ?? venues[0];

  if (!comparisonVenue) return null;

  return (
    <div className="space-y-16">
      <section aria-labelledby="direction-comparison">
        <div className="mb-7 max-w-2xl">
          <h2 className="font-display text-4xl font-semibold tracking-[-0.035em]" id="direction-comparison">Direction comparison</h2>
          <p className="mt-3 leading-7 text-[var(--muted)]">
            Both treatments are built from verified listing facts. Neither illustration claims to show the real building.
          </p>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-2">
          <DirectionPreview
            description="Romantic, established and closest to EverAft’s current visual language."
            label="Heritage editorial"
            recommended
            venue={comparisonVenue}
            variant="heritage"
          />
          <DirectionPreview
            description="Cleaner and more contemporary, led by place names and regional identity."
            label="Modern cartographic"
            venue={comparisonVenue}
            variant="cartographic"
          />
        </div>
      </section>

      <section aria-labelledby="passport-collection">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <h2 className="font-display text-4xl font-semibold tracking-[-0.035em]" id="passport-collection">Twelve-venue collection</h2>
            <p className="mt-3 leading-7 text-[var(--muted)]">
              The palette and illustration change consistently by venue, avoiding another repeated-image problem.
            </p>
          </div>
          <div aria-label="Passport style" className="inline-flex rounded-full border border-[var(--line)] bg-white p-1" role="group">
            <StyleButton active={activeVariant === "heritage"} onClick={() => setActiveVariant("heritage")}>Heritage</StyleButton>
            <StyleButton active={activeVariant === "cartographic"} onClick={() => setActiveVariant("cartographic")}>Cartographic</StyleButton>
          </div>
        </div>

        <div className="grid gap-x-6 gap-y-9 sm:grid-cols-2 xl:grid-cols-3">
          {venues.map((venue) => (
            <article className="group min-w-0" key={venue.id}>
              <VenuePassport
                className="transition duration-500 group-hover:-translate-y-1 group-hover:shadow-2xl group-hover:shadow-black/10"
                venue={venue}
                variant={activeVariant}
              />
              <div className="flex items-start justify-between gap-4 px-1 pt-4">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-2xl font-semibold tracking-[-0.025em]">{venue.name}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">{venue.type} · {venue.town}</p>
                </div>
                <Link
                  aria-label={`View current ${venue.name} listing`}
                  className="focus-ring mt-1 grid size-9 shrink-0 place-items-center rounded-full border border-[var(--line)] bg-white text-[var(--brand)] transition hover:bg-[#f4efe7]"
                  href={`/venues/${venue.slug}`}
                >
                  <ArrowUpRight aria-hidden="true" size={16} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function DirectionPreview({
  venue,
  variant,
  label,
  description,
  recommended = false
}: {
  venue: VenuePassportReviewVenue;
  variant: VenuePassportVariant;
  label: string;
  description: string;
  recommended?: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white">
      <VenuePassport className="rounded-none" venue={venue} variant={variant} />
      <div className="p-6">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-display text-3xl font-semibold tracking-[-0.03em]">{venue.name}</h3>
          {recommended ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#edf2eb] px-3 py-1 text-xs font-semibold text-[#31513a]">
              <Check aria-hidden="true" size={13} /> Recommended
            </span>
          ) : null}
        </div>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{venue.summary}</p>
        <div className="mt-5 grid gap-2 text-sm text-[#4f4a43] sm:grid-cols-2">
          <span className="flex items-center gap-2"><MapPin aria-hidden="true" className="text-[#9d7b45]" size={16} />{venue.town}, {venue.region}</span>
          <span className="flex items-center gap-2"><UsersRound aria-hidden="true" className="text-[#9d7b45]" size={16} />Up to {venue.capacityMax} guests</span>
        </div>
        <div className="mt-5 border-t border-[var(--line)] pt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a806f]">{label}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
        </div>
      </div>
    </article>
  );
}

function StyleButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      aria-pressed={active}
      className={active
        ? "focus-ring min-h-10 rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-white"
        : "focus-ring min-h-10 rounded-full px-4 text-sm font-semibold text-[#4f4a43] transition hover:bg-[#f4efe7]"}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
