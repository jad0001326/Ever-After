import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Edit, Plus, UsersRound } from "lucide-react";
import { supplierCategoryBySlug, supplierDirectoryCategories } from "@/data/supplier-directory";
import { ButtonLink } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import {
  buildSupplierAdminDirectoryHref,
  getSupplierAdminDirectoryPageCount,
  getSupplierAdminDirectoryRange,
  parseSupplierAdminDirectoryFilters,
  supplierAdminStatuses,
} from "@/lib/supplier-admin-directory";
import { createAdminClient } from "@/lib/supabase/admin";
import { gbp } from "@/lib/utils";

export const metadata: Metadata = { title: "Supplier profiles" };

type SearchParams = Promise<{
  category?: string;
  message?: string;
  page?: string;
  status?: string;
}>;

export default async function AdminSuppliersPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const filters = parseSupplierAdminDirectoryFilters(params);
  const { from, to } = getSupplierAdminDirectoryRange(filters.page);
  const supabase = createAdminClient();
  let query = supabase
    ?.from("supplier_listings")
    .select(
      "id, slug, name, category_slug, base_town, region, starting_price_pence, listing_status, is_claimed, is_featured, updated_at",
      { count: "exact" },
    );
  if (query && filters.status) query = query.eq("listing_status", filters.status);
  if (query && filters.category) query = query.eq("category_slug", filters.category);
  query = query
    ?.order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, to);
  const result = query
    ? await query
    : { count: 0, data: [], error: new Error("Configure the Supabase service role key to manage suppliers.") };
  const suppliers = result.data ?? [];
  const total = result.count ?? 0;
  const pageCount = getSupplierAdminDirectoryPageCount(total);
  if (!result.error && filters.page > pageCount) {
    redirect(buildSupplierAdminDirectoryHref(filters, pageCount));
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link className="text-sm font-semibold text-[#35533e]" href="/admin">Back to admin</Link>
          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">Directory expansion</p>
          <h1 className="mt-3 font-display text-5xl font-semibold">Supplier profiles</h1>
          <p className="mt-3 text-[var(--muted)]">Review every category from one bounded catalogue view before anything is published.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/admin/supplier-staging" variant="secondary"><UsersRound size={17} /> Batch staging</ButtonLink>
          <ButtonLink href="/admin/suppliers/new"><Plus size={17} /> Add supplier</ButtonLink>
        </div>
      </div>

      {params.message ? <p className="mt-6 rounded-2xl bg-[#eef4ea] px-4 py-3 text-sm text-[#285237]">{params.message}</p> : null}
      {result.error ? <p className="mt-6 rounded-2xl bg-[#fff4ed] px-4 py-3 text-sm text-[#9e341f]">{result.error.message}</p> : null}

      <form action="/admin/suppliers" className="mt-7 grid gap-3 rounded-3xl border border-[var(--line)] bg-white p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:items-end" method="get">
        <label className="text-sm font-semibold text-[#4d483f]">
          <span className="mb-2 block">Category</span>
          <select className="focus-ring min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 font-normal" defaultValue={filters.category ?? ""} name="category">
            <option value="">All categories</option>
            {supplierDirectoryCategories.map((category) => <option key={category.slug} value={category.slug}>{category.plural}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-[#4d483f]">
          <span className="mb-2 block">Status</span>
          <select className="focus-ring min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 font-normal capitalize" defaultValue={filters.status ?? ""} name="status">
            <option value="">All statuses</option>
            {supplierAdminStatuses.map((status) => <option className="capitalize" key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <button className="focus-ring min-h-11 rounded-full bg-[var(--brand)] px-5 text-sm font-semibold text-white" type="submit">Apply filters</button>
        <Link className="focus-ring inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold text-[#35533e] ring-1 ring-[var(--line)]" href="/admin/suppliers">Clear</Link>
      </form>

      <p aria-live="polite" className="mt-4 text-sm text-[var(--muted)]">
        {total} {total === 1 ? "profile" : "profiles"}{filters.category ? ` in ${supplierCategoryBySlug(filters.category)?.plural}` : ""}{filters.status ? ` · ${filters.status}` : ""}
      </p>

      <section className="mt-4 overflow-hidden rounded-3xl border border-[var(--line)] bg-white">
        <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-[var(--line)] px-5 py-4 text-sm font-semibold text-[#5a5248] lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.7fr_auto]">
          <span>Business</span><span className="hidden lg:block">Location</span><span className="hidden lg:block">Pricing</span><span className="hidden lg:block">Status</span><span>Action</span>
        </div>
        {suppliers.map((supplier) => (
          <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-[var(--line)] px-5 py-4 last:border-b-0 lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.7fr_auto]" key={supplier.id}>
            <div>
              <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{supplier.name}</p>{supplier.is_featured ? <span className="rounded-full bg-[#fff5dc] px-2 py-0.5 text-[10px] font-semibold text-[#7d5e24]">Featured</span> : null}</div>
              <p className="mt-1 text-xs text-[var(--muted)]">{supplierCategoryBySlug(supplier.category_slug)?.label ?? supplier.category_slug} · {supplier.is_claimed ? "claimed" : "unclaimed"} · <span className="capitalize">{supplier.listing_status}</span></p>
              <p className="mt-1 text-xs text-[var(--muted)] lg:hidden">{supplier.base_town}, {supplier.region}</p>
            </div>
            <p className="hidden text-sm text-[var(--muted)] lg:block">{supplier.base_town}, {supplier.region}</p>
            <p className="hidden text-sm text-[var(--muted)] lg:block">{supplier.starting_price_pence == null ? "Not confirmed" : `From ${gbp.format(supplier.starting_price_pence / 100)}`}</p>
            <span className={`hidden w-fit rounded-full px-3 py-1 text-xs font-semibold lg:inline-flex ${supplier.listing_status === "published" ? "bg-[#e8f2e5] text-[#345033]" : "bg-[#f2ede4] text-[#665b4c]"}`}>{supplier.listing_status}</span>
            <Link aria-label={`Edit ${supplier.name}`} className="focus-ring grid size-10 place-items-center rounded-full bg-[#f4efe7] text-[#3f4d38] transition hover:bg-[#e8dece]" href={`/admin/suppliers/${supplier.id}/edit`}><Edit size={16} /></Link>
          </div>
        ))}
        {!suppliers.length && !result.error ? <div className="p-10 text-center"><UsersRound className="mx-auto text-[#9d7b45]" size={26} /><h2 className="mt-4 font-display text-3xl font-semibold">No matching supplier profiles</h2><p className="mt-2 text-sm text-[var(--muted)]">Clear a filter, import a reviewed batch or add a supplier profile.</p></div> : null}
      </section>

      <nav aria-label="Supplier profile pages" className="mt-5 flex items-center justify-between gap-3">
        <PageLink disabled={filters.page <= 1} href={buildSupplierAdminDirectoryHref(filters, filters.page - 1)}>Previous</PageLink>
        <p className="text-center text-sm text-[var(--muted)]">Page {filters.page} of {pageCount}</p>
        <PageLink disabled={filters.page >= pageCount} href={buildSupplierAdminDirectoryHref(filters, filters.page + 1)}>Next</PageLink>
      </nav>
    </div>
  );
}

function PageLink({ children, disabled, href }: { children: React.ReactNode; disabled: boolean; href: string }) {
  return disabled
    ? <span aria-disabled="true" className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-[#9a958d]">{children}</span>
    : <Link className="focus-ring inline-flex min-h-11 items-center rounded-full bg-white px-4 text-sm font-semibold text-[#35533e] ring-1 ring-[var(--line)]" href={href}>{children}</Link>;
}
