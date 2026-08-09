import { supplierCategoryBySlug } from "@/data/supplier-directory";
import { permittedSupplierHero } from "@/lib/supplier-media";
import { publicSupplierProfilePath } from "@/lib/supplier-public-routes";
import type { PlannerListing } from "./types";

export type BudgetPlannerSupplierRow = {
  id: string;
  slug: string;
  name: string;
  category_slug: string;
  base_town: string;
  region: string;
  hero_image_url: string | null;
  image_permission_status: "representative" | "pending" | "approved" | "rejected";
  starting_price_pence: number | null;
  typical_price_pence: number | null;
  pricing_summary: string | null;
  pricing_unit: string;
};

export function activeSupplierRowToPlannerListing(
  supplier: BudgetPlannerSupplierRow,
): PlannerListing | null {
  const category = supplierCategoryBySlug(supplier.category_slug);
  if (!category?.live) return null;

  const imageUrl = permittedSupplierHero(
    supplier.hero_image_url,
    supplier.image_permission_status,
  );

  return {
    id: supplier.id,
    slug: supplier.slug,
    name: supplier.name,
    type: category.label,
    categoryId: category.budgetCategoryId,
    location: `${supplier.base_town}, ${supplier.region}`,
    imageUrl: imageUrl ?? "/everaft-logo-mark.svg",
    listingUrl: publicSupplierProfilePath(category.slug, supplier.slug),
    priceFromPence: supplier.starting_price_pence,
    priceToPence: supplier.typical_price_pence,
    pricingStatus: supplier.pricing_unit === "quote"
      ? "quote_required"
      : supplier.starting_price_pence == null
        ? "unavailable"
        : supplier.typical_price_pence != null
            && supplier.typical_price_pence > supplier.starting_price_pence
          ? "range"
          : "starting_from",
    pricingKind: "supplier_package",
    pricingLabel: supplier.starting_price_pence == null ? null : "Packages from",
    pricingUnit: supplier.pricing_unit === "person" ? "per_person" : supplier.pricing_unit,
    priceQualifier: supplier.starting_price_pence == null ? "quote" : "from",
    pricingDescription: supplier.pricing_summary,
    verifiedAt: null,
  };
}
