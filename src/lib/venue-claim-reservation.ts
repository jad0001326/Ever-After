import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type AdminClient = SupabaseClient<Database>;

type ReservationResult =
  | { ok: true; venue: { name: string; slug: string } }
  | { ok: false; message: string };

/**
 * Atomically reserves an unclaimed venue for review after its claim row exists.
 * The service-role client is required because ordinary users cannot update venues.
 */
export async function reserveVenueForClaim(
  admin: AdminClient,
  input: { claimId: string; venueId: string; slug: string }
): Promise<ReservationResult> {
  const { data: venue, error } = await admin
    .from("venues")
    .update({ claim_status: "pending" })
    .eq("id", input.venueId)
    .eq("slug", input.slug)
    .eq("is_claimed", false)
    .in("claim_status", ["unclaimed", "rejected"])
    .select("name, slug")
    .maybeSingle();

  if (error || !venue) {
    const { error: rollbackError } = await admin
      .from("venue_claims")
      .delete()
      .eq("id", input.claimId);

    return {
      ok: false,
      message: rollbackError
        ? "We could not safely submit this claim. Please contact EverAft."
        : "This venue is already claimed or has a claim under review."
    };
  }

  return { ok: true, venue };
}
