import Link from "next/link";
import { MapPin } from "lucide-react";
import { SupplierVisual } from "@/components/supplier/supplier-visual";
import { publicSupplierProfilePath } from "@/lib/supplier-public-routes";
import { gbp } from "@/lib/utils";
import type { PlanningHubSupplier } from "@/lib/planning-hub/types";

export function PublicSupplierCard({
  supplier,
  categoryLabel,
}: {
  supplier: PlanningHubSupplier;
  categoryLabel: string;
}) {
  const href = publicSupplierProfilePath(supplier.categorySlug, supplier.slug);
  return (
    <article className="group overflow-hidden rounded-3xl border border-[var(--line)] bg-white transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/10">
      <Link className="relative block aspect-[4/3] overflow-hidden" href={href}>
        <SupplierVisual categoryLabel={categoryLabel} imageUrl={supplier.hasApprovedPhoto ? supplier.heroImageUrl : null} name={supplier.name} />
        <span className="absolute left-4 top-4 rounded-full bg-white/92 px-3 py-1 text-xs font-semibold text-[#3d372f] backdrop-blur">{categoryLabel}</span>
        {supplier.visualStatus === "representative" ? <span className="absolute right-4 top-4 rounded-full bg-white/92 px-3 py-1 text-[10px] font-semibold text-[#554a3d] backdrop-blur">Representative image</span> : null}
        {supplier.isClaimed ? <span className="absolute bottom-4 left-4 rounded-full border border-white/50 bg-white/88 px-3 py-1 text-[11px] font-semibold text-[#3f5c35] backdrop-blur">Managed by business</span> : null}
      </Link>
      <div className="p-5">
        <h2 className="font-display text-2xl font-semibold"><Link className="focus-ring rounded-lg hover:text-[var(--brand)]" href={href}>{supplier.name}</Link></h2>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{supplier.summary}</p>
        <p className="mt-4 flex items-center gap-2 text-sm text-[#4f4a43]"><MapPin className="text-[#9d7b45]" size={16} />{supplier.baseTown}, {supplier.region}</p>
        <div className="mt-5 flex items-end justify-between gap-3 border-t border-[var(--line)] pt-4">
          <span>{supplier.startingPricePence != null ? <><span className="block text-[10px] uppercase tracking-[0.18em] text-[#8a806f]">Packages from</span><span className="text-lg font-semibold">{gbp.format(supplier.startingPricePence / 100)}</span></> : <span className="text-xs text-[var(--muted)]">Contact for current pricing</span>}</span>
          <Link className="focus-ring inline-flex min-h-10 items-center rounded-full bg-[#f4efe7] px-4 text-xs font-semibold text-[var(--brand)] transition hover:bg-[#e9dece]" href={href}>View profile</Link>
        </div>
      </div>
    </article>
  );
}
