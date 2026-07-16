import type { Metadata } from "next";
import Link from "next/link";
import { SupplierForm } from "@/components/admin/supplier-form";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Add supplier profile" };

export default async function NewSupplierPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  await requireAdmin();
  const { message } = await searchParams;
  return <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8"><Link className="text-sm font-semibold text-[#35533e]" href="/admin/suppliers">Back to suppliers</Link><p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">New directory profile</p><h1 className="mt-3 font-display text-5xl font-semibold">Add a supplier</h1>{message ? <p className="mt-5 rounded-2xl bg-[#fff4ed] px-4 py-3 text-sm text-[#9e341f]">{message}</p> : null}<div className="mt-8"><SupplierForm /></div></div>;
}

