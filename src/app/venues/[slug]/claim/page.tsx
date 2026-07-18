import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, FileCheck2, ImagePlus, ShieldCheck } from "lucide-react";
import { ClaimListingForm } from "@/components/venue/claim-listing-form";
import { requireUser } from "@/lib/auth";
import { getVenueListingBySlug } from "@/lib/venues";

export const metadata: Metadata = {
  title: "Claim venue listing",
  robots: { index: false, follow: false }
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
            Verify your connection to this venue so the listing can be managed by the right team. Approved claims unlock reviewed updates for photos, descriptions, amenities, and contact details.
          </p>
          <div className="mt-6 grid gap-4 text-sm leading-6 text-[#4f4a43]">
            <ClaimStep icon={<ShieldCheck size={16} />} text="Use a business email and your venue role." />
            <ClaimStep icon={<FileCheck2 size={16} />} text="Add a website, staff page, LinkedIn profile, or contact page as evidence." />
            <ClaimStep icon={<ImagePlus size={16} />} text="Only submit content you own or have permission to share." />
            <ClaimStep icon={<CheckCircle2 size={16} />} text="EverAft reviews every claim before changes appear publicly." />
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

function ClaimStep({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[#f4efe7] text-[#8b6d3c]">{icon}</span>
      <p>{text}</p>
    </div>
  );
}
