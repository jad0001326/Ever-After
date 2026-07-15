import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/utils";
import { budgetStarters } from "@/lib/budget/starters";
import { venueCollections } from "@/lib/venue-collections";
import { planningGuides } from "@/lib/planning-guides";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const supabase = await createClient();
  const { data: venues } = supabase
    ? await supabase.from("venues").select("slug, updated_at").eq("status", "published").order("updated_at", { ascending: false })
    : { data: [] };

  return [
    { url: absoluteUrl("/"), lastModified: now, priority: 1 },
    { url: absoluteUrl("/venues"), lastModified: now, priority: 0.9 },
    { url: absoluteUrl("/wedding-budget-planner"), lastModified: now, priority: 0.9 },
    { url: absoluteUrl("/guides"), lastModified: now, priority: 0.9 },
    ...planningGuides.map((guide) => ({
      url: absoluteUrl(`/guides/${guide.slug}`),
      lastModified: guide.updatedAt,
      priority: guide.featured ? 0.85 : 0.8
    })),
    ...budgetStarters.map((starter) => ({
      url: absoluteUrl(`/wedding-budget-planner/${starter.slug}`),
      lastModified: now,
      priority: 0.8
    })),
    ...venueCollections.map((collection) => ({
      url: absoluteUrl(`/wedding-venues/${collection.slug}`),
      lastModified: now,
      priority: 0.85
    })),
    { url: absoluteUrl("/for-business"), lastModified: now, priority: 0.8 },
    { url: absoluteUrl("/about"), lastModified: now, priority: 0.6 },
    { url: absoluteUrl("/contact"), lastModified: now, priority: 0.5 },
    { url: absoluteUrl("/privacy"), lastModified: now, priority: 0.3 },
    { url: absoluteUrl("/terms"), lastModified: now, priority: 0.3 },
    { url: absoluteUrl("/supplier-terms"), lastModified: now, priority: 0.3 },
    ...(venues ?? []).map((venue) => ({
      url: absoluteUrl(`/venues/${venue.slug}`),
      lastModified: venue.updated_at,
      priority: 0.8
    }))
  ];
}
