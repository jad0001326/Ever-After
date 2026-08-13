import type { SupabaseClient } from "@supabase/supabase-js";
import type { WeddingProfile } from "./profile";
import type { Database } from "@/types/database";

type PlanningSupabaseClient = SupabaseClient<Database>;
type PlanningProfileRow =
  Database["public"]["Tables"]["planning_workspace_profiles"]["Row"];
type PlanningProfileSelectedRow = Pick<
  PlanningProfileRow,
  | "workspace_id"
  | "wedding_date"
  | "guest_count"
  | "location"
  | "date_flexibility"
  | "location_flexible"
  | "priorities"
  | "venue_styles"
  | "photography_styles"
  | "vision"
  | "updated_at"
>;

const profileColumns =
  "workspace_id, wedding_date, guest_count, location, date_flexibility, location_flexible, priorities, venue_styles, photography_styles, vision, updated_at";

type PlanningProfileContent = Omit<WeddingProfile, "updatedAt">;

export async function loadPlanningProfile(
  supabase: PlanningSupabaseClient,
  workspaceId: string,
) {
  const { data, error } = await supabase
    .from("planning_workspace_profiles")
    .select(profileColumns)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) return { ok: false, reason: "unavailable" } as const;
  return {
    ok: true,
    profile: data ? profileFromRow(data) : null,
  } as const;
}

export async function savePlanningProfile(
  supabase: PlanningSupabaseClient,
  workspaceId: string,
  profile: PlanningProfileContent,
  expectedProfileUpdatedAt: string | null,
) {
  const values = profileToColumns(profile);
  if (expectedProfileUpdatedAt === null) {
    const { data, error } = await supabase
      .from("planning_workspace_profiles")
      .insert({ workspace_id: workspaceId, ...values })
      .select(profileColumns)
      .single();
    if (error?.code === "23505") {
      return { ok: false, reason: "version_conflict" } as const;
    }
    if (error || !data) {
      return { ok: false, reason: "unavailable" } as const;
    }
    return {
      ok: true,
      profile: profileFromRow(data),
    } as const;
  }

  const { data, error } = await supabase
    .from("planning_workspace_profiles")
    .update(values)
    .eq("workspace_id", workspaceId)
    .eq("updated_at", expectedProfileUpdatedAt)
    .select(profileColumns)
    .maybeSingle();
  if (error) return { ok: false, reason: "unavailable" } as const;
  if (!data) return { ok: false, reason: "version_conflict" } as const;
  return {
    ok: true,
    profile: profileFromRow(data),
  } as const;
}

function profileToColumns(profile: PlanningProfileContent) {
  return {
    wedding_date: profile.weddingDate,
    guest_count: profile.guestCount,
    location: profile.location,
    date_flexibility: profile.dateFlexibility,
    location_flexible: profile.locationFlexible,
    priorities: profile.priorities,
    venue_styles: profile.venueStyles,
    photography_styles: profile.photographyStyles,
    vision: profile.vision,
  };
}

function profileFromRow(row: PlanningProfileSelectedRow): WeddingProfile {
  return {
    schemaVersion: 1,
    weddingDate: row.wedding_date,
    guestCount: row.guest_count,
    location: row.location,
    dateFlexibility: row.date_flexibility,
    locationFlexible: row.location_flexible,
    priorities: row.priorities as WeddingProfile["priorities"],
    venueStyles: row.venue_styles,
    photographyStyles: row.photography_styles,
    vision: row.vision,
    updatedAt: row.updated_at,
  };
}
