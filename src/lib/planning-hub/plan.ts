import { calculateBudget, getItemPlanningCost, getPaymentStatus } from "@/lib/budget/calculations";
import { plannerListingToBudgetItem } from "@/lib/budget/listing-pricing";
import { createEmptyBudgetPlan } from "@/lib/budget/persistence";
import type { BookingStatus, BudgetItem, BudgetPlan, PlannerListing } from "@/lib/budget/types";
import type { PlanningHubPhotographer, PlanningHubVenue } from "./types";

export type PlanningHubVenueStatus = Exclude<BookingStatus, "cancelled">;
export type PlanningHubItemStatus = PlanningHubVenueStatus;

export function createPlanningHubStarterPlan(userId: string | null) {
  return {
    ...createEmptyBudgetPlan(userId),
    totalBudgetPence: 2_000_000,
    guestCount: 80
  };
}

export function upsertPlanningHubVenue(
  plan: BudgetPlan,
  venue: PlanningHubVenue,
  planningCostPence: number,
  status: PlanningHubVenueStatus
) {
  return upsertPlanningHubListing(plan, planningHubVenueToListing(venue), planningCostPence, status);
}

export function addManualPlanningHubVenue(
  plan: BudgetPlan,
  name: string,
  planningCostPence: number,
  status: PlanningHubVenueStatus
) {
  return addManualPlanningHubItem(plan, "venue", "Venue", name, planningCostPence, status);
}

export function upsertPlanningHubPhotographer(
  plan: BudgetPlan,
  photographer: PlanningHubPhotographer,
  planningCostPence: number,
  status: PlanningHubItemStatus
) {
  return upsertPlanningHubListing(
    plan,
    planningHubPhotographerToListing(photographer),
    planningCostPence,
    status
  );
}

export function addManualPlanningHubPhotographer(
  plan: BudgetPlan,
  name: string,
  planningCostPence: number,
  status: PlanningHubItemStatus
) {
  return addManualPlanningHubItem(plan, "photography", "Photographer", name, planningCostPence, status);
}

export function choosePlanningHubVenue(plan: BudgetPlan, venueId: string) {
  return { ...plan, selectedVenueId: venueId, updatedAt: new Date().toISOString() };
}

export function updatePlanningHubVenuePayment(
  plan: BudgetPlan,
  venueId: string,
  depositPaidPence: number,
  totalPaidPence: number,
  dueDate: string | null
) {
  const item = findPlanningHubVenueItem(plan, venueId);
  return item ? updatePlanningHubItemPayment(plan, item.id, depositPaidPence, totalPaidPence, dueDate) : plan;
}

export function updatePlanningHubPhotographerPayment(
  plan: BudgetPlan,
  photographerId: string,
  depositPaidPence: number,
  totalPaidPence: number,
  dueDate: string | null
) {
  const item = findPlanningHubPhotographyItem(plan, photographerId);
  return item ? updatePlanningHubItemPayment(plan, item.id, depositPaidPence, totalPaidPence, dueDate) : plan;
}

export function updatePlanningHubItemPayment(
  plan: BudgetPlan,
  itemId: string,
  depositPaidPence: number,
  totalPaidPence: number,
  dueDate: string | null
) {
  const item = plan.items.find((candidate) => candidate.id === itemId);
  if (!item) return plan;
  const now = new Date().toISOString();
  const deposit = Math.max(0, Math.round(depositPaidPence));
  const paid = Math.max(deposit, Math.round(totalPaidPence), 0);
  const cost = getItemPlanningCost(item).amountPence;
  const paymentStatus = getPaymentStatus(cost, paid);
  const costStatus: BudgetItem["costStatus"] = paymentStatus === "paid" || paymentStatus === "overpaid"
    ? "paid"
    : paid > 0
      ? "partially_paid"
      : item.bookingStatus === "booked"
        ? "booked"
        : item.bookingStatus === "quoted"
          ? "quoted"
          : "estimated";

  return {
    ...plan,
    updatedAt: now,
    items: plan.items.map((candidate) => candidate.id === item.id
      ? { ...candidate, depositPaidPence: deposit, totalPaidPence: paid, dueDate, paymentStatus, costStatus, updatedAt: now }
      : candidate)
  };
}

export function findPlanningHubVenueItem(plan: BudgetPlan, venueId: string | null | undefined) {
  if (!venueId) return null;
  return plan.items.find((item) => item.categoryId === "venue" && item.listingId === venueId) ?? null;
}

export function findPlanningHubPhotographyItem(plan: BudgetPlan, photographerId: string | null | undefined) {
  if (!photographerId) return null;
  return plan.items.find((item) => item.categoryId === "photography" && item.listingId === photographerId) ?? null;
}

export function calculatePlanningHubPlan(plan: BudgetPlan) {
  const budget = calculateBudget(plan);
  let committedPence = 0;
  let committedPaidPence = 0;

  for (const item of plan.items) {
    if (item.bookingStatus !== "booked") continue;
    committedPence += getItemPlanningCost(item).amountPence ?? 0;
    committedPaidPence += Math.max(item.totalPaidPence, item.depositPaidPence, 0);
  }

  return {
    totalBudgetPence: plan.totalBudgetPence,
    plannedPence: budget.allocatedPence,
    committedPence,
    paidPence: budget.totalPaidPence,
    remainingPence: budget.remainingPence,
    outstandingCommittedPence: Math.max(committedPence - committedPaidPence, 0),
    uncommittedPlannedPence: Math.max(budget.allocatedPence - committedPence, 0)
  };
}

