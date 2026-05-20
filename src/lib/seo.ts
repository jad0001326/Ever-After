import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/utils";

export const SITE_NAME = "EverAft";
export const DEFAULT_OG_IMAGE = absoluteUrl("/icon.svg");

export function buildMetadata({
  title,
  description,
  path = "/",
  image = DEFAULT_OG_IMAGE,
  keywords
}: {
  title: string;
  description: string;
  path?: string;
  image?: string;
  keywords?: string[];
}): Metadata {
  const url = absoluteUrl(path);

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: path
    },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: SITE_NAME,
      locale: "en_GB",
      images: [{ url: image, alt: `${title} | ${SITE_NAME}` }]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image]
    }
  };
}

export function buildBreadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path)
    }))
  };
}
