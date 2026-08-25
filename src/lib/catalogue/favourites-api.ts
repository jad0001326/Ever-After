import type { SupabaseClient } from "@supabase/supabase-js";
import { INTERNAL_TEST_VENUE_SLUG_PREFIX } from "@/lib/internal-test-venue";
import type { Database } from "@/types/database";

type CallerClient = SupabaseClient<Database>;
export type CatalogueFavouriteKind = "venue" | "supplier";

export async function listCatalogueFavourites(
  supabase: CallerClient,
  userId: string,
  limit: number,
) {
  const [venues, suppliers] = await Promise.all([
    supabase
      .from("favourites")
      .select("venue_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(0, limit),
    supabase
      .from("supplier_favourites")
      .select("supplier_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(0, limit),
  ]);
  if (venues.error || suppliers.error) return { ok: false as const };
  const venueRows = venues.data ?? [];
  const supplierRows = suppliers.data ?? [];
  return {
    ok: true as const,
    venueIds: venueRows.slice(0, limit).map((row) => row.venue_id),
    supplierIds: supplierRows.slice(0, limit).map((row) => row.supplier_id),
    hasMore: {
      venues: venueRows.length > limit,
      suppliers: supplierRows.length > limit,
    },
  };
}

export async function setCatalogueFavourite(
  supabase: CallerClient,
  userId: string,
  kind: CatalogueFavouriteKind,
  id: string,
  saved: boolean,
) {
  if (saved && !await targetIsPublished(supabase, kind, id)) {
    return { ok: false as const, reason: "target_not_found" as const };
  }

  if (kind === "venue") {
    return setVenueFavourite(supabase, userId, id, saved);
  }
  return setSupplierFavourite(supabase, userId, id, saved);
}

async function setVenueFavourite(
  supabase: CallerClient,
  userId: string,
  id: string,
  saved: boolean,
) {
  if (!saved) {
    const result = await supabase
      .from("favourites")
      .delete()
      .eq("user_id", userId)
      .eq("venue_id", id);
    return result.error
      ? { ok: false as const, reason: "unavailable" as const }
      : { ok: true as const };
  }

  const existing = await supabase
    .from("favourites")
    .select("venue_id")
    .eq("user_id", userId)
    .eq("venue_id", id)
    .maybeSingle();
  if (existing.error) return { ok: false as const, reason: "unavailable" as const };
  if (existing.data) return { ok: true as const };

  const inserted = await supabase.from("favourites").insert({ user_id: userId, venue_id: id });
  if (!inserted.error || inserted.error.code === "23505") return { ok: true as const };
  return { ok: false as const, reason: "unavailable" as const };
}

async function setSupplierFavourite(
  supabase: CallerClient,
  userId: string,
  id: string,
  saved: boolean,
) {
  if (!saved) {
    const result = await supabase
      .from("supplier_favourites")
      .delete()
      .eq("user_id", userId)
      .eq("supplier_id", id);
    return result.error
      ? { ok: false as const, reason: "unavailable" as const }
      : { ok: true as const };
  }

  const existing = await supabase
    .from("supplier_favourites")
    .select("supplier_id")
    .eq("user_id", userId)
    .eq("supplier_id", id)
    .maybeSingle();
  if (existing.error) return { ok: false as const, reason: "unavailable" as const };
  if (existing.data) return { ok: true as const };

  const inserted = await supabase.from("supplier_favourites").insert({ user_id: userId, supplier_id: id });
  if (!inserted.error || inserted.error.code === "23505") return { ok: true as const };
  return { ok: false as const, reason: "unavailable" as const };
}

async function targetIsPublished(
  supabase: CallerClient,
  kind: CatalogueFavouriteKind,
  id: string,
) {
  if (kind === "venue") {
    const result = await supabase
      .from("venues")
      .select("id")
      .eq("id", id)
      .eq("status", "published")
      .in("listing_status", ["published", "claimed"])
      .not("slug", "like", `${INTERNAL_TEST_VENUE_SLUG_PREFIX}%`)
      .maybeSingle();
    return !result.error && Boolean(result.data);
  }
  const result = await supabase
    .from("supplier_listings")
    .select("id")
    .eq("id", id)
    .eq("listing_status", "published")
    .maybeSingle();
  return !result.error && Boolean(result.data);
}
