import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ImageUploader } from "@/components/admin/image-uploader";
import { VenueForm } from "@/components/admin/venue-form";
import { venues as demoVenues } from "@/data/venues";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Edit venue"
};

export default async function EditVenuePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ message?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { message } = await searchParams;
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("venues").select("*").eq("id", id).single() : { data: null };
  const demo = demoVenues.find((venue) => venue.id === id);
  const venue = data ?? (demo ? {
    id: demo.id,
    slug: demo.slug,
    name: demo.name,
    type: demo.type,
    region: demo.region,
    town: demo.town,
    summary: demo.summary,
    description: demo.description,
    price_from: demo.priceFrom,
    price_to: demo.priceTo,
    capacity_min: demo.capacityMin,
    capacity_max: demo.capacityMax,
    hero_image: demo.heroImage,
    status: "published",
    is_featured: demo.isFeatured
  } : null);

  if (!venue) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#9d7b45]">Admin CMS</p>
      <h1 className="mt-3 font-display text-5xl font-semibold">Edit venue</h1>
      <p className="mt-3 text-[var(--muted)]">Update listing content and publishing status.</p>
      {message ? <p className="mt-5 rounded-2xl bg-white px-4 py-3 text-sm text-[#5f594f] ring-1 ring-[var(--line)]">{message}</p> : null}
      <div className="mt-8">
        <VenueForm venue={venue} />
        <ImageUploader venueId={venue.id} />
      </div>
    </div>
  );
}
