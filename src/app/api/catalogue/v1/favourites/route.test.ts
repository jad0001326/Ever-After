import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticate = vi.fn();
const listFavourites = vi.fn();
vi.mock("@/lib/planning-workspace/api-auth", () => ({
  authenticatePlanningApiRequest: (...args: unknown[]) => authenticate(...args),
}));
vi.mock("@/lib/catalogue/favourites-api", () => ({
  listCatalogueFavourites: (...args: unknown[]) => listFavourites(...args),
}));

import { GET } from "./route";

describe("Catalogue favourite collection API", () => {
  beforeEach(() => {
    authenticate.mockReset();
    listFavourites.mockReset();
    authenticate.mockResolvedValue({
      ok: true,
      supabase: { caller: true },
      user: { id: "20000000-0000-4000-8000-000000000002" },
    });
    listFavourites.mockResolvedValue({
      ok: true,
      venueIds: ["10000000-0000-4000-8000-000000000001"],
      supplierIds: [],
      hasMore: { venues: false, suppliers: false },
    });
  });

  it("keeps caller bookmarks private, bounded and caller-scoped", async () => {
    const response = await GET(request("?limit=25"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("vary")).toBe("Authorization");
    expect(listFavourites).toHaveBeenCalledWith(
      { caller: true },
      "20000000-0000-4000-8000-000000000002",
      25,
    );
  });

  it("rejects missing bearer and excessive result limits", async () => {
    authenticate.mockResolvedValueOnce({ ok: false, reason: "missing_bearer" });
    const missing = await GET(request());
    expect(missing.status).toBe(401);
    expect(missing.headers.get("www-authenticate")).toContain("Bearer");

    const excessive = await GET(request("?limit=101"));
    expect(excessive.status).toBe(400);
  });
});

function request(query = "") {
  return new Request(`https://www.everaft.co.uk/api/catalogue/v1/favourites${query}`, {
    headers: { Authorization: "Bearer test-token" },
  });
}
