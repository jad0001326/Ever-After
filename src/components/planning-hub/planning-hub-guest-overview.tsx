import { Check, MessageCircleQuestion, NotebookTabs, Utensils, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import type { TablePlanGuestOverview } from "@/lib/table-plan/guests";

export function PlanningHubGuestOverview({
  expectedGuestCount,
  overview,
  onOpen,
}: {
  expectedGuestCount: number;
  overview: TablePlanGuestOverview;
  onOpen: () => void;
}) {
  return (
    <section
      aria-labelledby="guest-readiness-title"
      className="rounded-3xl border border-[var(--line)] bg-[#fbfaf7] p-5 sm:p-7"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#95502b]">Guest and table workspace</p>
      <div className="mt-2 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-display text-3xl font-semibold text-[#173526]" id="guest-readiness-title">Guests &amp; seating</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#625f57]">
            Track replies and dietary details before arranging only the guests who still need a seat. The full seating canvas stays unloaded until you open it.
          </p>
        </div>
        <button className="focus-ring min-h-11 shrink-0 rounded-full bg-[#173526] px-5 text-sm font-semibold text-white" onClick={onOpen} type="button">Open guest &amp; table planner</button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <GuestMetric icon={<Check size={17} />} label="Attending" value={overview.acceptedCount} />
        <GuestMetric icon={<MessageCircleQuestion size={17} />} label="Awaiting reply" value={overview.pendingCount} />
        <GuestMetric icon={<UsersRound size={17} />} label="Not attending" value={overview.declinedCount} />
        <GuestMetric icon={<NotebookTabs size={17} />} label="Seats assigned" value={`${overview.assignedCount}/${overview.seatingGuestCount}`} />
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <p className="rounded-2xl bg-white px-4 py-3 leading-6 text-[#625f57]">
          <Utensils className="mr-2 inline text-[#31533b]" size={17} />
          {overview.dietaryCount === 0
            ? "No dietary or accessibility notes recorded yet."
            : `${overview.dietaryCount} ${overview.dietaryCount === 1 ? "guest has" : "guests have"} dietary or accessibility notes.`}
        </p>
        <p className="rounded-2xl bg-white px-4 py-3 leading-6 text-[#625f57]">
          {expectedGuestCount > 0 && overview.targetGap > 0
            ? `Your profile estimates ${expectedGuestCount} guests; add ${overview.targetGap} more to reach that working total.`
            : overview.totalCount === 0
              ? "Add your first guest when the list is ready."
              : `${overview.totalCount} invited guests are in this plan.`}
        </p>
      </div>
    </section>
  );
}

function GuestMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-[#e4dbce] bg-white p-4">
      <span className="grid size-8 place-items-center rounded-full bg-[#edf2ec] text-[#31533b]">{icon}</span>
      <p className="mt-3 text-2xl font-semibold text-[#173526]">{value}</p>
      <p className="mt-1 text-xs text-[#625f57]">{label}</p>
    </div>
  );
}
