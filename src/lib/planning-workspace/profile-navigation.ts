import type { WeddingProfile } from "./profile";

const venueStyleSearchTypes: Record<string, string | undefined> = {
  Castle: "Castle",
  Barn: "Barn",
  "Country house": "Country Estate",
  Hotel: "Luxury Hotel",
};

export function profileVenueSearchHref(
  profile: WeddingProfile,
  totalBudgetPence: number,
  workspaceId?: string | null,
) {
  const params = new URLSearchParams();
  if (profile.location) params.set("location", profile.location);
  if (profile.guestCount) params.set("guests", String(profile.guestCount));
  if (totalBudgetPence > 0) params.set("budget", String(Math.floor(totalBudgetPence / 100)));
  const venueType = profile.venueStyles
    .map((style) => venueStyleSearchTypes[style])
    .find(Boolean);
  if (venueType) params.set("type", venueType);
  if (workspaceId) params.set("workspace", workspaceId);
  return `/planning-hub${params.size ? `?${params.toString()}` : ""}`;
}
