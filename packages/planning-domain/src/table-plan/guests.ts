import type { TablePlan, TablePlanGuest } from "./types";

export type GuestRsvpStatus = NonNullable<TablePlanGuest["rsvpStatus"]>;

export type TablePlanGuestOverview = {
  totalCount: number;
  acceptedCount: number;
  pendingCount: number;
  declinedCount: number;
  dietaryCount: number;
  seatingGuestCount: number;
  assignedCount: number;
  unassignedCount: number;
  targetGap: number;
};

export function getGuestRsvpStatus(guest: TablePlanGuest): GuestRsvpStatus {
  return guest.rsvpStatus ?? "pending";
}

export function isGuestForSeating(guest: TablePlanGuest) {
  return getGuestRsvpStatus(guest) !== "declined";
}

export function getTablePlanGuestOverview(
  plan: TablePlan,
  expectedGuestCount = 0,
): TablePlanGuestOverview {
  const acceptedCount = plan.guests.filter(
    (guest) => getGuestRsvpStatus(guest) === "accepted",
  ).length;
  const pendingCount = plan.guests.filter(
    (guest) => getGuestRsvpStatus(guest) === "pending",
  ).length;
  const declinedCount = plan.guests.filter(
    (guest) => getGuestRsvpStatus(guest) === "declined",
  ).length;
  const dietaryCount = plan.guests.filter(
    (guest) => Boolean(guest.dietaryNotes?.trim()),
  ).length;
  const seatingGuests = plan.guests.filter(isGuestForSeating);
  const assignedCount = seatingGuests.filter(
    (guest) => guest.tableId !== null && guest.seatIndex !== null,
  ).length;

  return {
    totalCount: plan.guests.length,
    acceptedCount,
    pendingCount,
    declinedCount,
    dietaryCount,
    seatingGuestCount: seatingGuests.length,
    assignedCount,
    unassignedCount: seatingGuests.length - assignedCount,
    targetGap: Math.max(0, expectedGuestCount - plan.guests.length),
  };
}
