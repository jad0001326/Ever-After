import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SupplierForm } from "@/components/admin/supplier-form";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Edit supplier profile" };

export default async function EditSupplierPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ message?: string }> }) {
  await requireAdmin();
  const [{ id }, { message }] = await Promise.all([params, searchParams]);
  const supabase = createAdminClient();
  if (!supabase) notFound();
  const [{ data: supplier }, { data: photographer }] = await Promise.all([
    supabase.from("supplier_listings").select("*").eq("id", id).maybeSingle(),
    supabase.from("photographer_profiles").select("*").eq("supplier_id", id).maybeSingle()
  ]);
  if (!supplier) notFound();
  return <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8"><div className="flex flex-wrap items-center justify-between gap-3"><Link className="text-sm font-semibold text-[#35533e]" href="/admin/suppliers">Back to suppliers</Link>{supplier.listing_status === "published" && supplier.category_slug === "photographer" ? <Link className="text-sm font-semibold text-[#95502b]" href={`/photographers/${supplier.slug}`} target="_blank">View public profile</Link> : null}</div><p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">Supplier directory</p><h1 className="mt-3 font-display text-5xl font-semibold">Edit {supplier.name}</h1>{message ? <p className="mt-5 rounded-2xl bg-[#eef4ea] px-4 py-3 text-sm text-[#285237]">{message}</p> : null}<div className="mt-8"><SupplierForm photographer={photographer} supplier={supplier} /></div></div>;
}

