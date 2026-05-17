import type { Metadata } from "next";
import Link from "next/link";
import { VenueImportForm } from "@/components/admin/venue-import-form";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Import venues"
};

export default async function AdminImportPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Link className="text-sm font-semibold text-[#5c6b52]" href="/admin">Back to admin</Link>
      <div className="mt-6 mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#9d7b45]">Admin import</p>
        <h1 className="mt-3 font-display text-5xl font-semibold">Import venue intake</h1>
        <p className="mt-3 max-w-2xl text-[var(--muted)]">
          Upload your EverAft venue intake workbook and create draft listings from valid rows. Duplicates are skipped by slug and every import stays unpublished until reviewed.
        </p>
      </div>

      <div className="mb-6 rounded-3xl border border-[#e5d5b7] bg-[#fff9ef] px-5 py-4 text-sm leading-6 text-[#715622]">
        Required columns are Venue name, Type, Town, Region, Capacity min, and Capacity max. Blank hero images use representative stock photography automatically.
      </div>

      <VenueImportForm />
    </div>
  );
}
