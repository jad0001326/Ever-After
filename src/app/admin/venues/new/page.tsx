import type { Metadata } from "next";
import { VenueForm } from "@/components/admin/venue-form";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Add venue"
};

export default async function NewVenuePage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#9d7b45]">Admin CMS</p>
      <h1 className="mt-3 font-display text-5xl font-semibold">Add venue</h1>
      <p className="mt-3 text-[var(--muted)]">Create a listing with commercial details, search metadata, and hero media.</p>
      <div className="mt-8">
        <VenueForm />
      </div>
    </div>
  );
}
