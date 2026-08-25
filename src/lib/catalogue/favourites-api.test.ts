import { describe, expect, it, vi } from "vitest";
import { setCatalogueFavourite } from "./favourites-api";

describe("catalogue favourite target validation", () => {
  it("never inserts a withdrawn or internal-test venue bookmark", async () => {
    const target = builder({ data: null, error: null });
    const insert = vi.fn();
    const supabase = {
      from: vi.fn((table: string) => table === "venues" ? target : { insert }),
    };

    const result = await setCatalogueFavourite(
      supabase as never,
      "20000000-0000-4000-8000-000000000002",
      "venue",
      "10000000-0000-4000-8000-000000000001",
      true,
    );

    expect(result).toEqual({ ok: false, reason: "target_not_found" });
    expect(target.eq).toHaveBeenCalledWith("status", "published");
    expect(target.not).toHaveBeenCalledWith("slug", "like", "everaft-internal-test-%");
    expect(insert).not.toHaveBeenCalled();
  });
});

function builder(result: unknown) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "eq", "in", "not"]) {
    query[method] = vi.fn(() => query);
  }
  query.maybeSingle = vi.fn(async () => result);
  return query;
}
