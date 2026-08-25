import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticate = vi.fn();
const setFavourite = vi.fn();
vi.mock("@/lib/planning-workspace/api-auth", () => ({
  authenticatePlanningApiRequest: (...args: unknown[]) => authenticate(...args),
}));
vi.mock("@/lib/catalogue/favourites-api", () => ({
  setCatalogueFavourite: (...args: unknown[]) => setFavourite(...args),
}));

import { DELETE, PUT } from "./route";

describe("Catalogue favourite mutation API", () => {
  beforeEach(() => {
    authenticate.mockReset();
    setFavourite.mockReset();
    authenticate.mockResolvedValue({
      ok: true,
      supabase: { caller: true },
      user: { id: userId },
    });
    setFavourite.mockResolvedValue({ ok: true });
  });

  it("uses the verified caller identity for idempotent save and remove", async () => {
    const saved = await PUT(request(), context("venue", venueId));
    const removed = await DELETE(request(), context("venue", venueId));

    expect(saved.status).toBe(200);
    expect(removed.status).toBe(200);
    expect(setFavourite.mock.calls).toEqual([
      [{ caller: true }, userId, "venue", venueId, true],
      [{ caller: true }, userId, "venue", venueId, false],
    ]);
    expect(saved.headers.get("vary")).toBe("Authorization");
  });

  it("fails closed when the target is no longer public", async () => {
    setFavourite.mockResolvedValue({ ok: false, reason: "target_not_found" });
    const response = await PUT(request(), context("supplier", venueId));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "favourite_target_not_found" });
  });
});

const userId = "20000000-0000-4000-8000-000000000002";
const venueId = "10000000-0000-4000-8000-000000000001";
function request() {
  return new Request("https://www.everaft.co.uk/api/catalogue/v1/favourites/venue/target", {
    headers: { Authorization: "Bearer test-token" },
  });
}
function context(kind: string, id: string) {
  return { params: Promise.resolve({ kind, id }) };
}
