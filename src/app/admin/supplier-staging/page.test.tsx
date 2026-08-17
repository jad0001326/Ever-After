import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = { count: number | null; data: unknown[]; error: null };

function createQuery(result: QueryResult) {
  const query = {
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    select: vi.fn(),
    then: (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve),
  };
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.range.mockReturnValue(query);
  query.select.mockReturnValue(query);
  return query;
}

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  redirect: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/app/actions/supplier-catalogue", () => ({ reviewSupplierCatalogueCandidates: vi.fn() }));
vi.mock("@/components/admin/supplier-catalogue-import-form", () => ({
  SupplierCatalogueImportForm: () => <div>Catalogue import form</div>,
}));

import SupplierStagingPage from "./page";

let candidateQuery: ReturnType<typeof createQuery>;
let countQueries: Array<ReturnType<typeof createQuery>>;
let batchQuery: ReturnType<typeof createQuery>;

beforeEach(() => {
  vi.clearAllMocks();
  candidateQuery = createQuery({
    count: 26,
    data: [{
      base_town: "Dundee",
      batch_id: "batch-1",
      business_name: "Tay Films",
      category_slug: "videographer",
      created_at: "2026-08-17T09:00:00.000Z",
      id: "candidate-1",
      image_permission_status: "not_provided",
      listing_id: null,
      pricing_summary: "Quote required",
      region: "Tayside",
      researched_at: "2026-08-17",
      review_notes: null,
      source_type: "official_website",
      source_url: "https://example.com",
      starting_price_pence: null,
      summary: "Documentary wedding films across Tayside.",
    }],
    error: null,
  });
  countQueries = [5, 2, 1].map((count) => createQuery({ count, data: [], error: null }));
  batchQuery = createQuery({ count: null, data: [{ id: "batch-1", source_label: "Tayside research" }], error: null });
  let candidateTableCall = 0;
  mocks.createClient.mockResolvedValue({
    from: vi.fn((table: string) => {
      if (table === "supplier_catalogue_batches") return batchQuery;
      const query = candidateTableCall === 0 ? candidateQuery : countQueries[candidateTableCall - 1];
      candidateTableCall += 1;
      return query;
    }),
  });
});

afterEach(cleanup);

describe("SupplierStagingPage", () => {
  it("uses bounded server queries and category-scoped count-only queues", async () => {
    render(await SupplierStagingPage({
      searchParams: Promise.resolve({ category: "videographer", page: "2", status: "staged" }),
    }));

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(candidateQuery.select).toHaveBeenCalledWith(expect.stringContaining("review_notes"), { count: "exact" });
    expect(candidateQuery.eq).toHaveBeenCalledWith("review_status", "staged");
    expect(candidateQuery.eq).toHaveBeenCalledWith("category_slug", "videographer");
    expect(candidateQuery.order).toHaveBeenNthCalledWith(1, "created_at", { ascending: true });
    expect(candidateQuery.order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
    expect(candidateQuery.range).toHaveBeenCalledWith(25, 49);
    for (const query of countQueries) {
      expect(query.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
      expect(query.eq).toHaveBeenCalledWith("category_slug", "videographer");
    }
    expect(batchQuery.in).toHaveBeenCalledWith("id", ["batch-1"]);
    expect(screen.getByRole("link", { name: /staged \(26\)/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /accepted \(5\)/i })).toBeTruthy();
    expect(screen.getByText("Queue counts reflect Videographers only.")).toBeTruthy();
    expect(screen.getByText("Showing 26–26 of 26 staged candidates in Videographers.")).toBeTruthy();
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
    expect(screen.getByText("Tayside research")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Previous" }).getAttribute("href"))
      .toBe("/admin/supplier-staging?status=staged&category=videographer");
  });
});
