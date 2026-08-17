import { supplierCategoryBySlug } from "@/data/supplier-directory";

export const SUPPLIER_STAGING_PAGE_SIZE = 25;
export const supplierStagingStatuses = ["staged", "accepted", "rejected", "duplicate"] as const;

export type SupplierStagingStatus = (typeof supplierStagingStatuses)[number];
export type SupplierStagingDirectoryFilters = {
  category: string | null;
  page: number;
  status: SupplierStagingStatus;
};

type SupplierStagingSearchParams = {
  category?: string;
  page?: string;
  status?: string;
};

export function parseSupplierStagingDirectoryFilters(
  params: SupplierStagingSearchParams,
): SupplierStagingDirectoryFilters {
  const requestedPage = /^\d+$/.test(params.page ?? "") ? Number(params.page) : 1;
  return {
    category: params.category && supplierCategoryBySlug(params.category) ? params.category : null,
    page: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    status: supplierStagingStatuses.includes(params.status as SupplierStagingStatus)
      ? params.status as SupplierStagingStatus
      : "staged",
  };
}

export function getSupplierStagingDirectoryRange(page: number) {
  const from = (page - 1) * SUPPLIER_STAGING_PAGE_SIZE;
  return { from, to: from + SUPPLIER_STAGING_PAGE_SIZE - 1 };
}

export function getSupplierStagingDirectoryPageCount(total: number) {
  return Math.max(1, Math.ceil(total / SUPPLIER_STAGING_PAGE_SIZE));
}

export function buildSupplierStagingDirectoryHref(
  filters: SupplierStagingDirectoryFilters,
  overrides: Partial<SupplierStagingDirectoryFilters> = {},
) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams({ status: next.status });
  if (next.category) params.set("category", next.category);
  if (next.page > 1) params.set("page", String(next.page));
  return `/admin/supplier-staging?${params.toString()}`;
}
