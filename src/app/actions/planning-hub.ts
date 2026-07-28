"use server";

import { z } from "zod";
import { getPlanningHubPhotographerDetail } from "@/lib/planning-hub/photographers";
import { getLivePlanningHubSupplierCategory } from "@/lib/planning-hub/supplier-search";
import { getPlanningHubSupplierDetail } from "@/lib/planning-hub/suppliers";
import { getPlanningHubVenueDetail } from "@/lib/planning-hub/venues";

const venueIdSchema = z.string().uuid();
const photographerIdSchema = z.string().uuid();
const supplierIdSchema = z.string().uuid();

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

export async function loadPlanningHubSupplierDetailAction(categorySlug: string, supplierId: string) {
  const category = getLivePlanningHubSupplierCategory(categorySlug);
  const parsedId = supplierIdSchema.safeParse(supplierId);
  if (!category || category.slug === "photographer" || !parsedId.success) return null;
  return getPlanningHubSupplierDetail(category.slug, parsedId.data);
}
