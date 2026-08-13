import Link from "next/link";
import { CheckCircle2, FileCheck2, ImagePlus, ShieldCheck } from "lucide-react";
import { SupplierClaimForm } from "@/components/supplier/supplier-claim-form";
import { publicSupplierProfilePath } from "@/lib/supplier-public-routes";
import type { SupplierCategorySlug } from "@/types/supplier";

export function PublicSupplierClaimPage({
  supplier,
  categorySlug,
  categoryLabel,
}: {
  supplier: {
    id: string;
    slug: string;
    name: string;
    base_town: string;
    region: string;
  };
  categorySlug: SupplierCategorySlug;
  categoryLabel: string;
}) {
  const steps = [
    [ShieldCheck, "Use your business email and explain your role."],
    [FileCheck2, `Include evidence linking you to the ${categoryLabel.toLowerCase()} business.`],
    [ImagePlus, "Portfolio content remains private unless you approve its use."],
    [CheckCircle2, "EverAft reviews every claim before granting access."],
  ] as const;
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Link className="text-sm font-semibold text-[#5c6b52]" href={publicSupplierProfilePath(categorySlug, supplier.slug)}>Back to profile</Link>
      <div className="mt-6 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="self-start rounded-3xl border border-[var(--line)] bg-white p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#9d7b45]">Claim this profile</p>
          <h1 className="mt-3 font-display text-5xl font-semibold">{supplier.name}</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">{supplier.base_town}, {supplier.region}</p>
          <p className="mt-4 leading-7 text-[var(--muted)]">Verify your connection to this business so you can review its details and decide what may be published.</p>
          <div className="mt-6 grid gap-4 text-sm leading-6 text-[#4f4a43]">{steps.map(([Icon, text]) => <div className="flex gap-3" key={text}><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[#f4efe7] text-[#8b6d3c]"><Icon size={16} /></span><p>{text}</p></div>)}</div>
        </section>
        <SupplierClaimForm categoryLabel={categoryLabel} categorySlug={categorySlug} supplierId={supplier.id} supplierSlug={supplier.slug} />
      </div>
    </main>
  );
}
