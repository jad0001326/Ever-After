"use client";

import { CalendarClock, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { formatMoney, getPaymentDeadlines } from "@/lib/budget/calculations";
import type { BudgetItem, BudgetPlan, PaymentInstallment, PaymentInstallmentKind } from "@/lib/budget/types";

export function PlanningHubPaymentSchedule({
  currency,
  item,
  onSave,
}: {
  currency: string;
  item: BudgetItem;
  onSave: (installments: PaymentInstallment[]) => void;
}) {
  const [installments, setInstallments] = useState<PaymentInstallment[]>(
    () => initialInstallments(item),
  );
  const scheduledPence = installments.reduce(
    (total, installment) => total + (installment.amountPence ?? 0),
    0,
  );
  const paidPence = installments.reduce(
    (total, installment) => total + installment.paidPence,
    0,
  );

  function addInstallment() {
    setInstallments((current) => [...current, {
      id: crypto.randomUUID(),
      kind: current.length === 0 ? "deposit" : "installment",
      label: current.length === 0 ? "Deposit" : `Payment ${current.length + 1}`,
      amountPence: null,
      paidPence: 0,
      dueDate: null,
      paidAt: null,
    }]);
  }

  function updateInstallment(id: string, updates: Partial<PaymentInstallment>) {
    setInstallments((current) => current.map((installment) => (
      installment.id === id ? { ...installment, ...updates } : installment
    )));
  }

  return (
    <div className="grid gap-4 px-5 pb-5">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Metric label="Scheduled" value={formatMoney(scheduledPence, currency)} />
        <Metric label="Paid" value={formatMoney(paidPence, currency)} />
      </div>

      {installments.length > 0 ? (
        <ol className="grid gap-3" aria-label="Payment schedule">
          {installments.map((installment, index) => (
            <li className="rounded-2xl border border-[#ddd3c5] bg-[#fbf8f2] p-3" key={installment.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7a6d59]">
                  Payment {index + 1}
                </p>
                <button
                  aria-label={`Remove ${installment.label}`}
                  className="focus-ring grid size-10 place-items-center rounded-full text-[#8b452d]"
                  onClick={() => setInstallments((current) => current.filter((candidate) => candidate.id !== installment.id))}
                  type="button"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <Field label="Type">
                  <select
                    className="focus-ring min-h-11 rounded-xl border border-[#cfc3b3] bg-white px-3 text-sm"
                    onChange={(event) => updateInstallment(installment.id, { kind: event.target.value as PaymentInstallmentKind })}
                    value={installment.kind}
                  >
                    <option value="deposit">Deposit</option>
                    <option value="installment">Instalment</option>
                    <option value="final">Final balance</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="Label">
                  <input
                    className="focus-ring min-h-11 rounded-xl border border-[#cfc3b3] px-3 text-sm"
                    maxLength={120}
                    onChange={(event) => updateInstallment(installment.id, { label: event.target.value })}
                    value={installment.label}
                  />
                </Field>
                <MoneyField
                  label="Amount"
                  onChange={(amountPence) => updateInstallment(installment.id, { amountPence })}
                  value={installment.amountPence}
                />
                <MoneyField
                  label="Paid so far"
                  onChange={(paidAmount) => updateInstallment(installment.id, {
                    paidPence: paidAmount ?? 0,
                    paidAt: paidAmount && installment.amountPence !== null && paidAmount >= installment.amountPence
                      ? installment.paidAt
                      : null,
                  })}
                  value={installment.paidPence}
                />
                <Field label="Due date">
                  <input
                    className="focus-ring min-h-11 rounded-xl border border-[#cfc3b3] px-3 text-sm"
                    onChange={(event) => updateInstallment(installment.id, { dueDate: event.target.value || null })}
                    type="date"
                    value={installment.dueDate ?? ""}
                  />
                </Field>
                <Field label="Paid date">
                  <input
                    className="focus-ring min-h-11 rounded-xl border border-[#cfc3b3] px-3 text-sm"
                    onChange={(event) => updateInstallment(installment.id, { paidAt: event.target.value || null })}
                    type="date"
                    value={installment.paidAt ?? ""}
                  />
                </Field>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-2xl bg-[#fbf8f2] px-4 py-5 text-sm leading-6 text-[#625f57]">
          Add the deposit, staged instalments and final balance from the supplier’s payment terms.
        </p>
      )}

      <button
        className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#a99b88] px-4 text-sm font-semibold text-[#173526]"
        onClick={addInstallment}
        type="button"
      >
        <Plus size={16} /> Add payment
      </button>
      <button
        className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173526] px-4 text-sm font-semibold text-white"
        onClick={() => onSave(installments)}
        type="button"
      >
        <CheckCircle2 size={16} /> Save payment schedule
      </button>
    </div>
  );
}

export function PlanningHubDeadlineSummary({
  plan,
  today,
}: {
  plan: BudgetPlan;
  today: string;
}) {
  const deadlines = getPaymentDeadlines(plan, new Date(`${today}T12:00:00`)).slice(0, 3);
  if (deadlines.length === 0) return null;
  return (
    <section aria-labelledby="payment-deadlines-title" className="border-b border-[#e4ddd2] p-5">
      <div className="flex items-center gap-2 text-[#173526]">
        <CalendarClock size={17} />
        <h3 className="text-sm font-semibold" id="payment-deadlines-title">Next payment deadlines</h3>
      </div>
      <ul className="mt-3 grid gap-2">
        {deadlines.map((deadline) => (
          <li className="rounded-xl bg-[#f8f4ed] px-3 py-2 text-xs" key={`${deadline.itemId}-${deadline.installmentId}-${deadline.dueDate}`}>
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate font-semibold text-[#403b35]">{deadline.itemName}</span>
                <span className="mt-0.5 block text-[#625f57]">{deadline.label} · {formatDate(deadline.dueDate)}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2 py-1 font-semibold ${
                deadline.urgency === "overdue"
                  ? "bg-[#f8dfd7] text-[#8f3427]"
                  : deadline.urgency === "due_soon"
                    ? "bg-[#fff0d4] text-[#80521e]"
                    : "bg-[#e8efe8] text-[#31533b]"
              }`}>
                {deadline.urgency === "overdue"
                  ? "Overdue"
                  : deadline.outstandingPence === null
                    ? "Amount TBC"
                    : formatMoney(deadline.outstandingPence, plan.currency)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function initialInstallments(item: BudgetItem): PaymentInstallment[] {
  if (item.installments.length > 0) return item.installments;
  const installments: PaymentInstallment[] = [];
  if (item.depositPaidPence > 0) {
    installments.push({
      id: legacyInstallmentId(item.id, "deposit"),
      kind: "deposit",
      label: "Deposit",
      amountPence: item.depositPaidPence,
      paidPence: item.depositPaidPence,
      dueDate: null,
      paidAt: null,
    });
  }
  const otherPaid = Math.max(item.totalPaidPence - item.depositPaidPence, 0);
  if (otherPaid > 0) {
    installments.push({
      id: legacyInstallmentId(item.id, "paid"),
      kind: "other",
      label: "Payment already recorded",
      amountPence: otherPaid,
      paidPence: otherPaid,
      dueDate: null,
      paidAt: null,
    });
  }
  if (item.dueDate) {
    installments.push({
      id: legacyInstallmentId(item.id, "due"),
      kind: "installment",
      label: "Next payment",
      amountPence: null,
      paidPence: 0,
      dueDate: item.dueDate,
      paidAt: null,
    });
  }
  return installments;
}

function legacyInstallmentId(itemId: string, suffix: "deposit" | "paid" | "due") {
  return `legacy-${suffix}-${itemId.slice(0, 80)}`;
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return <label className="grid gap-1.5 text-xs font-semibold text-[#514b43]">{label}{children}</label>;
}

function MoneyField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (pence: number | null) => void;
  value: number | null;
}) {
  return (
    <Field label={label}>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#625f57]">£</span>
        <input
          aria-label={label}
          className="focus-ring min-h-11 w-full rounded-xl border border-[#cfc3b3] pl-7 pr-3 text-sm"
          inputMode="decimal"
          min={0}
          onChange={(event) => onChange(moneyToPence(event.target.value))}
          step="0.01"
          type="number"
          value={value === null ? "" : value / 100}
        />
      </span>
    </Field>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#eef3ed] p-3"><p className="text-[#625f57]">{label}</p><p className="mt-1 font-semibold text-[#173526]">{value}</p></div>;
}

function moneyToPence(value: string) {
  if (!value) return null;
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(`${value}T12:00:00`));
}
