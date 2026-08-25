import type { CatalogueVenue } from "@everaft/api-client";
import {
  addManualPlanningHubVenue,
  choosePlanningHubVenue,
  upsertPlanningHubVenue,
  type PlanningHubVenueStatus,
} from "@everaft/planning-domain/planning-hub/plan";
import type { PlanningHubVenue } from "@everaft/planning-domain/planning-hub/types";
import { updateDevicePlan, type DevicePlanData } from "../../planning/device-plan-model";

export class VenueCompareLimitError extends Error {
  constructor() {
    super("Compare up to three venues at a time.");
    this.name = "VenueCompareLimitError";
  }
}

export function toggleComparedVenue(data: DevicePlanData, venue: CatalogueVenue) {
  return updateDevicePlan(data, (current) => {
    const exists = current.discovery.comparedVenues.some((item) => item.id === venue.id);
    if (!exists && current.discovery.comparedVenues.length >= 3) {
      throw new VenueCompareLimitError();
    }
    return {
      ...current,
      discovery: {
        ...current.discovery,
        comparedVenues: exists
          ? current.discovery.comparedVenues.filter((item) => item.id !== venue.id)
          : [...current.discovery.comparedVenues, venue],
      },
    };
  });
}

export function setVenueSavedOnDevice(
  data: DevicePlanData,
  venueId: string,
  saved: boolean,
) {
  return updateDevicePlan(data, (current) => ({
    ...current,
    discovery: {
      ...current.discovery,
      savedVenueIds: saved
        ? [...new Set([...current.discovery.savedVenueIds, venueId])]
        : current.discovery.savedVenueIds.filter((id) => id !== venueId),
    },
  }));
}

export function shortlistVenue(
  data: DevicePlanData,
  venue: CatalogueVenue,
  costPence: number,
  status: PlanningHubVenueStatus = "shortlisted",
) {
  return updateDevicePlan(data, (current) => ({
    ...current,
    budgetPlan: upsertPlanningHubVenue(
      current.budgetPlan,
      planningHubVenue(venue),
      costPence,
      status,
    ),
  }));
}

export function selectVenue(
  data: DevicePlanData,
  venue: CatalogueVenue,
  costPence: number,
  status: PlanningHubVenueStatus,
) {
  return updateDevicePlan(data, (current) => {
    const withVenue = upsertPlanningHubVenue(
      current.budgetPlan,
      planningHubVenue(venue),
      costPence,
      status,
    );
    return {
      ...current,
      budgetPlan: choosePlanningHubVenue(withVenue, venue.id),
    };
  });
}

export function addManualVenue(
  data: DevicePlanData,
  name: string,
  costPence: number,
) {
  const cleanName = name.trim().slice(0, 240);
  if (!cleanName) throw new Error("Enter a venue name.");
  return updateDevicePlan(data, (current) => ({
    ...current,
    budgetPlan: addManualPlanningHubVenue(
      current.budgetPlan,
      cleanName,
      Math.max(0, Math.round(costPence)),
      "shortlisted",
    ),
  }));
}

export function venuePlanningCost(venue: CatalogueVenue, guests: number | null) {
  if (venue.priceFromPence === null) return 0;
  if (venue.pricingUnit === "per_person") {
    return guests && guests > 0 ? venue.priceFromPence * guests : 0;
  }
  return ["total", "per_event", null].includes(venue.pricingUnit)
    ? venue.priceFromPence
    : 0;
}

function planningHubVenue(venue: CatalogueVenue): PlanningHubVenue {
  return {
    ...venue,
    hasApprovedPhoto: venue.imageStatus === "approved",
  };
}
