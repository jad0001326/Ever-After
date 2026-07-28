import { supplierCategoryBySlug } from "@/data/supplier-directory";
import { calculateBudget, getItemPlanningCost, getPaymentStatus } from "@/lib/budget/calculations";
import { plannerListingToBudgetItem } from "@/lib/budget/listing-pricing";
import { createEmptyBudgetPlan } from "@/lib/budget/persistence";
import type { AvailabilityStatus, BookingStatus, BudgetItem, BudgetPlan, PaymentInstallment, PlannerListing } from "@/lib/budget/types";
import type { SupplierCategorySlug } from "@/types/supplier";
import type { PlanningHubPhotographer, PlanningHubSupplier, PlanningHubVenue } from "./types";

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
  return upsertPlanningHubSupplier(
    plan,
    { ...photographer, categorySlug: "photographer" },
    planningCostPence,
    status,
  );
}

export function addManualPlanningHubPhotographer(
  plan: BudgetPlan,
  name: string,
  planningCostPence: number,
  status: PlanningHubItemStatus
) {
  return addManualPlanningHubSupplier(
    plan,
    "photographer",
    name,
    planningCostPence,
    status,
  );
}

export function upsertPlanningHubSupplier(
  plan: BudgetPlan,
  supplier: PlanningHubSupplier,
  planningCostPence: number,
  status: PlanningHubItemStatus,
) {
  const category = supplierCategoryBySlug(supplier.categorySlug);
  if (!category) return plan;
  return upsertPlanningHubListing(
    plan,
    planningHubSupplierToListing(
      supplier,
      category.budgetCategoryId,
      category.label,
    ),
    planningCostPence,
    status,
  );
}

export function addManualPlanningHubSupplier(
  plan: BudgetPlan,
  categorySlug: SupplierCategorySlug,
  name: string,
  planningCostPence: number,
  status: PlanningHubItemStatus,
) {
  const category = supplierCategoryBySlug(categorySlug);
  return category
    ? addManualPlanningHubItem(
        plan,
        category.budgetCategoryId,
        category.label,
        name,
        planningCostPence,
        status,
      )
    : plan;
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

export function updatePlanningHubItemInstallments(
  plan: BudgetPlan,
  itemId: string,
  installments: PaymentInstallment[],
) {
  const item = plan.items.find((candidate) => candidate.id === itemId);
  if (!item) return plan;
  const now = new Date().toISOString();
  const normalized = installments.slice(0, 50).map((installment) => ({
    ...installment,
    label: installment.label.trim().slice(0, 120),
    amountPence: installment.amountPence === null
      ? null
      : Math.max(0, Math.round(installment.amountPence)),
    paidPence: Math.max(0, Math.round(installment.paidPence)),
  })).filter((installment) => installment.label.length > 0);
  const totalPaidPence = normalized.reduce((total, installment) => total + installment.paidPence, 0);
  const depositPaidPence = normalized
    .filter((installment) => installment.kind === "deposit")
    .reduce((total, installment) => total + installment.paidPence, 0);
  const nextDueDate = normalized
    .filter((installment) => (
      installment.dueDate
      && (installment.amountPence === null || installment.paidPence < installment.amountPence)
    ))
    .map((installment) => installment.dueDate as string)
    .sort()[0] ?? null;
  const cost = getItemPlanningCost(item).amountPence;
  const calculatedPaymentStatus = getPaymentStatus(cost, totalPaidPence);
  const paymentStatus: BudgetItem["paymentStatus"] =
    calculatedPaymentStatus === "partially_paid"
      && depositPaidPence > 0
      && totalPaidPence === depositPaidPence
      ? "deposit_paid"
      : calculatedPaymentStatus;
  const costStatus: BudgetItem["costStatus"] = paymentStatus === "paid" || paymentStatus === "overpaid"
    ? "paid"
    : totalPaidPence > 0
      ? depositPaidPence > 0 && totalPaidPence === depositPaidPence
        ? "deposit_paid"
        : "partially_paid"
      : item.bookingStatus === "booked"
        ? "booked"
        : item.bookingStatus === "quoted"
          ? "quoted"
          : "estimated";

  return {
    ...plan,
    updatedAt: now,
    items: plan.items.map((candidate) => candidate.id === itemId ? {
      ...candidate,
      installments: normalized,
      depositPaidPence,
      totalPaidPence,
      dueDate: nextDueDate,
      paymentStatus,
      costStatus,
      updatedAt: now,
    } : candidate),
  };
}

export function updatePlanningHubItemAvailability(
  plan: BudgetPlan,
  itemId: string,
  availabilityStatus: AvailabilityStatus,
) {
  const item = plan.items.find((candidate) => candidate.id === itemId);
  if (!item || (availabilityStatus !== "not_checked" && !plan.weddingDate)) return plan;
  const now = new Date().toISOString();
  return {
    ...plan,
    updatedAt: now,
    items: plan.items.map((candidate) => candidate.id === itemId ? {
      ...candidate,
      availabilityStatus,
      availabilityDate: availabilityStatus === "not_checked" ? null : plan.weddingDate,
      updatedAt: now,
    } : candidate),
  };
}

export function getPlanningHubItemAvailability(
  item: Pick<BudgetItem, "availabilityDate" | "availabilityStatus">,
  weddingDate: string | null,
) {
  const status = item.availabilityStatus ?? "not_checked";
  return {
    status,
    checkedDate: item.availabilityDate ?? null,
    stale: status !== "not_checked"
      && item.availabilityDate !== weddingDate,
  };
}

export function findPlanningHubVenueItem(plan: BudgetPlan, venueId: string | null | undefined) {
  if (!venueId) return null;
  return plan.items.find((item) => (
    item.categoryId === "venue"
    && (item.listingId === venueId || item.id === venueId)
  )) ?? null;
}

export function findPlanningHubPhotographyItem(plan: BudgetPlan, photographerId: string | null | undefined) {
  return findPlanningHubSupplierItem(plan, "photographer", photographerId);
}

export function findPlanningHubSupplierItem(
  plan: BudgetPlan,
  categorySlug: SupplierCategorySlug,
  supplierId: string | null | undefined,
) {
  if (!supplierId) return null;
  const category = supplierCategoryBySlug(categorySlug);
  if (!category) return null;
  return plan.items.find((item) => (
    item.categoryId === category.budgetCategoryId
    && item.supplierType === category.label
    && (item.listingId === supplierId || item.id === supplierId)
  )) ?? null;
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
    spendableBudgetPence: budget.spendableBudgetPence,
    plannedPence: budget.allocatedPence,
    committedPence,
    paidPence: budget.totalPaidPence,
    remainingPence: budget.remainingPence,
    outstandingCommittedPence: Math.max(committedPence - committedPaidPence, 0),
    uncommittedPlannedPence: Math.max(budget.allocatedPence - committedPence, 0),
    percentUsed: budget.percentUsed,
    missingPriceCount: budget.missingPriceCount,
    activeItemCount: budget.activeItemCount,
    health: budget.health,
  };
}

