import { supplierCategoryBySlug } from "@/data/supplier-directory";

export const SUPPLIER_ADMIN_PAGE_SIZE = 25;

export const supplierAdminStatuses = ["draft", "published", "archived"] as const;

export type SupplierAdminStatus = (typeof supplierAdminStatuses)[number];
export type SupplierAdminDirectoryFilters = {
  category: string | null;
  page: number;
  query: string;
  status: SupplierAdminStatus | null;
};

type SupplierAdminSearchParams = {
  category?: string;
  page?: string;
  query?: string;
  status?: string;
};

export function parseSupplierAdminDirectoryFilters(
  params: SupplierAdminSearchParams,
): SupplierAdminDirectoryFilters {
  const requestedPage = /^\d+$/.test(params.page ?? "") ? Number(params.page) : 1;
  return {
    category: params.category && supplierCategoryBySlug(params.category) ? params.category : null,
    page: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    query: normalizeSupplierAdminSearch(params.query),
    status: supplierAdminStatuses.includes(params.status as SupplierAdminStatus)
      ? params.status as SupplierAdminStatus
      : null,
  };
}

export function buildSupplierAdminNamePattern(query: string) {
  return `%${query.replace(/[\\%_]/g, "\\$&")}%`;
}

export function getSupplierAdminDirectoryRange(page: number) {
  const from = (page - 1) * SUPPLIER_ADMIN_PAGE_SIZE;
  return { from, to: from + SUPPLIER_ADMIN_PAGE_SIZE - 1 };
}

export function getSupplierAdminDirectoryPageCount(total: number) {
  return Math.max(1, Math.ceil(total / SUPPLIER_ADMIN_PAGE_SIZE));
}

export function buildSupplierAdminDirectoryHref(
  filters: SupplierAdminDirectoryFilters,
  page = filters.page,
) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.category) params.set("category", filters.category);
  if (filters.query) params.set("query", filters.query);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/suppliers?${query}` : "/admin/suppliers";
}

function normalizeSupplierAdminSearch(query: string | undefined) {
  return query?.trim().replace(/\s+/g, " ").slice(0, 80) ?? "";
}
