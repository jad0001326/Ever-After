import { upsertVenue } from "@/app/actions/admin";
import { venueTypes } from "@/data/venue-options";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

type VenueFormProps = {
  venue?: {
    id?: string;
    slug?: string;
    name?: string;
    type?: string;
    region?: string;
    town?: string;
    summary?: string;
    description?: string;
    price_from?: number;
    price_to?: number;
    capacity_min?: number;
    capacity_max?: number;
    hero_image?: string;
    status?: string;
    is_featured?: boolean;
  };
  amenities?: {
    id: string;
    name: string;
    slug: string;
    selected?: boolean;
  }[];
};

export function VenueForm({ venue, amenities = [] }: VenueFormProps) {
  return (
    <form action={upsertVenue} className="grid gap-5 rounded-3xl border border-[var(--line)] bg-white p-5">
      {venue?.id ? <input name="id" type="hidden" value={venue.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Venue name">
          <Input name="name" required defaultValue={venue?.name} placeholder="Ardencairn Castle" />
        </Field>
        <Field label="Slug">
          <Input name="slug" defaultValue={venue?.slug} placeholder="ardencairn-castle" />
        </Field>
        <Field label="Type">
          <Select name="type" defaultValue={venue?.type ?? "Country Estate"}>
            {venueTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={venue?.status ?? "published"}>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </Select>
        </Field>
        <Field label="Town">
          <Input name="town" required defaultValue={venue?.town} />
        </Field>
        <Field label="Region">
          <Input name="region" required defaultValue={venue?.region} />
        </Field>
        <Field label="Price from">
          <Input name="priceFrom" type="number" defaultValue={venue?.price_from} />
        </Field>
        <Field label="Price to">
          <Input name="priceTo" type="number" defaultValue={venue?.price_to} />
        </Field>
        <Field label="Capacity min">
          <Input name="capacityMin" type="number" defaultValue={venue?.capacity_min} />
        </Field>
        <Field label="Capacity max">
          <Input name="capacityMax" type="number" defaultValue={venue?.capacity_max} />
        </Field>
      </div>
      <Field label="Hero image URL">
        <Input name="heroImage" defaultValue={venue?.hero_image} placeholder="https://images.unsplash.com/..." />
      </Field>
      <Field label="Summary">
        <Textarea name="summary" required defaultValue={venue?.summary} />
      </Field>
      <Field label="Description">
        <Textarea name="description" required defaultValue={venue?.description} />
      </Field>
      <label className="flex items-center gap-3 text-sm font-medium text-[#4a443c]">
        <input name="isFeatured" type="checkbox" defaultChecked={venue?.is_featured} className="size-4 accent-[#334235]" />
        Featured venue
      </label>
      {amenities.length > 0 ? (
        <fieldset className="grid gap-3">
          <legend className="text-sm font-medium text-[#4a443c]">Amenities</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {amenities.map((amenity) => (
              <label className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[#fbf8f3] px-4 py-3 text-sm text-[#4a443c]" key={amenity.id}>
                <input name="amenities" type="checkbox" value={amenity.id} defaultChecked={amenity.selected} className="size-4 accent-[#334235]" />
                {amenity.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="rounded-2xl bg-[#fff8eb] px-4 py-3 text-sm text-[#7a5520] ring-1 ring-[#ead3a6]">
          No amenities found in Supabase. Run the seed SQL or add amenities before linking them to venues.
        </p>
      )}
      <Button type="submit">Save venue</Button>
    </form>
  );
}
