import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/utils";
import { budgetStarters } from "@/lib/budget/starters";
import { venueCollections } from "@/lib/venue-collections";
import { planningGuides } from "@/lib/planning-guides";
import { INTERNAL_TEST_VENUE_SLUG_PREFIX } from "@/lib/internal-test-venue";
import { supplierDirectoryCategories } from "@/data/supplier-directory";
import { getPublicSupplierCategory, publicSupplierCategoryPath, publicSupplierProfilePath } from "@/lib/supplier-public-routes";
import type { SupplierCategorySlug } from "@/types/supplier";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const publicCategoryConfigs: ReadonlyArray<{ slug: SupplierCategorySlug; live: boolean }> = supplierDirectoryCategories;
  const supabase = await createClient();
  const [{ data: venues }, { data: suppliers }] = supabase
    ? await Promise.all([
      supabase.from("venues").select("slug, updated_at").eq("status", "published").in("listing_status", ["published", "claimed"]).not("slug", "like", `${INTERNAL_TEST_VENUE_SLUG_PREFIX}%`).order("updated_at", { ascending: false }),
      supabase.from("supplier_listings").select("category_slug, slug, updated_at").eq("listing_status", "published").order("updated_at", { ascending: false })
    ])
    : [{ data: [] }, { data: [] }];

  return [
    { url: absoluteUrl("/"), lastModified: now, priority: 1 },
    { url: absoluteUrl("/venues"), lastModified: now, priority: 0.9 },
    { url: absoluteUrl("/photographers"), lastModified: now, priority: 0.9 },
    ...publicCategoryConfigs.filter((category) => category.live && category.slug !== "photographer").map((category) => ({
      url: absoluteUrl(publicSupplierCategoryPath(category.slug)),
      lastModified: now,
      priority: 0.85
    })),
    { url: absoluteUrl("/wedding-budget-planner"), lastModified: now, priority: 0.9 },
    { url: absoluteUrl("/wedding-table-planner"), lastModified: now, priority: 0.9 },
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
    })),
    ...(suppliers ?? []).flatMap((supplier) => {
      const category = getPublicSupplierCategory(supplier.category_slug);
      return category ? [{
        url: absoluteUrl(publicSupplierProfilePath(category.slug, supplier.slug)),
        lastModified: supplier.updated_at,
        priority: 0.8
      }] : [];
    })
  ];
}
