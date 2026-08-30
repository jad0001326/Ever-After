import type { CatalogueSupplier } from "@everaft/api-client";
import {
  addManualPlanningHubPhotographer,
  upsertPlanningHubPhotographer,
  type PlanningHubItemStatus,
} from "@everaft/planning-domain/planning-hub/plan";
import type { PlanningHubPhotographer } from "@everaft/planning-domain/planning-hub/types";
import { updateDevicePlan, type DevicePlanData } from "../../planning/device-plan-model";

export class SupplierCompareLimitError extends Error {
  constructor() { super("Compare up to three photographers at a time."); this.name = "SupplierCompareLimitError"; }
}

export function toggleComparedSupplier(data: DevicePlanData, supplier: CatalogueSupplier) {
  return updateDevicePlan(data, (current) => {
    const exists = current.discovery.comparedSuppliers.some((item) => item.id === supplier.id);
    if (!exists && current.discovery.comparedSuppliers.length >= 3) throw new SupplierCompareLimitError();
    return { ...current, discovery: { ...current.discovery, comparedSuppliers: exists
      ? current.discovery.comparedSuppliers.filter((item) => item.id !== supplier.id)
      : [...current.discovery.comparedSuppliers, supplier] } };
  });
}

export function setSupplierSavedOnDevice(data: DevicePlanData, supplierId: string, saved: boolean) {
  return updateDevicePlan(data, (current) => ({ ...current, discovery: { ...current.discovery,
    savedSupplierIds: saved ? [...new Set([...current.discovery.savedSupplierIds, supplierId])]
      : current.discovery.savedSupplierIds.filter((id) => id !== supplierId) } }));
}

export function addPhotographerToPlan(data: DevicePlanData, supplier: CatalogueSupplier, costPence: number, status: PlanningHubItemStatus) {
  return updateDevicePlan(data, (current) => ({ ...current,
    budgetPlan: upsertPlanningHubPhotographer(current.budgetPlan, planningPhotographer(supplier), costPence, status) }));
}

export function addManualPhotographer(data: DevicePlanData, name: string, costPence: number) {
  const cleanName = name.trim().slice(0, 240);
  if (!cleanName) throw new Error("Enter a photographer name.");
  return updateDevicePlan(data, (current) => ({ ...current,
    budgetPlan: addManualPlanningHubPhotographer(current.budgetPlan, cleanName, Math.max(0, Math.round(costPence)), "shortlisted") }));
}

export function supplierPlanningCost(supplier: CatalogueSupplier) { return supplier.startingPricePence ?? 0; }

function planningPhotographer(supplier: CatalogueSupplier): PlanningHubPhotographer {
  return { id: supplier.id, slug: supplier.slug, name: supplier.name, baseTown: supplier.baseTown,
    region: supplier.region, summary: supplier.summary, styles: supplier.styles,
    heroImageUrl: supplier.imageUrl ?? "/everaft-logo-mark.svg", hasApprovedPhoto: supplier.visualStatus === "approved",
    visualStatus: supplier.visualStatus === "absent" ? null : supplier.visualStatus,
    startingPricePence: supplier.startingPricePence, typicalPricePence: supplier.typicalPricePence,
    pricingSummary: supplier.pricingSummary, pricingUnit: supplier.pricingUnit, isClaimed: supplier.isClaimed,
    travelsNationwide: supplier.travelsNationwide };
}
