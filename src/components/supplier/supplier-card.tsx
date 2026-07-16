import Link from "next/link";
import { Calculator, MapPin } from "lucide-react";
import { SupplierVisual } from "@/components/supplier/supplier-visual";
import { gbp } from "@/lib/utils";
import type { SupplierListing } from "@/types/supplier";

export function SupplierCard({ supplier, priority = false }: { supplier: SupplierListing; priority?: boolean }) {
  const styles = supplier.photographer?.styles ?? [];

  return (
    <article className="group h-full overflow-hidden rounded-3xl border border-[var(--line)] bg-white transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/10">
      <div className="grid h-full grid-rows-[auto_1fr]">
        <Link className="relative block aspect-[4/3] overflow-hidden" href={`/photographers/${supplier.slug}`}>
          <SupplierVisual imageUrl={supplier.heroImageUrl} name={supplier.name} priority={priority} />
          <div className="absolute left-4 top-4 rounded-full bg-white/92 px-3 py-1 text-xs font-semibold text-[#3d372f] backdrop-blur">Photographer</div>
          {supplier.isClaimed ? <div className="absolute bottom-4 left-4 rounded-full border border-white/50 bg-white/88 px-3 py-1 text-[11px] font-semibold text-[#3f5c35] backdrop-blur">Managed by business</div> : null}
        </Link>
        <div className="flex h-full flex-col gap-4 p-5">
          <div>
            <h2 className="font-display text-2xl font-semibold"><Link className="focus-ring rounded-lg hover:text-[var(--brand)]" href={`/photographers/${supplier.slug}`}>{supplier.name}</Link></h2>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{supplier.summary}</p>
          </div>
          <p className="flex items-center gap-2 text-sm text-[#4f4a43]"><MapPin className="text-[#9d7b45]" size={16} />{supplier.baseTown}, {supplier.region}</p>
          {styles.length ? <div className="flex flex-wrap gap-2">{styles.slice(0, 3).map((style) => <span className="rounded-full bg-[#f4efe7] px-2.5 py-1 text-[11px] font-medium text-[#665a4b]" key={style}>{style}</span>)}</div> : null}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
            <span>{supplier.startingPricePence != null ? <><span className="block text-[10px] uppercase tracking-[0.18em] text-[#8a806f]">Packages from</span><span className="text-lg font-semibold">{gbp.format(supplier.startingPricePence / 100)}</span></> : <span className="text-xs text-[var(--muted)]">Pricing being confirmed</span>}</span>
            <Link className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-full bg-[#f4efe7] px-3 text-xs font-semibold text-[var(--brand)] transition hover:bg-[#e9dece]" href={`/wedding-budget-planner?supplier=${encodeURIComponent(supplier.id)}`}><Calculator size={15} /> Add to budget</Link>
          </div>
        </div>
      </div>
    </article>
  );
}

