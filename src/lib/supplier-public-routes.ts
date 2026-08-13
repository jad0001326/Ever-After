import { supplierCategoryBySlug } from "@/data/supplier-directory";
import type { SupplierCategorySlug } from "@/types/supplier";

export function getPublicSupplierCategory(value: string) {
  const category = supplierCategoryBySlug(value);
  return category?.live ? category : null;
}

export function publicSupplierCategoryPath(categorySlug: SupplierCategorySlug) {
  return categorySlug === "photographer"
    ? "/photographers"
    : `/suppliers/${categorySlug}`;
}

export function publicSupplierProfilePath(categorySlug: SupplierCategorySlug, listingSlug: string) {
  return `${publicSupplierCategoryPath(categorySlug)}/${listingSlug}`;
}

export function publicSupplierClaimPath(categorySlug: SupplierCategorySlug, listingSlug: string) {
  return `${publicSupplierProfilePath(categorySlug, listingSlug)}/claim`;
}
