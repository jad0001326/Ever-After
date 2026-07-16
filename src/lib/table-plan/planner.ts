import type { ArrangementResult, RuleConflict, SeatingRule, TablePlan, TablePlanGuest, TablePlanTable } from "./types";

export const TABLE_PLAN_STORAGE_KEY = "everaft:table-plan:v1";

type SeatSlot = { tableId: string; seatIndex: number };
type Placement = Map<string, SeatSlot>;

const HARD_RULE_PENALTY = 10_000;
const PREFERENCE_PENALTY = 100;

function randomId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createEmptyTablePlan(): TablePlan {
  return {
    schemaVersion: 1,
    id: randomId(),
    name: "Our wedding table plan",
    guests: [],
    tables: [
      { id: randomId(), name: "Top table", capacity: 8, locked: false },
      { id: randomId(), name: "Table 2", capacity: 8, locked: false },
      { id: randomId(), name: "Table 3", capacity: 8, locked: false },
    ],
    rules: [],
    updatedAt: new Date().toISOString(),
  };
}

export function createExampleTablePlan(): TablePlan {
  const plan = createEmptyTablePlan();
  const names = ["Amy Fraser", "Ben Fraser", "Chloe Martin", "David Martin", "Erin Campbell", "Fraser Young", "Grace Mitchell", "Harry Wilson", "Isla Stewart", "Jack Morrison", "Kara Lewis", "Liam McLean"];
  const guests = names.map<TablePlanGuest>((name, index) => ({ id: `example-guest-${index + 1}`, name, tableId: null, seatIndex: null }));
  return {
    ...plan,
    guests,
    rules: [
      { id: "example-rule-1", personAId: guests[0].id, personBId: guests[1].id, type: "prefer_next_to" },
      { id: "example-rule-2", personAId: guests[5].id, personBId: guests[10].id, type: "must_separate" },
    ],
  };
}

export function restoreTablePlan(raw: string | null): TablePlan | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TablePlan>;
    if (parsed.schemaVersion !== 1 || typeof parsed.id !== "string" || !Array.isArray(parsed.guests) || !Array.isArray(parsed.tables) || !Array.isArray(parsed.rules)) return null;
    return parsed as TablePlan;
  } catch {
    return null;
  }
}

export function serializeTablePlan(plan: TablePlan) {
  return JSON.stringify({ ...plan, schemaVersion: 1 });
}

function createRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffled<T>(items: T[], random: () => number) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function tableCapacityMap(tables: TablePlanTable[]) {
  return new Map(tables.map((table) => [table.id, table.capacity]));
}

function areAdjacent(a: SeatSlot | undefined, b: SeatSlot | undefined, capacities: Map<string, number>) {
  if (!a || !b || a.tableId !== b.tableId) return false;
  const capacity = capacities.get(a.tableId) ?? 0;
  const distance = Math.abs(a.seatIndex - b.seatIndex);
  return distance === 1 || (capacity > 2 && distance === capacity - 1);
}

function ruleSatisfied(rule: SeatingRule, placement: Placement, capacities: Map<string, number>) {
  const a = placement.get(rule.personAId);
  const b = placement.get(rule.personBId);
  if (!a || !b) return false;
  if (rule.type === "must_next_to" || rule.type === "prefer_next_to") return areAdjacent(a, b, capacities);
  if (rule.type === "must_not_next_to") return !areAdjacent(a, b, capacities);
  return a.tableId !== b.tableId;
}

function scorePlacement(rules: SeatingRule[], placement: Placement, capacities: Map<string, number>) {
  let score = 0;
  for (const rule of rules) {
    if (!ruleSatisfied(rule, placement, capacities)) score += rule.type === "prefer_next_to" ? PREFERENCE_PENALTY : HARD_RULE_PENALTY;
  }
  const counts = new Map(Array.from(capacities.keys(), (tableId) => [tableId, 0]));
  for (const seat of placement.values()) counts.set(seat.tableId, (counts.get(seat.tableId) ?? 0) + 1);
  const average = capacities.size > 0 ? placement.size / capacities.size : 0;
  for (const count of counts.values()) score += Math.round((count - average) ** 2 * 3);
  return score;
}

function placementFromAssignments(assignments: Array<string | null>, slots: SeatSlot[], fixed: Placement) {
  const placement = new Map(fixed);
  assignments.forEach((guestId, index) => {
    if (guestId) placement.set(guestId, slots[index]);
  });
  return placement;
}

function describeConflict(rule: SeatingRule, guestNames: Map<string, string>) {
  const personA = guestNames.get(rule.personAId) ?? "One guest";
  const personB = guestNames.get(rule.personBId) ?? "another guest";
  if (rule.type === "must_next_to") return `${personA} and ${personB} could not be seated next to one another.`;
  if (rule.type === "must_not_next_to") return `${personA} and ${personB} are seated next to one another.`;
  return `${personA} and ${personB} must be seated at different tables.`;
}

