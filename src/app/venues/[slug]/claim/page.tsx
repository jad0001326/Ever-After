import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClaimListingForm } from "@/components/venue/claim-listing-form";
import { requireUser } from "@/lib/auth";
import { getVenueListingBySlug } from "@/lib/venues";

export const metadata: Metadata = {
  title: "Claim venue listing"
};

export default async function ClaimVenuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const venue = await getVenueListingBySlug(slug);
  if (!venue) notFound();

  await requireUser(`/venues/${slug}/claim`, "Sign in or create an account to claim this listing");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Link className="text-sm font-semibold text-[#5c6b52]" href={`/venues/${venue.slug}`}>Back to listing</Link>
      <div className="mt-6 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="self-start rounded-3xl border border-[var(--line)] bg-white p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#9d7b45]">Claim this listing</p>
          <h1 className="mt-3 font-display text-5xl font-semibold">{venue.name}</h1>
          <p className="mt-4 leading-7 text-[var(--muted)]">
            Claim requests are manually reviewed by EverAft. Once approved, you can enrich this venue listing with reviewed photos, descriptions, pricing, amenities, and contact details.
          </p>
          <div className="mt-6 grid gap-4 text-sm leading-6 text-[#4f4a43]">
            <p>Vendors are responsible for the accuracy of submitted information.</p>
            <p>Vendors confirm they own or have permission to use submitted images and content.</p>
            <p>EverAft may review, edit, approve, reject, or remove submitted content.</p>
            <p>Listing presence does not imply a partnership until the claim is approved.</p>
          </div>
          <p className="mt-6 rounded-2xl bg-[#fff9ef] px-4 py-3 text-sm text-[#715622] ring-1 ring-[#e5d5b7]">
            Founding partner offer: lifetime discount available during launch.
          </p>
        </section>
        <ClaimListingForm venueId={venue.id} venueSlug={venue.slug} />
      </div>
    </div>
  );
}
