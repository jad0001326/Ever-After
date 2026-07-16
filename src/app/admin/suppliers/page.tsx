import type { Metadata } from "next";
import Link from "next/link";
import { Edit, Plus, UsersRound } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { gbp } from "@/lib/utils";

export const metadata: Metadata = { title: "Supplier profiles" };

export default async function AdminSuppliersPage({ searchParams }: { searchParams: Promise<{ message?: string; status?: string; category?: string }> }) {
  await requireAdmin();
  const { message, status, category } = await searchParams;
  const supabase = createAdminClient();
  let query = supabase?.from("supplier_listings").select("id, slug, name, category_slug, base_town, region, starting_price_pence, listing_status, is_claimed, is_featured, updated_at").order("updated_at", { ascending: false });
  if (query && (status === "draft" || status === "published" || status === "archived")) query = query.eq("listing_status", status);
  if (query && category) query = query.eq("category_slug", category);
  const { data, error } = query ? await query : { data: [], error: new Error("Configure the Supabase service role key to manage suppliers.") };
  const suppliers = data ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><Link className="text-sm font-semibold text-[#35533e]" href="/admin">Back to admin</Link><p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">Directory expansion</p><h1 className="mt-3 font-display text-5xl font-semibold">Supplier profiles</h1><p className="mt-3 text-[var(--muted)]">Build and review photographers first, with the same foundation ready for every supplier category.</p></div>
        <ButtonLink href="/admin/suppliers/new"><Plus size={17} /> Add supplier</ButtonLink>
      </div>
      {message ? <p className="mt-6 rounded-2xl bg-[#eef4ea] px-4 py-3 text-sm text-[#285237]">{message}</p> : null}
      {error ? <p className="mt-6 rounded-2xl bg-[#fff4ed] px-4 py-3 text-sm text-[#9e341f]">{error.message}</p> : null}
      <div className="mt-7 flex flex-wrap gap-2 text-sm font-semibold"><FilterLink active={!status} href="/admin/suppliers">All</FilterLink><FilterLink active={status === "draft"} href="/admin/suppliers?status=draft">Drafts</FilterLink><FilterLink active={status === "published"} href="/admin/suppliers?status=published">Published</FilterLink><FilterLink active={category === "photographer"} href="/admin/suppliers?category=photographer">Photographers</FilterLink></div>
      <section className="mt-6 overflow-hidden rounded-3xl border border-[var(--line)] bg-white">
        <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-[var(--line)] px-5 py-4 text-sm font-semibold text-[#5a5248] lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.7fr_auto]"><span>Business</span><span className="hidden lg:block">Location</span><span className="hidden lg:block">Pricing</span><span className="hidden lg:block">Status</span><span>Action</span></div>
        {suppliers.map((supplier) => <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-[var(--line)] px-5 py-4 last:border-b-0 lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.7fr_auto]" key={supplier.id}><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{supplier.name}</p>{supplier.is_featured ? <span className="rounded-full bg-[#fff5dc] px-2 py-0.5 text-[10px] font-semibold text-[#7d5e24]">Featured</span> : null}</div><p className="mt-1 text-xs text-[var(--muted)]">{supplier.category_slug} · {supplier.is_claimed ? "claimed" : "unclaimed"}</p><p className="mt-1 text-xs text-[var(--muted)] lg:hidden">{supplier.base_town}, {supplier.region}</p></div><p className="hidden text-sm text-[var(--muted)] lg:block">{supplier.base_town}, {supplier.region}</p><p className="hidden text-sm text-[var(--muted)] lg:block">{supplier.starting_price_pence == null ? "Not confirmed" : `From ${gbp.format(supplier.starting_price_pence / 100)}`}</p><span className={`hidden w-fit rounded-full px-3 py-1 text-xs font-semibold lg:inline-flex ${supplier.listing_status === "published" ? "bg-[#e8f2e5] text-[#345033]" : "bg-[#f2ede4] text-[#665b4c]"}`}>{supplier.listing_status}</span><Link aria-label={`Edit ${supplier.name}`} className="focus-ring grid size-10 place-items-center rounded-full bg-[#f4efe7] text-[#3f4d38] transition hover:bg-[#e8dece]" href={`/admin/suppliers/${supplier.id}/edit`}><Edit size={16} /></Link></div>)}
        {!suppliers.length && !error ? <div className="p-10 text-center"><UsersRound className="mx-auto text-[#9d7b45]" size={26} /><h2 className="mt-4 font-display text-3xl font-semibold">No supplier profiles yet</h2><p className="mt-2 text-sm text-[var(--muted)]">Add the first photographer or approve a supplier application.</p></div> : null}
      </section>
    </div>
  );
}

function FilterLink({ active, children, href }: { active: boolean; children: React.ReactNode; href: string }) { return <Link className={active ? "rounded-full bg-[var(--brand)] px-4 py-2 text-white" : "rounded-full bg-white px-4 py-2 text-[#4d483f] ring-1 ring-[var(--line)]"} href={href}>{children}</Link>; }