export function getVenuePlanningCost(venue: PlanningHubVenue | null | undefined, guests: number | null) {
  if (!venue || venue.priceFromPence == null) return null;
  if (venue.pricingUnit === "per_person") {
    return guests && guests > 0 ? venue.priceFromPence * guests : null;
  }
  return ["total", "per_event", null].includes(venue.pricingUnit) ? venue.priceFromPence : null;
}

export function getPhotographyNextHref(plan: BudgetPlan) {
  const params = new URLSearchParams();
  if (plan.selectedVenueId) params.set("venue", plan.selectedVenueId);
  if (plan.location) params.set("location", plan.location);
  const remainingPence = Math.max(calculatePlanningHubPlan(plan).remainingPence, 0);
  if (remainingPence > 0) params.set("budget", String(Math.floor(remainingPence / 100)));
  return `/planning-hub/photography${params.size ? `?${params.toString()}` : ""}`;
}

function upsertPlanningHubListing(
  plan: BudgetPlan,
  listing: PlannerListing,
  planningCostPence: number,
  status: PlanningHubItemStatus
) {
  const now = new Date().toISOString();
  const existing = plan.items.find((item) => item.categoryId === listing.categoryId && item.listingId === listing.id);
  const baseItem = existing ?? plannerListingToBudgetItem(listing, plan);
  const cost = planningCostPence > 0 ? Math.round(planningCostPence) : null;
  const isConfirmed = status === "quoted" || status === "booked";
  const item: BudgetItem = {
    ...baseItem,
    estimatedCostPence: isConfirmed ? null : cost,
    confirmedCostPence: isConfirmed ? cost : null,
    costPerPersonPence: null,
    guestCount: null,
    costStatus: status === "booked" ? "booked" : status === "quoted" ? "quoted" : "estimated",
    paymentStatus: getPaymentStatus(cost, Math.max(baseItem.totalPaidPence, baseItem.depositPaidPence)),
    bookingStatus: status,
    updatedAt: now
  };

  return {
    ...plan,
    updatedAt: now,
    items: existing
      ? plan.items.map((candidate) => candidate.id === existing.id ? item : candidate)
      : [...plan.items, item]
  };
}

function addManualPlanningHubItem(
  plan: BudgetPlan,
  categoryId: string,
  supplierType: string,
  name: string,
  planningCostPence: number,
  status: PlanningHubItemStatus
) {
  const now = new Date().toISOString();
  const cost = planningCostPence > 0 ? Math.round(planningCostPence) : null;
  const isConfirmed = status === "quoted" || status === "booked";
  const item: BudgetItem = {
    id: crypto.randomUUID(),
    categoryId,
    listingId: null,
    listingType: null,
    listingUrl: null,
    imageUrl: null,
    source: "manual",
    itemName: name.trim(),
    supplierName: name.trim(),
    supplierType,
    description: "Added manually in My EverAft.",
    estimatedCostPence: isConfirmed ? null : cost,
    confirmedCostPence: isConfirmed ? cost : null,
    importedPricePence: null,
    importedPriceToPence: null,
    importedPriceType: null,
    costPerPersonPence: null,
    guestCount: null,
    depositPaidPence: 0,
    totalPaidPence: 0,
    costStatus: status === "booked" ? "booked" : status === "quoted" ? "quoted" : "estimated",
    paymentStatus: "not_started",
    bookingStatus: status,
    dueDate: null,
    websiteUrl: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
    sortOrder: plan.items.length
  };
  return { ...plan, items: [...plan.items, item], updatedAt: now };
}

function planningHubVenueToListing(venue: PlanningHubVenue): PlannerListing {
  const unsafeUnit = ["per_night", "per_room", "per_hour", "unspecified", "quote"].includes(venue.pricingUnit ?? "");
  const pricingStatus = venue.priceFromPence == null
    ? "unavailable"
    : venue.pricingUnit === "per_person"
      ? "per_person"
      : unsafeUnit
        ? "unavailable"
        : "starting_from";

  return {
    id: venue.id,
    categoryId: "venue",
    slug: venue.slug,
    name: venue.name,
    type: venue.type,
    location: `${venue.town}, ${venue.region}`,
    imageUrl: venue.imageUrl,
    listingUrl: `/venues/${venue.slug}`,
    priceFromPence: venue.priceFromPence,
    priceToPence: null,
    pricingStatus,
    pricingLabel: venue.pricingLabel,
    pricingUnit: venue.pricingUnit
  };
}

function planningHubPhotographerToListing(photographer: PlanningHubPhotographer): PlannerListing {
  return {
    id: photographer.id,
    categoryId: "photography",
    slug: photographer.slug,
    name: photographer.name,
    type: "Photographer",
    location: `${photographer.baseTown}, ${photographer.region}`,
    imageUrl: photographer.heroImageUrl,
    listingUrl: `/photographers/${photographer.slug}`,
    priceFromPence: photographer.startingPricePence,
    priceToPence: photographer.typicalPricePence,
    pricingStatus: photographer.pricingUnit === "quote"
      ? "quote_required"
      : photographer.startingPricePence == null
        ? "unavailable"
        : photographer.typicalPricePence != null && photographer.typicalPricePence > photographer.startingPricePence
          ? "range"
          : "starting_from",
    pricingKind: "supplier_package",
    pricingLabel: photographer.startingPricePence == null ? null : "Packages from",
    pricingUnit: photographer.pricingUnit,
    priceQualifier: photographer.startingPricePence == null ? "quote" : "from",
    pricingDescription: photographer.pricingSummary
  };
}
