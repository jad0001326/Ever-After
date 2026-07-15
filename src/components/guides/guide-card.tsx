import Link from "next/link";
import { ArrowUpRight, Clock3 } from "lucide-react";
import type { PlanningGuide } from "@/lib/planning-guides";
import { cn } from "@/lib/utils";

export function GuideCard({ guide, prominent = false }: { guide: PlanningGuide; prominent?: boolean }) {
  return (
    <Link
      className={cn(
        "focus-ring group flex h-full flex-col border border-[var(--line)] bg-white transition hover:-translate-y-0.5 hover:border-[#b9aa96] hover:shadow-[0_22px_60px_rgba(25,23,19,0.08)]",
        prominent ? "rounded-[2rem] p-7 sm:p-9" : "rounded-[1.5rem] p-6"
      )}
      href={`/guides/${guide.slug}`}
    >
      <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#95502b]">
        <span>{guide.category}</span>
        <span className="inline-flex items-center gap-1.5 normal-case tracking-normal text-[var(--muted)]">
          <Clock3 aria-hidden="true" size={14} /> {guide.readMinutes} min
        </span>
      </div>
      <h2
        className={cn(
          "mt-8 font-display font-semibold leading-[0.98] tracking-[-0.035em] text-[var(--ink)]",
          prominent ? "text-4xl sm:text-5xl" : "text-3xl"
        )}
      >
        {guide.title}
      </h2>
      <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{guide.description}</p>
      <span className="mt-auto inline-flex items-center gap-2 pt-8 text-sm font-semibold text-[#35513c]">
        Read guide <ArrowUpRight aria-hidden="true" className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" size={16} />
      </span>
    </Link>
  );
}
