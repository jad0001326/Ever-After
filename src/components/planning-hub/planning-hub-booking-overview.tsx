import Link from "next/link";
import { BriefcaseBusiness, CheckCircle2, CircleGauge } from "lucide-react";
import { formatMoney } from "@/lib/budget/calculations";
import type { BudgetPlan } from "@/lib/budget/types";
import {
  getPlanningHubBookingOverview,
  getPlanningHubBookingStatusLabel,
} from "@/lib/planning-hub/bookings";
import { withPlanningWorkspace } from "@/lib/planning-hub/navigation";

export function PlanningHubBookingOverview({
  plan,
  workspaceId,
}: {
  plan: BudgetPlan;
  workspaceId?: string | null;
}) {
  const overview = getPlanningHubBookingOverview(plan, workspaceId);
  const visibleItems = overview.items.slice(0, 6);
  const progress = Math.min(Math.max(overview.budget.percentUsed, 0), 100);

  return (
    <section
      aria-labelledby="booking-overview-title"
      className="rounded-3xl border border-[#d8c7a7] bg-white p-5 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#95502b]">Connected budget</p>
          <h2 className="mt-2 flex items-center gap-2 font-display text-3xl font-semibold text-[#173526]" id="booking-overview-title">
            <BriefcaseBusiness aria-hidden="true" size={24} /> Budget &amp; bookings
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#625f57]">
            See what is planned, what is firmly booked and how much room remains before the next decision.
          </p>
        </div>
        <BudgetHealthBadge
          bookedCount={overview.bookedCount}
          health={overview.budget.health}
          remainingPence={overview.budget.remainingPence}
          currency={plan.currency}
        />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Remaining" value={formatMoney(overview.budget.remainingPence, plan.currency)} />
        <Metric label="Planned" value={formatMoney(overview.budget.plannedPence, plan.currency)} />
        <Metric label="Committed" value={formatMoney(overview.budget.committedPence, plan.currency)} />
        <Metric label="Paid" value={formatMoney(overview.budget.paidPence, plan.currency)} />
      </dl>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3 text-xs text-[#625f57]">
          <span>{overview.budget.percentUsed}% of spendable budget planned</span>
          <span>{overview.budget.missingPriceCount} cost{overview.budget.missingPriceCount === 1 ? "" : "s"} TBC</span>
        </div>
        <div
          aria-label="Spendable budget planned"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progress}
          className="mt-2 h-2 overflow-hidden rounded-full bg-[#ece5da]"
          role="progressbar"
        >
          <div
            className={`h-full rounded-full ${overview.budget.health === "over" ? "bg-[#a84435]" : "bg-[#31533b]"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {visibleItems.length > 0 ? (
        <>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
            <CountPill label="booked" value={overview.bookedCount} />
            <CountPill label="quotes" value={overview.quotedCount} />
            <CountPill label="shortlisted" value={overview.shortlistedCount} />
            <CountPill label="researching" value={overview.researchingCount} />
          </div>
          <ol aria-label="Booking pipeline" className="mt-4 grid gap-3">
            {visibleItems.map((item) => (
              <li className="rounded-2xl border border-[#e4ddd2] bg-[#fbf8f2] p-4" key={item.itemId}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[#2f3d32]">{item.itemName}</p>
                      {item.selectedVenue ? (
                        <span className="rounded-full bg-[#e8efe8] px-2 py-0.5 text-[0.7rem] font-semibold text-[#31533b]">
                          Selected venue
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-[#625f57]">
                      {item.categoryLabel} · {getPlanningHubBookingStatusLabel(item.bookingStatus)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-[#173526]">
                    {bookingAmountLabel(item, plan.currency)}
                  </p>
                </div>
                {item.stageHref ? (
                  <Link
                    className="focus-ring mt-3 inline-flex min-h-11 items-center rounded-full text-sm font-semibold text-[#173526] underline decoration-[#9c542d] underline-offset-4"
                    href={item.stageHref}
                    prefetch={false}
                  >
                    Review booking stage
                  </Link>
                ) : (
                  <p className="mt-3 text-xs leading-5 text-[#625f57]">
                    Tracked in the connected budget; its supplier stage remains gated.
                  </p>
                )}
              </li>
            ))}
          </ol>
          {overview.items.length > visibleItems.length ? (
            <p className="mt-3 text-xs text-[#625f57]">
              {overview.items.length - visibleItems.length} more planned item{overview.items.length - visibleItems.length === 1 ? "" : "s"} remain in the connected budget.
            </p>
          ) : null}
        </>
      ) : (
        <div className="mt-5 rounded-2xl bg-[#f3f6f1] p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#173526]">
            <CircleGauge aria-hidden="true" size={18} /> No bookings or shortlist items yet.
          </p>
          <p className="mt-2 text-sm leading-6 text-[#625f57]">
            Add a venue or photographer and the connected budget will appear here immediately.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link className="focus-ring inline-flex min-h-11 items-center justify-center rounded-full bg-[#173526] px-4 text-sm font-semibold text-white" href={withPlanningWorkspace("/planning-hub", workspaceId)}>
              Find a venue
            </Link>
            <Link className="focus-ring inline-flex min-h-11 items-center justify-center rounded-full border border-[#173526] px-4 text-sm font-semibold text-[#173526]" href={withPlanningWorkspace("/planning-hub/photography", workspaceId)}>
              Find a photographer
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

function BudgetHealthBadge({
  bookedCount,
  currency,
  health,
  remainingPence,
}: {
  bookedCount: number;
  currency: string;
  health: "healthy" | "close" | "over";
  remainingPence: number;
}) {
  if (health === "over") {
    return (
      <span className="inline-flex min-h-9 items-center gap-2 self-start rounded-full bg-[#f8dfd7] px-3 text-xs font-semibold text-[#8f3427]">
        {formatMoney(Math.abs(remainingPence), currency)} over budget
      </span>
    );
  }
  return (
    <span className="inline-flex min-h-9 items-center gap-2 self-start rounded-full bg-[#e8efe8] px-3 text-xs font-semibold text-[#31533b]">
      <CheckCircle2 aria-hidden="true" size={15} /> {bookedCount} booked
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#f8f4ed] p-4">
      <dt className="text-xs text-[#625f57]">{label}</dt>
      <dd className="mt-1 font-display text-xl font-semibold text-[#173526]">{value}</dd>
    </div>
  );
}

function CountPill({ label, value }: { label: string; value: number }) {
  const countLabel = value === 1 && label.endsWith("s") ? label.slice(0, -1) : label;
  return <span className="rounded-full bg-[#f3eee6] px-3 py-1.5 text-[#514b43]">{value} {countLabel}</span>;
}

function bookingAmountLabel(
  item: ReturnType<typeof getPlanningHubBookingOverview>["items"][number],
  currency: string,
) {
  if (item.costPence === null) return "Cost TBC";
  if (item.costPence > 0 && item.outstandingPence === 0) {
    return `${formatMoney(item.costPence, currency)} paid`;
  }
  if (item.paidPence > 0 && item.outstandingPence !== null) {
    return `${formatMoney(item.paidPence, currency)} paid · ${formatMoney(item.outstandingPence, currency)} left`;
  }
  return formatMoney(item.costPence, currency);
}
