export type VenueListingHealthSource = {
  official_website_url: string | null;
  official_gallery_url: string | null;
  vendor_contact_email: string | null;
  image_is_representative: boolean | null;
  summary: string | null;
  description: string | null;
};

export function getVenueListingHealth(venue: VenueListingHealthSource) {
  const checks = [
    { label: "add official website", ok: Boolean(venue.official_website_url) },
    { label: "add official gallery", ok: Boolean(venue.official_gallery_url) },
    { label: "confirm enquiry email", ok: Boolean(venue.vendor_contact_email) },
    { label: "submit approved photography", ok: venue.image_is_representative === false },
    { label: "review summary", ok: Boolean(venue.summary?.trim()) },
    { label: "review description", ok: Boolean(venue.description?.trim()) }
  ];

  return {
    score: checks.filter((check) => check.ok).length,
    total: checks.length,
    missing: checks.filter((check) => !check.ok).map((check) => check.label)
  };
}
