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
    official_website_url?: string | null;
    official_gallery_url?: string | null;
    vendor_contact_email?: string | null;
    listing_status?: string | null;
    claim_status?: string | null;
    image_permission_status?: string | null;
    image_credit?: string | null;
    image_is_representative?: boolean;
    invite_status?: string | null;
    invite_sent_at?: string | null;
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
        <Field label="Listing status">
          <Select name="listingStatus" defaultValue={venue?.listing_status ?? "published"}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="claimed">Claimed</option>
            <option value="archived">Archived</option>
          </Select>
        </Field>
        <Field label="Claim status">
          <Select name="claimStatus" defaultValue={venue?.claim_status ?? "unclaimed"}>
            <option value="unclaimed">Unclaimed</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </Select>
        </Field>
        <Field label="Town">
          <Input name="town" required defaultValue={venue?.town} />
        </Field>
        <Field label="Region">
          <Input name="region" required defaultValue={venue?.region} />
        </Field>
        <Field label="Price from">
          <Input name="priceFrom" type="number" min="0" defaultValue={venue?.price_from} />
        </Field>
        <Field label="Price to">
          <Input name="priceTo" type="number" min="0" defaultValue={venue?.price_to} />
        </Field>
        <Field label="Capacity min">
          <Input name="capacityMin" type="number" min="1" required defaultValue={venue?.capacity_min} />
        </Field>
        <Field label="Capacity max">
          <Input name="capacityMax" type="number" min="1" required defaultValue={venue?.capacity_max} />
        </Field>
      </div>
      <Field label="Hero image URL">
        <Input name="heroImage" defaultValue={venue?.hero_image} placeholder="https://images.unsplash.com/..." />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Official website URL">
          <Input name="officialWebsiteUrl" defaultValue={venue?.official_website_url ?? ""} placeholder="https://venue.com" />
        </Field>
        <Field label="Official gallery URL">
          <Input name="officialGalleryUrl" defaultValue={venue?.official_gallery_url ?? ""} placeholder="https://venue.com/gallery" />
        </Field>
        <Field label="Image permission status">
          <Select name="imagePermissionStatus" defaultValue={venue?.image_permission_status ?? "representative"}>
            <option value="representative">Representative</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </Select>
        </Field>
        <Field label="Vendor contact email">
          <Input name="vendorContactEmail" type="email" defaultValue={venue?.vendor_contact_email ?? ""} placeholder="events@venue.com" />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Invite status">
          <Select name="inviteStatus" defaultValue={venue?.invite_status ?? "not_sent"}>
            <option value="not_sent">Not sent</option>
            <option value="sent">Sent</option>
            <option value="bounced">Bounced</option>
            <option value="replied">Replied</option>
            <option value="claimed">Claimed</option>
          </Select>
        </Field>
        <Field label="Invite sent at">
          <Input name="inviteSentAt" type="datetime-local" defaultValue={venue?.invite_sent_at ? venue.invite_sent_at.slice(0, 16) : ""} />
        </Field>
      </div>
      <Field label="Image credit">
        <Input name="imageCredit" defaultValue={venue?.image_credit ?? ""} placeholder="Venue name or photographer" />
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
      <label className="flex items-center gap-3 text-sm font-medium text-[#4a443c]">
        <input name="imageIsRepresentative" type="checkbox" defaultChecked={venue?.image_is_representative ?? true} className="size-4 accent-[#334235]" />
        Representative image
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
