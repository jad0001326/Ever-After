import type { MetadataRoute } from "next";
import { venues } from "@/data/venues";
import { absoluteUrl } from "@/lib/utils";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: absoluteUrl("/"), lastModified: now, priority: 1 },
    { url: absoluteUrl("/venues"), lastModified: now, priority: 0.9 },
    ...venues.map((venue) => ({
      url: absoluteUrl(`/venues/${venue.slug}`),
      lastModified: now,
      priority: 0.8
    }))
  ];
}
