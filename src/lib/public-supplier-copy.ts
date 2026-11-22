import type { SupplierCategorySlug } from "@/types/supplier";

type PublicCategory = {
  slug: SupplierCategorySlug;
  label: string;
  plural: string;
};

export type PublicSupplierCategoryCopy = {
  eyebrow: string;
  title: string;
  description: string;
  intro: string;
  keywords: string[];
  emptyTitle: string;
  emptyBody: string;
  filteredEmptyTitle: string;
  filteredEmptyBody: string;
};

export function publicSupplierCategoryCopy(category: PublicCategory): PublicSupplierCategoryCopy {
  if (category.slug === "videographer") {
    return {
      eyebrow: "Wedding films",
      title: "Wedding videographers for Scottish celebrations",
      description: "Find wedding videographers who cover celebrations in Scotland, including filmmakers based here and those who travel in from elsewhere in the UK.",
      intro: "Each profile shows where a videographer is based and how far they travel, so a team from Scotland or from England is described on its own terms.",
      keywords: ["wedding videographers Scotland", "wedding films Scotland", "videographer for a Scottish wedding"],
      emptyTitle: "Videographers are being added carefully",
      emptyBody: "EverAft publishes a profile only after the business details are ready. If you film weddings in Scotland, you can apply to be listed.",
      filteredEmptyTitle: "No videographers match that search",
      filteredEmptyBody: "Try a wider location or budget. A videographer based outside Scotland can still cover part of the country, so clearing a tight filter may show them."
    };
  }

  const plural = category.plural.toLowerCase();
  return {
    eyebrow: "Scottish wedding suppliers",
    title: `Find ${plural} for your plan`,
    description: `Discover wedding ${plural} covering Scottish celebrations, with clear locations and the details couples need before they enquire.`,
    intro: "Compare useful details without loading the whole catalogue, then carry a decision into the EverAft budget.",
    keywords: [`wedding ${plural} Scotland`, `Scottish wedding ${plural}`],
    emptyTitle: `No ${plural} are published yet`,
    emptyBody: "Profiles appear here after they have been reviewed. Businesses can apply to join the directory.",
    filteredEmptyTitle: "No suitable profiles found",
    filteredEmptyBody: "Try a broader location or budget, or clear the search to see every published profile."
  };
}

export function publicSupplierProfileKeywords(
  category: PublicCategory,
  supplier: { name: string; baseTown: string; region: string },
) {
  if (category.slug === "videographer") {
    return [
      `${supplier.name} wedding videographer`,
      `wedding videographer ${supplier.baseTown}`,
      `wedding films ${supplier.region}`,
      "wedding videographer for a Scottish celebration"
    ];
  }
  return [
    `${supplier.name} wedding ${category.label.toLowerCase()}`,
    `wedding ${category.label.toLowerCase()} ${supplier.region}`,
    `Scottish wedding ${category.plural.toLowerCase()}`
  ];
}
