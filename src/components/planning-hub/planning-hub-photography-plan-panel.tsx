"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Cloud, CreditCard, Plus, Save, UsersRound } from "lucide-react";
import { formatMoney } from "@/lib/budget/calculations";
import type { AvailabilityStatus, BudgetItem, BudgetPlan } from "@/lib/budget/types";
import type { PaymentInstallment } from "@/lib/budget/types";
import { calculatePlanningHubPlan, type PlanningHubItemStatus } from "@/lib/planning-hub/plan";
import { withPlanningWorkspace } from "@/lib/planning-hub/navigation";
import type { PlanningHubPhotographer } from "@/lib/planning-hub/types";
import type { PlanningHubSaveState } from "./planning-hub-plan-panel";
import { PlanningHubAvailability } from "./planning-hub-availability";
import { PlanningHubDeadlineSummary, PlanningHubPaymentSchedule } from "./planning-hub-payment-schedule";
import { PlanningHubItemRemoval } from "./planning-hub-item-removal";

export function PlanningHubPhotographyPlanPanel({
  connectedWorkspaceId = null,
  plan,
  selectedItem,
  selectedPhotographer,
  planningCostPence,
  saveMessage,
  saveState,
  status,
  onAvailabilityChange,
  onManualPhotographer,
  onInstallmentsSave,
  onItemRemove,
  onPlanSave,
  onPlanningCostChange,
  onStatusChange,
  onPhotographerSave,
  today,
}: {
  connectedWorkspaceId?: string | null;
  plan: BudgetPlan;
  selectedItem: BudgetItem | null;
  selectedPhotographer: PlanningHubPhotographer | null;
  planningCostPence: number;
  saveMessage: string;
  saveState: PlanningHubSaveState;
  status: PlanningHubItemStatus;
  onAvailabilityChange: (status: AvailabilityStatus) => void;
  onManualPhotographer: (name: string, costPence: number, status: PlanningHubItemStatus) => void;
  onInstallmentsSave: (installments: PaymentInstallment[]) => void;
  onItemRemove: () => void;
  onPlanSave: () => void;
  onPlanningCostChange: (pence: number) => void;
  onStatusChange: (status: PlanningHubItemStatus) => void;
  onPhotographerSave: () => void;
  today: string;
}) {
  const [manualPhotographerOpen, setManualPhotographerOpen] = useState(false);
  const currentHeadingRef = useRef<HTMLHeadingElement>(null);
  const budget = calculatePlanningHubPlan(plan);
  const photographyItems = plan.items.filter((item) => item.categoryId === "photography" && item.bookingStatus !== "cancelled");
  const hasBookedPhotographer = photographyItems.some((item) => item.bookingStatus === "booked");

  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash === "#manual-photographer") setManualPhotographerOpen(true);
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  function removeCurrentItem() {
    onItemRemove();
    requestAnimationFrame(() => currentHeadingRef.current?.focus());
  }

  return (
    <aside aria-label="Connected wedding plan" className="self-start rounded-3xl border border-[#cfc3b3] bg-white lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
      <div className="border-b border-[#e4ddd2] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9c542d]">Same connected plan</p>
        <h2 className="mt-2 font-display text-3xl font-semibold text-[#173526]">Budget at a glance</h2>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <Summary label="Total budget" value={budget.totalBudgetPence} />
          <Summary label="Planned" value={budget.plannedPence} />
          <Summary label="Committed" value={budget.committedPence} />
          <Summary label="Paid" value={budget.paidPence} />
          <div className="col-span-2 rounded-2xl bg-[#e8efe8] p-4">
            <dt className="text-xs font-medium text-[#526259]">Remaining</dt>
            <dd className={`mt-1 font-display text-3xl font-semibold ${budget.remainingPence < 0 ? "text-[#9b3025]" : "text-[#173526]"}`}>{formatMoney(budget.remainingPence)}</dd>
          </div>
        </dl>
        <Link className="focus-ring mt-4 inline-flex min-h-11 items-center gap-2 rounded-full text-sm font-semibold text-[#173526]" href={withPlanningWorkspace("/planning-hub", connectedWorkspaceId)} prefetch={false}>
          <ArrowLeft size={16} /> Review venue and wedding basics
        </Link>
      </div>
      <PlanningHubDeadlineSummary plan={plan} today={today} />

      <div className="border-b border-[#e4ddd2] p-5" data-testid="current-photographer-planning" id="current-photographer-planning">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7a6d59]">Current photographer</p>
        <h3 className="focus-ring mt-2 rounded font-display text-2xl font-semibold text-[#173526]" ref={currentHeadingRef} tabIndex={-1}>{selectedPhotographer?.name ?? selectedItem?.itemName ?? "Open a photographer to plan them"}</h3>
        {selectedPhotographer ? (
          <div className="mt-4 grid gap-3">
            <Label text="Planning stage">
              <select className="focus-ring min-h-11 w-full rounded-xl border border-[#cfc3b3] bg-white px-3 text-sm" onChange={(event) => onStatusChange(event.target.value as PlanningHubItemStatus)} value={status}>
                <option value="researching">Researching</option>
                <option value="shortlisted">Shortlisted</option>
                <option value="quoted">Quote received</option>
                <option value="booked">Booked</option>
              </select>
            </Label>
            <Label text={selectedPhotographer.startingPricePence == null ? "Working estimate or quote" : "Planning cost"}>
              <MoneyInput ariaLabel={selectedPhotographer.startingPricePence == null ? "Working estimate or quote" : "Planning cost"} onChange={onPlanningCostChange} value={planningCostPence} />
            </Label>
            {selectedPhotographer.startingPricePence == null ? <p className="-mt-1 text-xs leading-5 text-[#625f57]">This profile is quote-only. Enter a working estimate now, then replace it when the quote arrives.</p> : null}
            <button className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#173526] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={saveState === "saving"} onClick={onPhotographerSave} type="button">
              {saveState === "saving" ? <Cloud className="animate-pulse" size={17} /> : selectedItem ? <Check size={17} /> : <Plus size={17} />}
              {selectedItem ? "Update photography plan" : "Add photographer to plan"}
            </button>
          </div>
        ) : selectedItem ? (
          <p className="mt-3 text-sm leading-6 text-[#625f57]">
            {selectedItem.source === "manual"
              ? "This manually added photographer is ready for payment planning."
              : "This saved photographer is ready for payment planning."}
          </p>
        ) : <p className="mt-3 text-sm leading-6 text-[#625f57]">Use “View &amp; plan” on a result to keep researching without leaving your workspace.</p>}
        <p className={`mt-3 text-xs leading-5 ${saveState === "error" ? "text-[#9b3025]" : "text-[#625f57]"}`} role="status">{saveMessage}</p>
      </div>

      {selectedItem ? (
        <PlanningHubItemRemoval
          disabled={saveState === "saving"}
          itemKind="photographer"
          itemName={selectedItem.itemName}
          key={selectedItem.id}
          onRemove={removeCurrentItem}
        />
      ) : null}

      {selectedItem ? (
        <PlanningHubAvailability
          item={selectedItem}
          onChange={onAvailabilityChange}
          weddingDate={plan.weddingDate}
        />
      ) : null}

      {selectedItem ? (
        <details className="border-b border-[#e4ddd2]">
          <summary className="focus-ring flex min-h-14 cursor-pointer list-none items-center justify-between px-5 font-semibold text-[#173526]">
            Deposits &amp; payments <CreditCard size={18} />
          </summary>
          <PlanningHubPaymentSchedule
            currency={plan.currency}
            item={selectedItem}
            key={`${selectedItem.id}-${selectedItem.updatedAt}`}
            onSave={onInstallmentsSave}
          />
        </details>
      ) : null}

      <details
        className="border-b border-[#e4ddd2]"
        id="manual-photographer"
        onToggle={(event) => setManualPhotographerOpen(event.currentTarget.open)}
        open={manualPhotographerOpen}
      >
        <summary className="focus-ring flex min-h-14 cursor-pointer list-none items-center justify-between px-5 font-semibold text-[#173526]">
          Photographer not listed? <Plus size={18} />
        </summary>
        <form className="grid gap-3 px-5 pb-5" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const name = String(form.get("name") ?? "").trim();
          if (!name) return;
          onManualPhotographer(name, moneyFromForm(form.get("cost")), String(form.get("status")) as PlanningHubItemStatus);
          event.currentTarget.reset();
        }}>
          <Label text="Photographer name">
            <input className="focus-ring min-h-11 w-full rounded-xl border border-[#cfc3b3] px-3 text-sm" maxLength={160} name="name" required />
          </Label>
          <Label text="Working cost">
            <MoneyField ariaLabel="Working cost" name="cost" />
          </Label>
          <Label text="Planning stage">
            <select className="focus-ring min-h-11 w-full rounded-xl border border-[#cfc3b3] bg-white px-3 text-sm" defaultValue="shortlisted" name="status">
              <option value="researching">Researching</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="quoted">Quote received</option>
              <option value="booked">Booked</option>
            </select>
          </Label>
          <button className="focus-ring min-h-11 rounded-xl bg-[#173526] px-4 text-sm font-semibold text-white" type="submit">Add manual photographer</button>
        </form>
      </details>

      {photographyItems.length ? (
        <div className="border-b border-[#e4ddd2] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7a6d59]">Photography shortlist</p>
          <ul className="mt-3 grid gap-2">
            {photographyItems.map((item) => (
              <li className="flex items-center justify-between gap-3 rounded-xl bg-[#f8f4ed] px-3 py-2 text-xs" key={item.id}>
                <span className="min-w-0 truncate font-semibold text-[#403b35]">{item.itemName}</span>
                <span className="shrink-0 capitalize text-[#625f57]">{item.bookingStatus.replaceAll("_", " ")}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="p-5">
        <button className="focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#173526] px-4 text-sm font-semibold text-[#173526] disabled:opacity-60" disabled={saveState === "saving"} onClick={onPlanSave} type="button">
          <Save size={17} /> Save plan
        </button>
        <Link className="focus-ring mt-4 flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-[#e8efe8] px-4 text-sm font-semibold text-[#173526]" href={withPlanningWorkspace("/planning-hub/suppliers", connectedWorkspaceId)} prefetch={false}>
          <span>{hasBookedPhotographer ? "Next: plan your supplier team" : "Then: plan your supplier team"}<span className="mt-1 block text-xs font-normal text-[#5b665e]">{hasBookedPhotographer ? "Your venue and photography choices now shape what comes next." : "Browse live stages or add a business manually."}</span></span>
          {hasBookedPhotographer ? <ArrowRight size={18} /> : <UsersRound size={18} />}
        </Link>
      </div>
    </aside>
  );
}

function Label({ children, text }: { children: ReactNode; text: string }) {
  return <label className="grid gap-1.5 text-xs font-semibold text-[#514b43]">{text}{children}</label>;
}

function MoneyInput({ ariaLabel, value, onChange }: { ariaLabel: string; value: number; onChange: (pence: number) => void }) {
  return (
    <span className="relative block">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#625f57]">£</span>
      <input aria-label={ariaLabel} className="focus-ring min-h-11 w-full rounded-xl border border-[#cfc3b3] pl-7 pr-3 text-sm" inputMode="decimal" min={0} onChange={(event) => onChange(moneyFromForm(event.target.value))} step="0.01" type="number" value={value > 0 ? value / 100 : ""} />
    </span>
  );
}

function MoneyField({ ariaLabel, defaultValue = 0, name }: { ariaLabel: string; defaultValue?: number; name: string }) {
  return (
    <span className="relative block">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#625f57]">£</span>
      <input aria-label={ariaLabel} className="focus-ring min-h-11 w-full rounded-xl border border-[#cfc3b3] pl-7 pr-3 text-sm" defaultValue={defaultValue > 0 ? defaultValue / 100 : ""} inputMode="decimal" min={0} name={name} step="0.01" type="number" />
    </span>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-[#f8f4ed] p-3"><dt className="text-xs text-[#625f57]">{label}</dt><dd className="mt-1 font-semibold text-[#2f3d32]">{formatMoney(value)}</dd></div>;
}

function moneyFromForm(value: FormDataEntryValue | string | null) {
  const amount = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0;
}
