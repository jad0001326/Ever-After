import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Photographer claim reviews" };
export default async function SupplierClaimsPage() {
  await requireAdmin(); const supabase = createAdminClient();
  const [{ data: claims }, { data: suppliers }] = await Promise.all([supabase!.from("supplier_claims").select("*").order("created_at", { ascending: false }), supabase!.from("supplier_listings").select("id, name, slug, base_town, region")]);
  const byId = new Map((suppliers ?? []).map((supplier) => [supplier.id, supplier])); const pending = (claims ?? []).filter((claim) => claim.status === "pending").length;
  return <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8"><div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#9d7b45]">Admin CMS</p><h1 className="mt-3 font-display text-5xl font-semibold">Photographer claims</h1><p className="mt-3 text-[var(--muted)]">Verify ownership before granting supplier access.</p></div><ButtonLink href="/admin" variant="secondary">Back to admin</ButtonLink></div><div className="mb-5 flex items-center gap-2 text-sm text-[var(--muted)]"><CheckCircle2 className="text-[#6a7a5d]" size={17} />{pending} pending claim{pending === 1 ? "" : "s"}</div><div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white">{(claims ?? []).map((claim) => { const supplier = byId.get(claim.supplier_id); return <Link className="grid gap-3 border-b border-[var(--line)] px-5 py-4 transition last:border-b-0 hover:bg-[#fbf8f3] sm:grid-cols-[1.2fr_1fr_auto]" href={`/admin/supplier-claims/${claim.id}`} key={claim.id}><div><p className="font-semibold">{supplier?.name ?? "Unknown supplier"}</p><p className="mt-1 text-sm text-[var(--muted)]">{supplier ? `${supplier.base_town}, ${supplier.region}` : "Profile unavailable"}</p></div><div className="text-sm text-[var(--muted)]"><p className="font-medium text-[#4a443c]">{claim.claimant_name}</p><p>{claim.business_email}</p></div><span className="inline-flex items-center gap-2 text-sm font-semibold text-[#4f5e46]">{claim.status} <ArrowRight size={15} /></span></Link>; })}{(claims ?? []).length === 0 ? <p className="px-5 py-8 text-sm text-[var(--muted)]">No photographer claims yet.</p> : null}</div></div>;
}