export function getVenuePlanningCost(venue: PlanningHubVenue | null | undefined, guests: number | null) {
  if (!venue || venue.priceFromPence == null) return null;
  if (venue.pricingUnit === "per_person") {
    return guests && guests > 0 ? venue.priceFromPence * guests : null;
  }
  return ["total", "per_event", null].includes(venue.pricingUnit) ? venue.priceFromPence : null;
}

export function getPhotographyNextHref(
  plan: BudgetPlan,
  preferredStyle?: string | null,
  workspaceId?: string | null,
) {
  const params = new URLSearchParams();
  if (plan.selectedVenueId) params.set("venue", plan.selectedVenueId);
  if (plan.location) params.set("location", plan.location);
  if (preferredStyle) params.set("style", preferredStyle);
  const remainingPence = Math.max(calculatePlanningHubPlan(plan).remainingPence, 0);
  if (remainingPence > 0) params.set("budget", String(Math.floor(remainingPence / 100)));
  if (workspaceId) params.set("workspace", workspaceId);
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
    availabilityStatus: status === "booked" && plan.weddingDate
      ? "available"
      : baseItem.availabilityStatus,
    availabilityDate: status === "booked" && plan.weddingDate
      ? plan.weddingDate
      : baseItem.availabilityDate,
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
    installments: [],
    costStatus: status === "booked" ? "booked" : status === "quoted" ? "quoted" : "estimated",
    paymentStatus: "not_started",
    bookingStatus: status,
    availabilityStatus: status === "booked" && plan.weddingDate ? "available" : "not_checked",
    availabilityDate: status === "booked" && plan.weddingDate ? plan.weddingDate : null,
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

function planningHubSupplierToListing(
  supplier: PlanningHubSupplier,
  budgetCategoryId: string,
  categoryLabel: string,
): PlannerListing {
  const pricingUnit = planningHubSupplierPricingUnit(supplier.pricingUnit);
  return {
    id: supplier.id,
    categoryId: budgetCategoryId,
    slug: supplier.slug,
    name: supplier.name,
    type: categoryLabel,
    location: `${supplier.baseTown}, ${supplier.region}`,
    imageUrl: supplier.heroImageUrl,
    listingUrl: supplier.categorySlug === "photographer"
      ? `/photographers/${supplier.slug}`
      : `/suppliers/${supplier.categorySlug}/${supplier.slug}`,
    priceFromPence: supplier.startingPricePence,
    priceToPence: supplier.typicalPricePence,
    pricingStatus: pricingUnit === "quote"
      ? "quote_required"
      : supplier.startingPricePence == null
        ? "unavailable"
        : supplier.typicalPricePence != null && supplier.typicalPricePence > supplier.startingPricePence
          ? "range"
          : "starting_from",
    pricingKind: "supplier_package",
    pricingLabel: supplier.startingPricePence == null ? null : "Packages from",
    pricingUnit,
    priceQualifier: supplier.startingPricePence == null ? "quote" : "from",
    pricingDescription: supplier.pricingSummary,
  };
}

function planningHubSupplierPricingUnit(pricingUnit: string) {
  if (pricingUnit === "person") return "per_person";
  if (pricingUnit === "hour") return "per_hour";
  if (pricingUnit === "event") return "per_event";
  return pricingUnit;
}
