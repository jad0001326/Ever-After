import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { PublicSupplierCard } from "@/components/supplier/public-supplier-card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { searchPlanningHubSuppliers } from "@/lib/planning-hub/suppliers";
import type { PlanningHubSupplierSearchParams } from "@/lib/planning-hub/types";
import { buildMetadata } from "@/lib/seo";
import {
  getPublicSupplierCategory,
  publicSupplierCategoryPath,
} from "@/lib/supplier-public-routes";

type SupplierCategoryPageProps = {
  params: Promise<{ category: string }>;
  searchParams: Promise<PlanningHubSupplierSearchParams>;
};

export async function generateMetadata({ params }: SupplierCategoryPageProps): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = getPublicSupplierCategory(categorySlug);
  if (!category) return { title: "Supplier category not found", robots: { index: false, follow: false } };
  if (category.slug === "photographer") return { title: "Wedding Photographers" };
  return buildMetadata({
    title: `Scottish Wedding ${category.plural}`,
    description: `Discover Scottish wedding ${category.plural.toLowerCase()} and connect each supplier decision to your EverAft wedding plan.`,
    path: publicSupplierCategoryPath(category.slug),
    keywords: [`Scottish wedding ${category.plural.toLowerCase()}`, `wedding ${category.plural.toLowerCase()} Scotland`],
  });
}

export default async function SupplierCategoryPage({ params, searchParams }: SupplierCategoryPageProps) {
  const [{ category: categorySlug }, query] = await Promise.all([params, searchParams]);
  const category = getPublicSupplierCategory(categorySlug);
  if (!category) notFound();
  if (category.slug === "photographer") permanentRedirect("/photographers");
  const results = await searchPlanningHubSuppliers(category.slug, query);
  const categoryPath = publicSupplierCategoryPath(category.slug);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#95502b]">Scottish wedding suppliers</p>
        <h1 className="mt-3 font-display text-5xl font-semibold tracking-[-0.04em] sm:text-6xl">Find {category.plural.toLowerCase()} for your plan</h1>
        <p className="mt-5 text-lg leading-8 text-[var(--muted)]">Compare useful details without loading the whole catalogue, then carry your decision into the EverAft budget and planning workspace.</p>
      </div>

      <form action={categoryPath} className="mt-9 grid gap-4 rounded-3xl border border-[var(--line)] bg-[#f7f3eb] p-5 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_0.8fr_0.8fr_auto]" method="get">
        <Field label="Business name"><Input defaultValue={query.search} name="search" placeholder={`Search ${category.plural.toLowerCase()}`} /></Field>
        <Field label="Location"><Input defaultValue={query.location} name="location" placeholder="Town or region" /></Field>
        <Field label="Budget up to"><Input defaultValue={query.budget} min="1" name="budget" placeholder="£" type="number" /></Field>
        <Field label="Sort by"><Select defaultValue={query.sort ?? "price-asc"} name="sort"><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Name</option><option value="newest">Newest</option></Select></Field>
        <Button className="self-end" type="submit">Search</Button>
      </form>

      {results.error ? <div className="mt-8 rounded-2xl border border-[#e6cbbd] bg-[#fff7f2] p-5 text-sm text-[#7c3f29]">{results.error}</div> : null}
      {!results.error && results.suppliers.length === 0 ? <div className="mt-8 rounded-3xl border border-[var(--line)] bg-white p-8"><h2 className="font-display text-3xl font-semibold">No suitable profiles found</h2><p className="mt-3 text-sm leading-6 text-[var(--muted)]">Try a broader search or add your chosen supplier manually in the Planning Hub.</p><ButtonLink className="mt-5" href={`/planning-hub/suppliers/${category.slug}`} variant="secondary">Plan this supplier manually</ButtonLink></div> : null}
      {results.suppliers.length ? <><p className="mt-8 text-sm text-[var(--muted)]">{results.total} {results.total === 1 ? category.label.toLowerCase() : category.plural.toLowerCase()}</p><div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{results.suppliers.map((supplier) => <PublicSupplierCard categoryLabel={category.label} key={supplier.id} supplier={supplier} />)}</div></> : null}

      {results.totalPages > 1 ? <nav aria-label={`${category.plural} pages`} className="mt-10 flex items-center justify-between gap-4">
        {results.page > 1 ? <ButtonLink href={pageHref(categoryPath, query, results.page - 1)} variant="secondary">Previous</ButtonLink> : <span />}
        <span className="text-sm text-[var(--muted)]">Page {results.page} of {results.totalPages}</span>
        {results.page < results.totalPages ? <ButtonLink href={pageHref(categoryPath, query, results.page + 1)} variant="secondary">Next</ButtonLink> : <span />}
      </nav> : null}

      <div className="mt-12 border-t border-[var(--line)] pt-7 text-sm text-[var(--muted)]">Own a {category.label.toLowerCase()} business? <Link className="font-semibold text-[var(--brand)] underline underline-offset-4" href={`/for-business?category=${encodeURIComponent(category.label)}`}>Apply to join EverAft</Link>.</div>
    </main>
  );
}

function pageHref(path: string, query: PlanningHubSupplierSearchParams, page: number) {
  const params = new URLSearchParams();
  for (const key of ["search", "location", "budget", "sort"] as const) {
    if (query[key]) params.set(key, query[key]);
  }
  params.set("page", String(page));
  return `${path}?${params.toString()}`;
}
