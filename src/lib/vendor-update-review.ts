import type { Database, Json } from "@/types/database";

type VendorUpdateRequest = Database["public"]["Tables"]["vendor_update_requests"]["Row"];

export type VenueUpdateReviewVenue = {
  name: string;
  summary: string;
  description: string;
  official_website_url: string | null;
  official_gallery_url: string | null;
};

export type VenueUpdateFieldComparison = {
  key: keyof VenueUpdateReviewVenue;
  label: string;
  before: string | null;
  after: string | null;
  changed: boolean;
};

const fields = [
  { key: "name", requestKey: "requested_name", label: "Venue name" },
  { key: "summary", requestKey: "requested_summary", label: "Listing summary" },
  { key: "description", requestKey: "requested_description", label: "About the venue" },
  { key: "official_website_url", requestKey: "requested_official_website_url", label: "Official website" },
  { key: "official_gallery_url", requestKey: "requested_official_gallery_url", label: "Official gallery" }
] as const;

export function buildVenueUpdateComparisons(
  request: Pick<VendorUpdateRequest,
    | "status"
    | "requested_name"
    | "requested_summary"
    | "requested_description"
    | "requested_official_website_url"
    | "requested_official_gallery_url"
    | "previous_values"
    | "applied_values"
  >,
  venue: VenueUpdateReviewVenue
) {
  const previousValues = asSnapshot(request.previous_values);
  const appliedValues = asSnapshot(request.applied_values);

  return fields.flatMap<VenueUpdateFieldComparison>((field) => {
    const requestedValue = request[field.requestKey];
    if (requestedValue == null) return [];

    const before = snapshotValue(previousValues, field.key, venue[field.key]);
    const after = request.status === "approved"
      ? snapshotValue(appliedValues, field.key, requestedValue)
      : requestedValue;

    return [{
      key: field.key,
      label: field.label,
      before,
      after,
      changed: before !== after
    }];
  });
}

function asSnapshot(value: Json | null) {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  return value as Record<string, Json | undefined>;
}

function snapshotValue(snapshot: Record<string, Json | undefined> | null, key: string, fallback: string | null) {
  if (!snapshot || !(key in snapshot)) return fallback;
  const value = snapshot[key];
  return typeof value === "string" ? value : value == null ? null : fallback;
}
