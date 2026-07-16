export const supplierDirectoryCategories = [
  { slug: "photographer", label: "Photographer", plural: "Photographers", budgetCategoryId: "photography", live: true },
  { slug: "videographer", label: "Videographer", plural: "Videographers", budgetCategoryId: "videography", live: false },
  { slug: "celebrant", label: "Celebrant", plural: "Celebrants", budgetCategoryId: "registrar-celebrant", live: false },
  { slug: "florist", label: "Florist", plural: "Florists", budgetCategoryId: "flowers", live: false },
  { slug: "wedding-planner", label: "Wedding planner", plural: "Wedding planners", budgetCategoryId: "miscellaneous", live: false },
  { slug: "band-musician", label: "Band or musician", plural: "Bands and musicians", budgetCategoryId: "dj-band", live: false },
  { slug: "dj", label: "DJ", plural: "DJs", budgetCategoryId: "dj-band", live: false },
  { slug: "caterer", label: "Caterer", plural: "Caterers", budgetCategoryId: "catering", live: false },
  { slug: "cake-maker", label: "Cake maker", plural: "Cake makers", budgetCategoryId: "cake", live: false },
  { slug: "styling-decor", label: "Styling and decor", plural: "Stylists and decor suppliers", budgetCategoryId: "decor", live: false },
  { slug: "transport", label: "Transport", plural: "Transport suppliers", budgetCategoryId: "transport", live: false },
  { slug: "bridal-boutique", label: "Bridal boutique", plural: "Bridal boutiques", budgetCategoryId: "wedding-dress", live: false },
  { slug: "hair-makeup", label: "Hair and makeup", plural: "Hair and makeup artists", budgetCategoryId: "hair-makeup", live: false },
  { slug: "stationery", label: "Stationery", plural: "Stationers", budgetCategoryId: "stationery", live: false },
  { slug: "entertainment", label: "Entertainment", plural: "Entertainment suppliers", budgetCategoryId: "entertainment", live: false },
  { slug: "jeweller", label: "Jeweller", plural: "Jewellers", budgetCategoryId: "rings", live: false }
] as const;

export const photographerStyles = [
  "Documentary",
  "Editorial",
  "Fine art",
  "Natural",
  "Traditional",
  "Creative",
  "Dark and moody",
  "Light and airy",
  "Film-inspired"
] as const;

export function supplierCategorySlugFromLabel(label: string) {
  const normalised = label.trim().toLowerCase();
  return supplierDirectoryCategories.find((category) => category.label.toLowerCase() === normalised)?.slug ?? null;
}

export function supplierCategoryBySlug(slug: string) {
  return supplierDirectoryCategories.find((category) => category.slug === slug);
}

