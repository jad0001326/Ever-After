"use server";

import { z } from "zod";
import { getPlanningHubPhotographerDetail } from "@/lib/planning-hub/photographers";
import { getPlanningHubVenueDetail } from "@/lib/planning-hub/venues";

const venueIdSchema = z.string().uuid();
const photographerIdSchema = z.string().uuid();

export async function loadPlanningHubVenueDetailAction(venueId: string) {
  const parsed = venueIdSchema.safeParse(venueId);
  if (!parsed.success) return null;
  return getPlanningHubVenueDetail(parsed.data);
}

export async function loadPlanningHubPhotographerDetailAction(photographerId: string) {
  const parsed = photographerIdSchema.safeParse(photographerId);
  if (!parsed.success) return null;
  return getPlanningHubPhotographerDetail(parsed.data);
}
