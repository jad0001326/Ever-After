import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/utils";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const supabase = await createClient();
  const { data: venues } = supabase
    ? await supabase.from("venues").select("slug, updated_at").eq("status", "published").order("updated_at", { ascending: false })
    : { data: [] };

  return [
    { url: absoluteUrl("/"), lastModified: now, priority: 1 },
    { url: absoluteUrl("/venues"), lastModified: now, priority: 0.9 },
    ...(venues ?? []).map((venue) => ({
      url: absoluteUrl(`/venues/${venue.slug}`),
      lastModified: venue.updated_at,
      priority: 0.8
    }))
  ];
}
