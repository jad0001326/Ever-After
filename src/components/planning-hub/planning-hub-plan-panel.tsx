"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ArrowRight, Check, Cloud, CreditCard, MapPinned, Plus, Save } from "lucide-react";
import { formatMoney } from "@/lib/budget/calculations";
import type { AvailabilityStatus, BudgetItem, BudgetPlan } from "@/lib/budget/types";
import type { PaymentInstallment } from "@/lib/budget/types";
import type { PlanningHubVenueStatus } from "@/lib/planning-hub/plan";
import { calculatePlanningHubPlan, getPhotographyNextHref } from "@/lib/planning-hub/plan";
import type { PlanningHubVenue } from "@/lib/planning-hub/types";
import { PlanningHubAvailability } from "./planning-hub-availability";
import { PlanningHubDeadlineSummary, PlanningHubPaymentSchedule } from "./planning-hub-payment-schedule";

export type PlanningHubSaveState = "idle" | "saving" | "saved" | "error";

export function PlanningHubPlanPanel({
  connectedWorkspaceId = null,
  plan,
  selectedItem,
  selectedVenue,
  planningCostPence,
  saveMessage,
  saveState,
  status,
  onChooseVenue,
  onAvailabilityChange,
  onManualVenue,
  onInstallmentsSave,
  onPlanChange,
  onPlanSave,
  onPlanningCostChange,
  onStatusChange,
  onVenueSave,
  today,
}: {
  connectedWorkspaceId?: string | null;
  plan: BudgetPlan;
  selectedItem: BudgetItem | null;
  selectedVenue: PlanningHubVenue | null;
  planningCostPence: number;
  saveMessage: string;
  saveState: PlanningHubSaveState;
  status: PlanningHubVenueStatus;
  onChooseVenue: () => void;
  onAvailabilityChange: (status: AvailabilityStatus) => void;
  onManualVenue: (name: string, costPence: number, status: PlanningHubVenueStatus) => void;
  onInstallmentsSave: (installments: PaymentInstallment[]) => void;
  onPlanChange: (updates: Partial<BudgetPlan>) => void;
  onPlanSave: () => void;
  onPlanningCostChange: (pence: number) => void;
  onStatusChange: (status: PlanningHubVenueStatus) => void;
  onVenueSave: () => void;
  today: string;
}) {
  const [manualVenueOpen, setManualVenueOpen] = useState(false);
  const budget = calculatePlanningHubPlan(plan);
  const venueItems = plan.items.filter((item) => item.categoryId === "venue" && item.bookingStatus !== "cancelled");

  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash === "#manual-venue") setManualVenueOpen(true);
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  return (
    <aside aria-label="Connected wedding plan" className="self-start rounded-3xl border border-[#cfc3b3] bg-white lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
      <div className="border-b border-[#e4ddd2] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9c542d]">Your connected plan</p>
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
      </div>
      <PlanningHubDeadlineSummary plan={plan} today={today} />

      <details className="border-b border-[#e4ddd2]" open>
        <summary className="focus-ring flex min-h-14 cursor-pointer list-none items-center justify-between px-5 font-semibold text-[#173526]">
          Wedding basics <span className="text-xl text-[#9c542d]">+</span>
        </summary>
        <div className="grid gap-3 px-5 pb-5">
          <Label text="Total wedding budget">
            <MoneyInput onChange={(value) => onPlanChange({ totalBudgetPence: value })} value={plan.totalBudgetPence} />
          </Label>
          <Label text="Wedding date">
            <input className="focus-ring min-h-11 w-full rounded-xl border border-[#cfc3b3] px-3 text-sm" onChange={(event) => onPlanChange({ weddingDate: event.target.value || null })} type="date" value={plan.weddingDate ?? ""} />
          </Label>
          <Label text="Guest count">
            <input className="focus-ring min-h-11 w-full rounded-xl border border-[#cfc3b3] px-3 text-sm" min={1} onChange={(event) => onPlanChange({ guestCount: event.target.value ? Math.max(Number.parseInt(event.target.value, 10), 1) : null })} type="number" value={plan.guestCount ?? ""} />
          </Label>
          <Label text="Preferred location">
            <input className="focus-ring min-h-11 w-full rounded-xl border border-[#cfc3b3] px-3 text-sm" maxLength={160} onChange={(event) => onPlanChange({ location: event.target.value || null })} placeholder="Perthshire" value={plan.location ?? ""} />
          </Label>
        </div>
      </details>

      <div className="border-b border-[#e4ddd2] p-5" data-testid="current-venue-planning" id="current-venue-planning">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7a6d59]">Current venue</p>
        <h3 className="mt-2 font-display text-2xl font-semibold text-[#173526]">{selectedVenue?.name ?? selectedItem?.itemName ?? "Open a venue to plan it"}</h3>
        {selectedVenue ? (
          <div className="mt-4 grid gap-3">
            <Label text="Planning stage">
              <select className="focus-ring min-h-11 w-full rounded-xl border border-[#cfc3b3] bg-white px-3 text-sm" onChange={(event) => onStatusChange(event.target.value as PlanningHubVenueStatus)} value={status}>
                <option value="researching">Researching</option>
                <option value="shortlisted">Shortlisted</option>
                <option value="quoted">Quote received</option>
                <option value="booked">Booked</option>
              </select>
            </Label>
            <Label text="Planning cost">
              <MoneyInput onChange={onPlanningCostChange} value={planningCostPence} />
            </Label>
            <button className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#173526] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={saveState === "saving"} onClick={onVenueSave} type="button">
              {saveState === "saving" ? <Cloud className="animate-pulse" size={17} /> : selectedItem ? <Check size={17} /> : <Plus size={17} />}
              {selectedItem ? "Update venue plan" : "Add venue to plan"}
            </button>
            {selectedItem ? (
              <button aria-pressed={plan.selectedVenueId === selectedVenue.id} className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#173526] px-4 text-sm font-semibold text-[#173526]" onClick={onChooseVenue} type="button">
                <MapPinned size={17} /> {plan.selectedVenueId === selectedVenue.id ? "This is your chosen venue" : "Choose as main venue"}
              </button>
            ) : null}
          </div>
        ) : selectedItem ? (
          <div className="mt-4 grid gap-3">
            <p className="text-sm leading-6 text-[#625f57]">
              {selectedItem.source === "manual"
                ? "This manually added venue is ready for payment planning."
                : "This saved venue is ready for payment planning."}
            </p>
            <button
              aria-pressed={plan.selectedVenueId === selectedItem.id}
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#173526] px-4 text-sm font-semibold text-[#173526]"
              onClick={onChooseVenue}
              type="button"
            >
              <MapPinned size={17} /> {plan.selectedVenueId === selectedItem.id ? "This is your chosen venue" : "Choose as main venue"}
            </button>
          </div>
        ) : <p className="mt-3 text-sm leading-6 text-[#625f57]">Use “View” on a result to inspect it here without leaving your workspace.</p>}
        <p className={`mt-3 text-xs leading-5 ${saveState === "error" ? "text-[#9b3025]" : "text-[#625f57]"}`} role="status">{saveMessage}</p>
      </div>

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
            Payments <CreditCard size={18} />
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
        id="manual-venue"
        onToggle={(event) => setManualVenueOpen(event.currentTarget.open)}
        open={manualVenueOpen}
      >
        <summary className="focus-ring flex min-h-14 cursor-pointer list-none items-center justify-between px-5 font-semibold text-[#173526]">
          Venue not listed? <Plus size={18} />
        </summary>
        <form className="grid gap-3 px-5 pb-5" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const name = String(form.get("name") ?? "").trim();
          if (!name) return;
          onManualVenue(name, moneyFromForm(form.get("cost")), String(form.get("status")) as PlanningHubVenueStatus);
          event.currentTarget.reset();
        }}>
          <Label text="Venue name">
            <input className="focus-ring min-h-11 w-full rounded-xl border border-[#cfc3b3] px-3 text-sm" maxLength={160} name="name" required />
          </Label>
          <Label text="Planning cost">
            <input className="focus-ring min-h-11 w-full rounded-xl border border-[#cfc3b3] px-3 text-sm" inputMode="decimal" min={0} name="cost" step="0.01" type="number" />
          </Label>
          <Label text="Planning stage">
            <select className="focus-ring min-h-11 w-full rounded-xl border border-[#cfc3b3] bg-white px-3 text-sm" defaultValue="shortlisted" name="status">
              <option value="researching">Researching</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="quoted">Quote received</option>
              <option value="booked">Booked</option>
            </select>
          </Label>
          <button className="focus-ring min-h-11 rounded-xl bg-[#173526] px-4 text-sm font-semibold text-white" type="submit">Add manual venue</button>
        </form>
      </details>

      {venueItems.length ? (
        <div className="border-b border-[#e4ddd2] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7a6d59]">Venue shortlist</p>
          <ul className="mt-3 grid gap-2">
            {venueItems.map((item) => (
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
        <Link className="focus-ring mt-4 flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-[#e8efe8] px-4 text-sm font-semibold text-[#173526]" href={getPhotographyNextHref(plan, null, connectedWorkspaceId)} prefetch={false}>
          <span>Next: choose your photographer<span className="mt-1 block text-xs font-normal text-[#5b665e]">Matched to your venue and location.</span></span>
          <ArrowRight size={18} />
        </Link>
      </div>
    </aside>
  );
}

function Label({ children, text }: { children: ReactNode; text: string }) {
  return <label className="grid gap-1.5 text-xs font-semibold text-[#514b43]">{text}{children}</label>;
}

function MoneyInput({ value, onChange }: { value: number; onChange: (pence: number) => void }) {
  return (
    <span className="relative block">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#625f57]">£</span>
      <input className="focus-ring min-h-11 w-full rounded-xl border border-[#cfc3b3] pl-7 pr-3 text-sm" inputMode="decimal" min={0} onChange={(event) => onChange(moneyFromForm(event.target.value))} step="0.01" type="number" value={value > 0 ? value / 100 : ""} />
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
