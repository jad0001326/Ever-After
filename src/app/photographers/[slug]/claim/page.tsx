import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicSupplierClaimPage } from "@/components/supplier/public-supplier-claim-page";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Claim photographer profile", robots: { index: false, follow: false } };

export default async function ClaimPhotographerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireUser(`/photographers/${slug}/claim`, "Sign in or create an account to claim this photographer profile");
  const supabase = createAdminClient();
  if (!supabase) notFound();
  const { data: supplier } = await supabase
    .from("supplier_listings")
    .select("id, slug, name, base_town, region, is_claimed")
    .eq("slug", slug)
    .eq("category_slug", "photographer")
    .eq("listing_status", "published")
    .maybeSingle();
  if (!supplier || supplier.is_claimed) notFound();
  return <PublicSupplierClaimPage categoryLabel="Photographer" categorySlug="photographer" supplier={supplier} />;
}
