import type { TablePlan } from "@everaft/planning-domain/table-plan/types";

export function normalizeTablePlanForSave(plan: TablePlan): TablePlan {
  let changed = false;
  const guests = plan.guests.map((guest) => {
    if (guest.rsvpStatus !== "declined"
      || (guest.tableId === null && guest.seatIndex === null)) {
      return guest;
    }
    changed = true;
    return { ...guest, tableId: null, seatIndex: null };
  });
  return changed ? { ...plan, guests } : plan;
}

export function tablePlanContentMatches(left: TablePlan, right: TablePlan) {
  return JSON.stringify(tablePlanContent(left)) === JSON.stringify(tablePlanContent(right));
}

function tablePlanContent(plan: TablePlan) {
  return {
    schemaVersion: plan.schemaVersion,
    id: plan.id,
    name: plan.name,
    guests: plan.guests.map((guest) => ({
      id: guest.id,
      name: guest.name,
      email: guest.email ?? null,
      rsvpStatus: guest.rsvpStatus ?? "pending",
      dietaryNotes: guest.dietaryNotes ?? null,
      tableId: guest.tableId,
      seatIndex: guest.seatIndex,
    })),
    tables: plan.tables.map((table) => ({
      id: table.id,
      name: table.name,
      capacity: table.capacity,
      locked: table.locked,
    })),
    rules: plan.rules
      .map((rule) => ({
        id: rule.id,
        personAId: rule.personAId,
        personBId: rule.personBId,
        type: rule.type,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}