export function generateArrangement(plan: TablePlan, seed = Date.now()): ArrangementResult {
  const totalCapacity = plan.tables.reduce((sum, table) => sum + table.capacity, 0);
  if (totalCapacity < plan.guests.length) {
    return { plan, conflicts: [{ ruleId: null, message: `Add ${plan.guests.length - totalCapacity} more seats before generating the arrangement.` }], preferenceScore: 0 };
  }

  const capacities = tableCapacityMap(plan.tables);
  const lockedTableIds = new Set(plan.tables.filter((table) => table.locked).map((table) => table.id));
  const fixed: Placement = new Map();
  const fixedSeatKeys = new Set<string>();
  for (const guest of plan.guests) {
    if (guest.tableId && guest.seatIndex != null && lockedTableIds.has(guest.tableId)) {
      fixed.set(guest.id, { tableId: guest.tableId, seatIndex: guest.seatIndex });
      fixedSeatKeys.add(`${guest.tableId}:${guest.seatIndex}`);
    }
  }

  const movableSlots: SeatSlot[] = [];
  for (const table of plan.tables) {
    for (let seatIndex = 0; seatIndex < table.capacity; seatIndex += 1) {
      if (!fixedSeatKeys.has(`${table.id}:${seatIndex}`)) movableSlots.push({ tableId: table.id, seatIndex });
    }
  }
  const movableGuestIds = plan.guests.filter((guest) => !fixed.has(guest.id)).map((guest) => guest.id);
  const emptyCount = movableSlots.length - movableGuestIds.length;
  const baseAssignments: Array<string | null> = [...movableGuestIds, ...Array.from({ length: Math.max(0, emptyCount) }, () => null)];
  const random = createRandom(seed);
  let bestPlacement = placementFromAssignments(baseAssignments, movableSlots, fixed);
  let bestScore = scorePlacement(plan.rules, bestPlacement, capacities);
  const attempts = Math.min(50, Math.max(18, plan.rules.length * 5));
  const swapsPerAttempt = Math.min(1_500, Math.max(350, movableSlots.length * 25));

  for (let attempt = 0; attempt < attempts && bestScore > 0; attempt += 1) {
    const assignments = shuffled(baseAssignments, random);
    let placement = placementFromAssignments(assignments, movableSlots, fixed);
    let score = scorePlacement(plan.rules, placement, capacities);
    for (let swap = 0; swap < swapsPerAttempt && score > 0; swap += 1) {
      const first = Math.floor(random() * assignments.length);
      const second = Math.floor(random() * assignments.length);
      if (first === second) continue;
      [assignments[first], assignments[second]] = [assignments[second], assignments[first]];
      const candidatePlacement = placementFromAssignments(assignments, movableSlots, fixed);
      const candidateScore = scorePlacement(plan.rules, candidatePlacement, capacities);
      if (candidateScore <= score) {
        placement = candidatePlacement;
        score = candidateScore;
      } else {
        [assignments[first], assignments[second]] = [assignments[second], assignments[first]];
      }
    }
    if (score < bestScore) {
      bestScore = score;
      bestPlacement = placement;
    }
  }

  const guestNames = new Map(plan.guests.map((guest) => [guest.id, guest.name]));
  const conflicts: RuleConflict[] = plan.rules
    .filter((rule) => rule.type !== "prefer_next_to" && !ruleSatisfied(rule, bestPlacement, capacities))
    .map((rule) => ({ ruleId: rule.id, message: describeConflict(rule, guestNames) }));
  const preferenceScore = plan.rules.filter((rule) => rule.type === "prefer_next_to" && ruleSatisfied(rule, bestPlacement, capacities)).length;
  const guests = plan.guests.map((guest) => {
    const seat = bestPlacement.get(guest.id);
    return { ...guest, tableId: seat?.tableId ?? null, seatIndex: seat?.seatIndex ?? null };
  });

  return { plan: { ...plan, guests, updatedAt: new Date().toISOString() }, conflicts, preferenceScore };
}

export function evaluateArrangement(plan: TablePlan): RuleConflict[] {
  const placement: Placement = new Map();
  plan.guests.forEach((guest) => {
    if (guest.tableId && guest.seatIndex != null) placement.set(guest.id, { tableId: guest.tableId, seatIndex: guest.seatIndex });
  });
  const capacities = tableCapacityMap(plan.tables);
  const names = new Map(plan.guests.map((guest) => [guest.id, guest.name]));
  return plan.rules
    .filter((rule) => rule.type !== "prefer_next_to" && !ruleSatisfied(rule, placement, capacities))
    .map((rule) => ({ ruleId: rule.id, message: describeConflict(rule, names) }));
}

export function planToCsv(plan: TablePlan) {
  const tableNames = new Map(plan.tables.map((table) => [table.id, table.name]));
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const rows = [...plan.guests]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((guest) => [escape(guest.name), escape(guest.tableId ? tableNames.get(guest.tableId) ?? "" : "Unassigned"), guest.seatIndex == null ? "" : String(guest.seatIndex + 1)]);
  return [["Guest", "Table", "Seat"], ...rows].map((row) => row.join(",")).join("\r\n");
}
