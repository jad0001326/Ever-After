import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { PublicSupplierClaimPage } from "@/components/supplier/public-supplier-claim-page";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPublicSupplierCategory,
  publicSupplierClaimPath,
} from "@/lib/supplier-public-routes";

export const metadata: Metadata = { title: "Claim supplier profile", robots: { index: false, follow: false } };

export default async function ClaimSupplierPage({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category: categorySlug, slug } = await params;
  const category = getPublicSupplierCategory(categorySlug);
  if (!category) notFound();
  if (category.slug === "photographer") permanentRedirect(`/photographers/${slug}/claim`);
  const claimPath = publicSupplierClaimPath(category.slug, slug);
  await requireUser(claimPath, `Sign in or create an account to claim this ${category.label.toLowerCase()} profile`);
  const supabase = createAdminClient();
  if (!supabase) notFound();
  const { data: supplier } = await supabase
    .from("supplier_listings")
    .select("id, slug, name, base_town, region, is_claimed")
    .eq("slug", slug)
    .eq("category_slug", category.slug)
    .eq("listing_status", "published")
    .maybeSingle();
  if (!supplier || supplier.is_claimed) notFound();
  return <PublicSupplierClaimPage categoryLabel={category.label} categorySlug={category.slug} supplier={supplier} />;
}
