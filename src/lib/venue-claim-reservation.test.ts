import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { reserveVenueForClaim } from "@/lib/venue-claim-reservation";
import type { Database } from "@/types/database";

function reservationBuilder(result: { data: { name: string; slug: string } | null; error: { message: string } | null }) {
  const builder = {
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    select: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue(result)
  };
  return builder;
}

describe("reserveVenueForClaim", () => {
  it("marks an available venue pending with the trusted client", async () => {
    const venueBuilder = reservationBuilder({
      data: { name: "Test venue", slug: "test-venue" },
      error: null
    });
    const from = vi.fn(() => venueBuilder);
    const admin = { from } as unknown as SupabaseClient<Database>;

    const result = await reserveVenueForClaim(admin, {
      claimId: "claim-1",
      venueId: "venue-1",
      slug: "test-venue"
    });

    expect(result).toEqual({
      ok: true,
      venue: { name: "Test venue", slug: "test-venue" }
    });
    expect(venueBuilder.update).toHaveBeenCalledWith({ claim_status: "pending" });
    expect(venueBuilder.eq).toHaveBeenCalledWith("is_claimed", false);
    expect(venueBuilder.in).toHaveBeenCalledWith("claim_status", ["unclaimed", "rejected"]);
  });

  it("removes the new claim when the venue cannot be reserved", async () => {
    const venueBuilder = reservationBuilder({ data: null, error: null });
    const rollbackEq = vi.fn().mockResolvedValue({ error: null });
    const claimBuilder = {
      delete: vi.fn(() => ({ eq: rollbackEq }))
    };
    const from = vi.fn((table: string) => table === "venues" ? venueBuilder : claimBuilder);
    const admin = { from } as unknown as SupabaseClient<Database>;

    const result = await reserveVenueForClaim(admin, {
      claimId: "claim-1",
      venueId: "venue-1",
      slug: "test-venue"
    });

    expect(result).toEqual({
      ok: false,
      message: "This venue is already claimed or has a claim under review."
    });
    expect(from).toHaveBeenCalledWith("venue_claims");
    expect(rollbackEq).toHaveBeenCalledWith("id", "claim-1");
  });
});
