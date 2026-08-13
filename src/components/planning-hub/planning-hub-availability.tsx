"use client";

import { CalendarCheck2 } from "lucide-react";
import type { AvailabilityStatus, BudgetItem } from "@/lib/budget/types";
import { getPlanningHubItemAvailability } from "@/lib/planning-hub/plan";

export function PlanningHubAvailability({
  item,
  onChange,
  weddingDate,
}: {
  item: BudgetItem;
  onChange: (status: AvailabilityStatus) => void;
  weddingDate: string | null;
}) {
  const availability = getPlanningHubItemAvailability(item, weddingDate);
  const formattedDate = weddingDate ? formatDate(weddingDate) : null;

  return (
    <details className="border-b border-[#e4ddd2]">
      <summary className="focus-ring flex min-h-14 cursor-pointer list-none items-center justify-between px-5 font-semibold text-[#173526]">
        Date availability <CalendarCheck2 size={18} />
      </summary>
      <div className="grid gap-3 px-5 pb-5">
        {formattedDate ? (
          <>
            <label className="grid gap-1.5 text-xs font-semibold text-[#514b43]">
              Availability for {formattedDate}
              <select
                className="focus-ring min-h-11 w-full rounded-xl border border-[#cfc3b3] bg-white px-3 text-sm"
                onChange={(event) => onChange(event.target.value as AvailabilityStatus)}
                value={availability.stale ? "not_checked" : availability.status}
              >
                <option value="not_checked">Not checked</option>
                <option value="enquiry_sent">Enquiry sent</option>
                <option value="available">Available for this date</option>
                <option value="unavailable">Unavailable for this date</option>
              </select>
            </label>
            {availability.stale ? (
              <p className="rounded-xl bg-[#fff4ed] px-3 py-2 text-xs leading-5 text-[#7c3f22]" role="status">
                {availability.checkedDate
                  ? `This was last checked for ${formatDate(availability.checkedDate)}.`
                  : "This was recorded before the current wedding date was set."} Confirm availability again for {formattedDate}.
              </p>
            ) : (
              <p className="text-xs leading-5 text-[#625f57]">
                {availabilityMessage(availability.status, formattedDate)}
              </p>
            )}
          </>
        ) : (
          <p className="rounded-xl bg-[#fff9ef] px-3 py-2 text-xs leading-5 text-[#6f5436]">
            Add your wedding date before recording availability. EverAft does not infer calendar availability from a public listing.
          </p>
        )}
      </div>
    </details>
  );
}

function availabilityMessage(status: AvailabilityStatus, date: string) {
  if (status === "enquiry_sent") return `Waiting for the business to confirm ${date}.`;
  if (status === "available") return `You recorded that the business is available on ${date}.`;
  if (status === "unavailable") return `You recorded that the business is unavailable on ${date}.`;
  return "Confirm the date directly with the business before treating it as suitable or booked.";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(`${value}T12:00:00Z`));
}
