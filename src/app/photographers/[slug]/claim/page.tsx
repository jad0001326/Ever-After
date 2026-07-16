import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, FileCheck2, ImagePlus, ShieldCheck } from "lucide-react";
import { SupplierClaimForm } from "@/components/supplier/supplier-claim-form";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Claim photographer profile" };

export default async function ClaimPhotographerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireUser(`/photographers/${slug}/claim`, "Sign in or create an account to claim this photographer profile");
  const supabase = createAdminClient();
  if (!supabase) notFound();
  const { data: supplier } = await supabase.from("supplier_listings").select("id, slug, name, base_town, region, is_claimed").eq("slug", slug).eq("category_slug", "photographer").maybeSingle();
  if (!supplier || supplier.is_claimed) notFound();
  const steps = [[ShieldCheck, "Use your business email and explain your role."], [FileCheck2, "Include evidence linking you to the photography business."], [ImagePlus, "Portfolio images remain private unless you approve their use."], [CheckCircle2, "EverAft reviews every claim before granting access."]] as const;
  return <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8"><Link className="text-sm font-semibold text-[#5c6b52]" href="/photographers">Back to photographers</Link><div className="mt-6 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]"><section className="self-start rounded-3xl border border-[var(--line)] bg-white p-6"><p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#9d7b45]">Claim this profile</p><h1 className="mt-3 font-display text-5xl font-semibold">{supplier.name}</h1><p className="mt-3 text-sm text-[var(--muted)]">{supplier.base_town}, {supplier.region}</p><p className="mt-4 leading-7 text-[var(--muted)]">Verify your connection to this business so you can review its draft details and decide what may be published.</p><div className="mt-6 grid gap-4 text-sm leading-6 text-[#4f4a43]">{steps.map(([Icon, text]) => <div className="flex gap-3" key={text}><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[#f4efe7] text-[#8b6d3c]"><Icon size={16} /></span><p>{text}</p></div>)}</div></section><SupplierClaimForm supplierId={supplier.id} supplierSlug={supplier.slug} /></div></div>;
}
