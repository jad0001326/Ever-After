"use server";

import { z } from "zod";
import { getPlanningHubVenueDetail } from "@/lib/planning-hub/venues";

const venueIdSchema = z.string().uuid();

export async function loadPlanningHubVenueDetailAction(venueId: string) {
  const parsed = venueIdSchema.safeParse(venueId);
  if (!parsed.success) return null;
  return getPlanningHubVenueDetail(parsed.data);
}
