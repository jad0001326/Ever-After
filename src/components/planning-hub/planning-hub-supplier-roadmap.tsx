"use client";

import { ArrowRight, BookOpenCheck, Camera, Store } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/budget/calculations";
import {
  planningHubBudgetStorageKey,
  restoreBudgetPlan,
} from "@/lib/budget/persistence";
import type { BudgetPlan } from "@/lib/budget/types";
import { calculatePlanningHubPlan } from "@/lib/planning-hub/plan";
import { getPlanningHubSupplierRoadmap } from "@/lib/planning-hub/supplier-roadmap";

export function PlanningHubSupplierRoadmap({
  connectedWorkspaceId,
  initialPlan,
  initialPlanIsFallback = false,
}: {
  connectedWorkspaceId: string | null;
  initialPlan: BudgetPlan;
  initialPlanIsFallback?: boolean;
}) {
  const [plan, setPlan] = useState(initialPlan);
  const entries = getPlanningHubSupplierRoadmap(plan, connectedWorkspaceId);
  const budget = calculatePlanningHubPlan(plan);
  const plannedCategoryCount = entries.filter((entry) => entry.itemCount > 0).length;

  useEffect(() => {
    const storageKey = planningHubBudgetStorageKey(connectedWorkspaceId);
    const restoreTimer = window.setTimeout(() => {
      try {
        const localPlan = restoreBudgetPlan(window.localStorage.getItem(storageKey));
        if (localPlan && (initialPlanIsFallback || new Date(localPlan.updatedAt).getTime() > new Date(initialPlan.updatedAt).getTime())) {
          setPlan({ ...localPlan, userId: initialPlan.userId });
        }
      } catch {
        // The server starter remains usable when browser storage is unavailable.
      }
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [connectedWorkspaceId, initialPlan, initialPlanIsFallback]);

  return (
    <div className="space-y-6">
      <section aria-labelledby="supplier-roadmap-title" className="rounded-3xl border border-[#d8c7a7] bg-[#fff9ef] p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#95502b]">Connected supplier plan</p>
        <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
          <div>
            <h2 className="font-display text-3xl font-semibold text-[#173526] sm:text-4xl" id="supplier-roadmap-title">Choose the supplier stage that matters next</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#625f57]">
              Browse photography now. For categories whose EverAft catalogue is not ready, add the business you found elsewhere and still track its estimate, quote, booking and payments in this plan.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Summary label="Remaining" value={formatMoney(budget.remainingPence)} />
            <Summary label="Stages started" value={String(plannedCategoryCount)} />
          </dl>
        </div>
      </section>

      <section aria-label="Supplier planning stages" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map((entry) => (
          <article className="flex min-w-0 flex-col rounded-3xl border border-[var(--line)] bg-white p-5" key={entry.slug}>
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#edf2ec] text-[#31533b]">
                {entry.slug === "photographer" ? <Camera size={18} /> : entry.itemCount > 0 ? <BookOpenCheck size={18} /> : <Store size={18} />}
              </span>
              <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${entry.catalogueLive ? "bg-[#e7f1e8] text-[#31533b]" : "bg-[#f5eee3] text-[#765737]"}`}>
                {entry.catalogueLive ? "Catalogue live" : "Manual planning"}
              </span>
            </div>
            <h3 className="mt-4 font-display text-2xl font-semibold text-[#173526]">{entry.plural}</h3>
            {entry.latestItem ? (
              <div className="mt-3 rounded-2xl bg-[#f8f4ed] p-3 text-sm leading-6 text-[#625f57]">
                <p className="truncate font-semibold text-[#403b35]">{entry.latestItem.itemName}</p>
                <p className="capitalize">{entry.latestItem.bookingStatus.replaceAll("_", " ")}{entry.planningCostPence !== null ? ` · ${formatMoney(entry.planningCostPence)}` : " · Price needed"}</p>
                {entry.itemCount > 1 ? <p className="text-xs">{entry.itemCount} options saved</p> : null}
              </div>
            ) : (
              <p className="mt-3 flex-1 text-sm leading-6 text-[#625f57]">
                {entry.catalogueLive
                  ? `Find and compare Scottish ${entry.plural.toLowerCase()} matched to your plan.`
                  : `Record a ${entry.label.toLowerCase()} you found elsewhere without presenting an unfinished EverAft catalogue.`}
              </p>
            )}
            <Link className="focus-ring mt-5 inline-flex min-h-11 items-center justify-between gap-3 rounded-xl border border-[#173526] px-4 text-sm font-semibold text-[#173526]" href={entry.href} prefetch={false}>
              {entry.latestItem ? "Continue planning" : entry.catalogueLive ? "Browse & compare" : "Add manually"}
              <ArrowRight size={17} />
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-3">
      <dt className="text-xs text-[#625f57]">{label}</dt>
      <dd className="mt-1 font-semibold text-[#173526]">{value}</dd>
    </div>
  );
}
