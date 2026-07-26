import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/utils";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/login", "/signup", "/vendor", "/newsletter", "/planning-hub/join"]
    },
    sitemap: absoluteUrl("/sitemap.xml")
  };
}
