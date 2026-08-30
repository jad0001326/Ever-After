import {
  catalogueFavouriteCollectionSchema,
  catalogueFavouriteMutationSchema,
  catalogueVenueCollectionSchema,
  catalogueVenueDetailSchema,
  type catalogueFavouriteKindSchema,
} from "@everaft/planning-contracts/catalogue/venue-api-schema";
import type { z } from "zod";
import {
  catalogueSupplierCollectionSchema,
  catalogueSupplierDetailSchema,
} from "@everaft/planning-contracts/catalogue/supplier-api-schema";
import type { AccessTokenProvider } from "./planning-client";

export type CatalogueFailure =
  | "authentication_required"
  | "not_found"
  | "offline"
  | "response_contract_invalid"
  | "request_failed";

export type CatalogueApiDiagnostic = Readonly<{
  operation: string;
  outcome: "success" | "failure";
  status?: number;
  failure?: CatalogueFailure;
}>;

export class CatalogueApiError extends Error {
  constructor(readonly failure: CatalogueFailure, readonly status?: number) {
    super(failure);
    this.name = "CatalogueApiError";
  }
}

export type CatalogueVenueCollection = z.infer<typeof catalogueVenueCollectionSchema>;
export type CatalogueVenue = CatalogueVenueCollection["venues"][number];
export type CatalogueVenueDetail = z.infer<typeof catalogueVenueDetailSchema>;
export type CatalogueFavouriteCollection = z.infer<typeof catalogueFavouriteCollectionSchema>;
export type CatalogueFavouriteKind = z.infer<typeof catalogueFavouriteKindSchema>;
export type CatalogueSupplierCollection = z.infer<typeof catalogueSupplierCollectionSchema>;
export type CatalogueSupplier = CatalogueSupplierCollection["suppliers"][number];
export type CatalogueSupplierDetail = z.infer<typeof catalogueSupplierDetailSchema>;

export type VenueSearch = Readonly<{
  search?: string;
  location?: string;
  guests?: number;
  budgetPounds?: number;
  type?: string;
  page?: number;
}>;

export type SupplierSearch = Readonly<{
  search?: string;
  location?: string;
  style?: string;
  venueId?: string;
  venueName?: string;
  budgetPounds?: number;
  weddingDate?: string;
  page?: number;
}>;

export function createCatalogueApiClient(options: Readonly<{
  baseUrl: string;
  getAccessToken: AccessTokenProvider;
  fetch?: typeof globalThis.fetch;
  onDiagnostic?: (diagnostic: CatalogueApiDiagnostic) => void;
}>) {
  const baseUrl = validateBaseUrl(options.baseUrl);
  const fetcher = options.fetch ?? globalThis.fetch;

  async function request<T>(
    operation: string,
    path: string,
    schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
    init: RequestInit = {},
    authenticated = false,
  ) {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (authenticated) {
      const token = await options.getAccessToken();
      if (!token) return fail(operation, "authentication_required");
      headers.set("Authorization", `Bearer ${token}`);
    }

    let response: Response;
    try {
      response = await fetcher(new URL(path, baseUrl), { ...init, headers });
    } catch {
      return fail(operation, "offline");
    }
    if (!response.ok) {
      return fail(
        operation,
        response.status === 401
          ? "authentication_required"
          : response.status === 404
            ? "not_found"
            : "request_failed",
        response.status,
      );
    }
    const parsed = schema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) return fail(operation, "response_contract_invalid", response.status);
    options.onDiagnostic?.({ operation, outcome: "success", status: response.status });
    return parsed.data;
  }

  function fail(operation: string, failure: CatalogueFailure, status?: number): never {
    options.onDiagnostic?.({ operation, outcome: "failure", failure, status });
    throw new CatalogueApiError(failure, status);
  }

  return Object.freeze({
    searchSuppliers(category: "photographer", filters: SupplierSearch = {}) {
      const query = new URLSearchParams();
      setText(query, "search", filters.search, 100);
      setText(query, "location", filters.location, 120);
      setText(query, "style", filters.style, 80);
      setText(query, "venue", filters.venueId, 100);
      setText(query, "venueName", filters.venueName, 120);
      setText(query, "weddingDate", filters.weddingDate, 10);
      setInteger(query, "budget", filters.budgetPounds, 10_000_000);
      setInteger(query, "page", filters.page ?? 1, 1000);
      return request(
        "catalogue.suppliers.search",
        `/api/catalogue/v1/suppliers/${category}?${query}`,
        catalogueSupplierCollectionSchema,
      );
    },
    getSupplier(category: "photographer", supplierId: string) {
      return request(
        "catalogue.suppliers.detail",
        `/api/catalogue/v1/suppliers/${category}/${encodeURIComponent(supplierId)}`,
        catalogueSupplierDetailSchema,
      );
    },
    searchVenues(filters: VenueSearch = {}) {
      const query = new URLSearchParams();
      setText(query, "search", filters.search, 100);
      setText(query, "location", filters.location, 120);
      setText(query, "type", filters.type, 80);
      setInteger(query, "guests", filters.guests, 10_000);
      setInteger(query, "budget", filters.budgetPounds, 10_000_000);
      setInteger(query, "page", filters.page ?? 1, 1000);
      return request(
        "catalogue.venues.search",
        `/api/catalogue/v1/venues?${query}`,
        catalogueVenueCollectionSchema,
      );
    },
    getVenue(venueId: string) {
      return request(
        "catalogue.venues.detail",
        `/api/catalogue/v1/venues/${encodeURIComponent(venueId)}`,
        catalogueVenueDetailSchema,
      );
    },
    listFavourites(limit = 50) {
      return request(
        "catalogue.favourites.list",
        `/api/catalogue/v1/favourites?limit=${boundedInteger(limit, 100)}`,
        catalogueFavouriteCollectionSchema,
        {},
        true,
      );
    },
    setFavourite(kind: CatalogueFavouriteKind, id: string, saved: boolean) {
      return request(
        "catalogue.favourites.mutate",
        `/api/catalogue/v1/favourites/${kind}/${encodeURIComponent(id)}`,
        catalogueFavouriteMutationSchema,
        { method: saved ? "PUT" : "DELETE" },
        true,
      );
    },
  });
}

function validateBaseUrl(raw: string) {
  const url = new URL(raw);
  const local = ["localhost", "127.0.0.1", "10.0.2.2"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("Catalogue API base URL must use HTTPS outside local development.");
  }
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

function setText(query: URLSearchParams, key: string, raw: string | undefined, max: number) {
  const value = raw?.trim().slice(0, max);
  if (value) query.set(key, value);
}

function setInteger(query: URLSearchParams, key: string, raw: number | undefined, max: number) {
  if (raw === undefined) return;
  query.set(key, String(boundedInteger(raw, max)));
}

function boundedInteger(raw: number, max: number) {
  if (!Number.isFinite(raw)) return 1;
  return Math.min(Math.max(Math.round(raw), 1), max);
}
