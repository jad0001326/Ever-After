import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicSupplierProfile } from "@/components/supplier/public-supplier-profile";
import { buildMetadata } from "@/lib/seo";
import { getPhotographerListingBySlug } from "@/lib/suppliers";

type PhotographerPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PhotographerPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supplier = await getPhotographerListingBySlug(slug);
  if (!supplier) return { title: "Photographer not found" };
  return buildMetadata({
    title: `${supplier.name} | Wedding Photographer`,
    description: supplier.summary,
    path: `/photographers/${supplier.slug}`,
    image: supplier.heroImageUrl,
    keywords: [`${supplier.name} wedding photographer`, `wedding photographer ${supplier.region}`, "Scottish wedding photography"],
  });
}

export default async function PhotographerDetailPage({ params }: PhotographerPageProps) {
  const { slug } = await params;
  const supplier = await getPhotographerListingBySlug(slug);
  if (!supplier) notFound();
  return <PublicSupplierProfile categoryLabel="Photographer" categoryPlural="Photographers" supplier={supplier} />;
}
