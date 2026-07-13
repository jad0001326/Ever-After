import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ImageUploader } from "@/components/admin/image-uploader";
import { VenueForm } from "@/components/admin/venue-form";
import { VenuePricingManager, type AdminVenuePriceOption } from "@/components/admin/venue-pricing-manager";
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
  const [{ data: venue }, { data: amenities }, { data: venueAmenities }, { data: images }, { data: priceOptions }] = await Promise.all([
    supabase!.from("venues").select("*").eq("id", id).single(),
    supabase!.from("amenities").select("id, slug, name").order("name", { ascending: true }),
    supabase!.from("venue_amenities").select("amenity_id").eq("venue_id", id),
    supabase!.from("venue_images").select("id, url, alt, sort_order").eq("venue_id", id).order("sort_order", { ascending: true }),
    supabase!
      .from("venue_price_options")
      .select("id, kind, label, amount_from_pence, amount_to_pence, pricing_unit, price_qualifier, included_guests, season_label, day_label, description, tax_label, minimum_nights, valid_from, valid_to, source_type, source_url, source_title, evidence_text, verified_at, status, display_priority")
      .eq("venue_id", id)
      .order("display_priority", { ascending: true })
  ]);

  if (!venue) notFound();
  const selectedAmenityIds = new Set((venueAmenities ?? []).map((link) => link.amenity_id));
  const amenityOptions = (amenities ?? []).map((amenity) => ({
    ...amenity,
    selected: selectedAmenityIds.has(amenity.id)
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#9d7b45]">Admin CMS</p>
      <h1 className="mt-3 font-display text-5xl font-semibold">Edit venue</h1>
      <p className="mt-3 text-[var(--muted)]">Update listing content and publishing status.</p>
      {message ? <p className="mt-5 rounded-2xl bg-white px-4 py-3 text-sm text-[#5f594f] ring-1 ring-[var(--line)]">{message}</p> : null}
      <div className="mt-8">
        <VenueForm venue={venue} amenities={amenityOptions} />
        <VenuePricingManager venueId={venue.id} venueSlug={venue.slug} options={(priceOptions ?? []) as AdminVenuePriceOption[]} />
        {images && images.length > 0 ? (
          <div className="mt-8 rounded-3xl border border-[var(--line)] bg-white p-5">
            <h2 className="font-display text-3xl font-semibold">Current images</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {images.map((image) => (
                <div className="overflow-hidden rounded-2xl border border-[var(--line)]" key={image.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={image.alt} className="aspect-[4/3] w-full object-cover" src={image.url} />
                  <p className="px-3 py-2 text-sm text-[var(--muted)]">{image.alt}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <ImageUploader venueId={venue.id} />
      </div>
    </div>
  );
}
