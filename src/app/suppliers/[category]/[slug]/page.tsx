import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { PublicSupplierProfile } from "@/components/supplier/public-supplier-profile";
import { publicSupplierProfileKeywords } from "@/lib/public-supplier-copy";
import { buildMetadata } from "@/lib/seo";
import {
  getPublicSupplierCategory,
  publicSupplierProfilePath,
} from "@/lib/supplier-public-routes";
import { getSupplierListingBySlug } from "@/lib/suppliers";

type SupplierPageProps = { params: Promise<{ category: string; slug: string }> };

export async function generateMetadata({ params }: SupplierPageProps): Promise<Metadata> {
  const { category: categorySlug, slug } = await params;
  const category = getPublicSupplierCategory(categorySlug);
  if (!category) return { title: "Supplier not found", robots: { index: false, follow: false } };
  if (category.slug === "photographer") return { title: "Wedding Photographer" };
  const supplier = await getSupplierListingBySlug(category.slug, slug);
  if (!supplier) return { title: `${category.label} not found`, robots: { index: false, follow: false } };
  return buildMetadata({
    title: `${supplier.name} | Wedding ${category.label}`,
    description: supplier.summary,
    path: publicSupplierProfilePath(category.slug, supplier.slug),
    image: supplier.heroImageUrl,
    keywords: publicSupplierProfileKeywords(category, supplier),
  });
}

export default async function SupplierDetailPage({ params }: SupplierPageProps) {
  const { category: categorySlug, slug } = await params;
  const category = getPublicSupplierCategory(categorySlug);
  if (!category) notFound();
  if (category.slug === "photographer") permanentRedirect(`/photographers/${slug}`);
  const supplier = await getSupplierListingBySlug(category.slug, slug);
  if (!supplier) notFound();
  return <PublicSupplierProfile categoryLabel={category.label} categoryPlural={category.plural} supplier={supplier} />;
}
