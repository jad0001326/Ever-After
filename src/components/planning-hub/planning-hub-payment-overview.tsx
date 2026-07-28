import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, WalletCards } from "lucide-react";
import { formatMoney } from "@/lib/budget/calculations";
import type { BudgetPlan } from "@/lib/budget/types";
import {
  getPlanningHubPaymentDeadlineHref,
  getPlanningHubPaymentOverview,
} from "@/lib/planning-hub/payments";

export function PlanningHubPaymentOverview({
  plan,
  today,
  workspaceId,
}: {
  plan: BudgetPlan;
  today: string;
  workspaceId?: string | null;
}) {
  const overview = getPlanningHubPaymentOverview(plan, new Date(`${today}T12:00:00`));
  const visibleDeadlines = overview.deadlines.slice(0, 5);

  return (
    <section aria-labelledby="organise-payments-title" className="rounded-3xl border border-[#d8c7a7] bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#95502b]">Money commitments</p>
          <h2 className="mt-2 flex items-center gap-2 font-display text-3xl font-semibold text-[#173526]" id="organise-payments-title">
            <WalletCards aria-hidden="true" size={24} /> Payments &amp; deadlines
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#625f57]">Keep deposits, instalments and final balances visible alongside the rest of your plan.</p>
        </div>
        {overview.overdueCount > 0 ? (
          <span className="inline-flex min-h-9 items-center gap-2 self-start rounded-full bg-[#f8dfd7] px-3 text-xs font-semibold text-[#8f3427]">
            <AlertTriangle aria-hidden="true" size={15} /> {overview.overdueCount} overdue
          </span>
        ) : (
          <span className="inline-flex min-h-9 items-center gap-2 self-start rounded-full bg-[#e8efe8] px-3 text-xs font-semibold text-[#31533b]">
            <CheckCircle2 aria-hidden="true" size={15} /> No overdue payments
          </span>
        )}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="Scheduled outstanding" value={formatMoney(overview.knownOutstandingPence, plan.currency)} />
        <Metric label="Due in 30 days" value={String(overview.dueSoonCount)} />
        <Metric className="col-span-2 sm:col-span-1" label="Amounts still TBC" value={String(overview.unknownAmountCount)} />
      </dl>

      {visibleDeadlines.length > 0 ? (
        <>
          <ol aria-label="Upcoming payment commitments" className="mt-5 grid gap-3">
            {visibleDeadlines.map((deadline) => (
              <li className="rounded-2xl border border-[#e4ddd2] bg-[#fbf8f2] p-4" key={`${deadline.itemId}-${deadline.installmentId}-${deadline.dueDate}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#2f3d32]">{deadline.itemName}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-[#625f57]">
                      <CalendarClock aria-hidden="true" size={14} />
                      {deadline.label} · {formatDate(deadline.dueDate)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${urgencyClass(deadline.urgency)}`}>
                      {urgencyLabel(deadline.urgency)}
                    </span>
                    <span className="text-sm font-semibold text-[#173526]">
                      {deadline.outstandingPence === null ? "Amount TBC" : formatMoney(deadline.outstandingPence, plan.currency)}
                    </span>
                  </div>
                </div>
                <Link
                  className="focus-ring mt-3 inline-flex min-h-11 items-center rounded-full text-sm font-semibold text-[#173526] underline decoration-[#9c542d] underline-offset-4"
                  href={getPlanningHubPaymentDeadlineHref(plan, deadline, workspaceId)}
                  prefetch={false}
                >
                  Review payment plan
                </Link>
              </li>
            ))}
          </ol>
          {overview.deadlines.length > visibleDeadlines.length ? (
            <p className="mt-3 text-xs text-[#625f57]">{overview.deadlines.length - visibleDeadlines.length} more scheduled payments remain in the connected plan.</p>
          ) : null}
        </>
      ) : (
        <div className="mt-5 rounded-2xl bg-[#f3f6f1] p-5">
          <p className="text-sm font-semibold text-[#173526]">No payment deadlines scheduled yet.</p>
          <p className="mt-2 text-sm leading-6 text-[#625f57]">Open a planned venue or supplier to add its deposit, instalments and final-balance date.</p>
        </div>
      )}
    </section>
  );
}

function Metric({
  className = "",
  label,
  value,
}: {
  className?: string;
  label: string;
  value: string;
}) {
  return (
    <div className={`rounded-2xl bg-[#f8f4ed] p-4 ${className}`}>
      <dt className="text-xs text-[#625f57]">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-semibold text-[#173526]">{value}</dd>
    </div>
  );
}

function urgencyClass(urgency: "overdue" | "due_soon" | "upcoming") {
  if (urgency === "overdue") return "bg-[#f8dfd7] text-[#8f3427]";
  if (urgency === "due_soon") return "bg-[#fff0d4] text-[#80521e]";
  return "bg-[#e8efe8] text-[#31533b]";
}

function urgencyLabel(urgency: "overdue" | "due_soon" | "upcoming") {
  if (urgency === "overdue") return "Overdue";
  if (urgency === "due_soon") return "Due soon";
  return "Upcoming";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(`${value}T12:00:00`));
}
