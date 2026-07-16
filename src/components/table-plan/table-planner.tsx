"use client";

import { Eraser, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PlanHealth } from "./plan-health";
import { PlannerSidebar, type PlannerPanel } from "./planner-sidebar";
import { SeatingCanvas } from "./seating-canvas";
import { createEmptyTablePlan, createExampleTablePlan, evaluateArrangement, generateArrangement, planToCsv, restoreTablePlan, serializeTablePlan, TABLE_PLAN_STORAGE_KEY } from "@/lib/table-plan/planner";
import type { RuleConflict, SeatingRuleType, TablePlan, TablePlanTable } from "@/lib/table-plan/types";

function randomId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function TablePlanner() {
  const [plan, setPlan] = useState<TablePlan>(createEmptyTablePlan);
  const [ready, setReady] = useState(false);
  const [activePanel, setActivePanel] = useState<PlannerPanel>("guests");
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<RuleConflict[]>([]);
  const [previousPlan, setPreviousPlan] = useState<TablePlan | null>(null);
  const generationRef = useRef(1);

  useEffect(() => {
    queueMicrotask(() => {
      const restored = restoreTablePlan(window.localStorage.getItem(TABLE_PLAN_STORAGE_KEY));
      if (restored) {
        setPlan(restored);
        setConflicts(evaluateArrangement(restored));
      }
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(TABLE_PLAN_STORAGE_KEY, serializeTablePlan(plan));
  }, [plan, ready]);

  const assignedCount = useMemo(() => plan.guests.filter((guest) => guest.tableId).length, [plan.guests]);

  function updatePlan(updater: (current: TablePlan) => TablePlan) {
    setPlan((current) => ({ ...updater(current), updatedAt: new Date().toISOString() }));
  }

  function addGuest(name: string) {
    updatePlan((current) => ({ ...current, guests: [...current.guests, { id: randomId(), name, tableId: null, seatIndex: null }] }));
  }

  function pasteGuests(names: string[]) {
    updatePlan((current) => ({ ...current, guests: [...current.guests, ...names.map((name) => ({ id: randomId(), name, tableId: null, seatIndex: null }))] }));
  }

  function deleteGuest(guestId: string) {
    updatePlan((current) => ({ ...current, guests: current.guests.filter((guest) => guest.id !== guestId), rules: current.rules.filter((rule) => rule.personAId !== guestId && rule.personBId !== guestId) }));
    setSelectedGuestId((selected) => selected === guestId ? null : selected);
  }

  function addTable() {
    updatePlan((current) => ({ ...current, tables: [...current.tables, { id: randomId(), name: `Table ${current.tables.length + 1}`, capacity: 8, locked: false }] }));
  }

  function updateTable(tableId: string, updates: Partial<TablePlanTable>) {
    updatePlan((current) => {
      const table = current.tables.find((candidate) => candidate.id === tableId);
      if (!table) return current;
      const nextCapacity = updates.capacity ?? table.capacity;
      return {
        ...current,
        tables: current.tables.map((candidate) => candidate.id === tableId ? { ...candidate, ...updates } : candidate),
        guests: current.guests.map((guest) => guest.tableId === tableId && guest.seatIndex != null && guest.seatIndex >= nextCapacity ? { ...guest, tableId: null, seatIndex: null } : guest),
      };
    });
  }

  function deleteTable(tableId: string) {
    updatePlan((current) => ({ ...current, tables: current.tables.filter((table) => table.id !== tableId), guests: current.guests.map((guest) => guest.tableId === tableId ? { ...guest, tableId: null, seatIndex: null } : guest) }));
  }

  function addRule(personAId: string, type: SeatingRuleType, personBId: string) {
    updatePlan((current) => ({ ...current, rules: [...current.rules, { id: randomId(), personAId, personBId, type }] }));
  }

  function deleteRule(ruleId: string) {
    updatePlan((current) => ({ ...current, rules: current.rules.filter((rule) => rule.id !== ruleId) }));
    setConflicts((current) => current.filter((conflict) => conflict.ruleId !== ruleId));
  }

  function generate() {
    setPreviousPlan(plan);
    generationRef.current += 1;
    const result = generateArrangement(plan, generationRef.current * 7_919);
    setPlan(result.plan);
    setConflicts(result.conflicts);
    setSelectedGuestId(null);
  }

  function clearArrangement() {
    setPreviousPlan(plan);
    updatePlan((current) => ({ ...current, guests: current.guests.map((guest) => ({ ...guest, tableId: null, seatIndex: null })), tables: current.tables.map((table) => ({ ...table, locked: false })) }));
    setConflicts([]);
    setSelectedGuestId(null);
  }

  function undo() {
    if (!previousPlan) return;
    const current = plan;
    setPlan(previousPlan);
    setPreviousPlan(current);
    setConflicts(evaluateArrangement(previousPlan));
  }

  function loadExample() {
    setPreviousPlan(plan);
    const example = createExampleTablePlan();
    const result = generateArrangement(example, 42);
    setPlan(result.plan);
    setConflicts(result.conflicts);
    setSelectedGuestId(null);
  }

  function handleSeatClick(tableId: string, seatIndex: number, occupantId: string | null) {
    if (!selectedGuestId) {
      if (occupantId) setSelectedGuestId(occupantId);
      return;
    }
    const targetTable = plan.tables.find((table) => table.id === tableId);
    if (!targetTable || targetTable.locked) return;
    const selected = plan.guests.find((guest) => guest.id === selectedGuestId);
    if (!selected) return;
    setPreviousPlan(plan);
    const selectedSeat = { tableId: selected.tableId, seatIndex: selected.seatIndex };
    const nextPlan: TablePlan = {
      ...plan,
      guests: plan.guests.map((guest) => {
        if (guest.id === selectedGuestId) return { ...guest, tableId, seatIndex };
        if (guest.id === occupantId) return { ...guest, tableId: selectedSeat.tableId, seatIndex: selectedSeat.seatIndex };
        return guest;
      }),
      updatedAt: new Date().toISOString(),
    };
    setPlan(nextPlan);
    setConflicts(evaluateArrangement(nextPlan));
    setSelectedGuestId(null);
  }

  function downloadCsv() {
    const blob = new Blob([planToCsv(plan)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "everaft-table-plan.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-[96rem] px-4 pb-24 sm:px-6 lg:px-8">
      <div className="print:hidden flex flex-col gap-5 pb-6 pt-8 lg:flex-row lg:items-end lg:justify-between lg:pt-10">
        <div className="lg:max-w-[31rem] lg:flex-none">
          <h1 className="font-display text-4xl font-semibold leading-tight text-[var(--brand)] sm:text-5xl">Wedding table planner</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">Add your guests, set the relationships that matter and create a seating plan you can adjust.</p>
          <p className="mt-3 text-xs font-medium text-[#58705f]">{ready ? "Saved on this device" : "Preparing your plan"}</p>
        </div>
        <div className="flex flex-wrap gap-2 lg:w-[42rem] lg:justify-end">
          {plan.guests.length === 0 ? <button className="focus-ring min-h-11 rounded-full border border-[var(--line)] bg-white px-5 text-sm font-semibold text-[var(--foreground)]" onClick={loadExample} type="button">Try an example</button> : null}
          <button className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 text-sm font-semibold disabled:opacity-45" disabled={!previousPlan} onClick={undo} type="button"><RotateCcw size={17} /> Undo</button>
          <button className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-[#a96a45] bg-white px-5 text-sm font-semibold text-[#824324] disabled:opacity-45" disabled={assignedCount === 0} onClick={clearArrangement} type="button"><Eraser size={17} /> Clear arrangement</button>
          <button className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-[#9c542d] px-5 text-sm font-semibold text-white disabled:opacity-50" disabled={plan.guests.length === 0 || plan.tables.length === 0} onClick={generate} type="button"><Sparkles size={17} /> Generate arrangement</button>
        </div>
      </div>
      <div className="hidden print:block">
        <h1 className="font-display text-4xl font-semibold">{plan.name}</h1>
        <p className="mt-2 text-sm">Prepared with EverAft · {plan.guests.length} guests · {plan.tables.length} tables</p>
      </div>
      <div className="table-planner-grid grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)_17rem]">
        <PlannerSidebar activePanel={activePanel} onActivePanelChange={setActivePanel} onAddGuest={addGuest} onAddRule={addRule} onAddTable={addTable} onDeleteGuest={deleteGuest} onDeleteRule={deleteRule} onDeleteTable={deleteTable} onPasteGuests={pasteGuests} onSelectGuest={setSelectedGuestId} onUpdateTable={updateTable} plan={plan} selectedGuestId={selectedGuestId} />
        <SeatingCanvas onSeatClick={handleSeatClick} onSelectGuest={setSelectedGuestId} plan={plan} selectedGuestId={selectedGuestId} />
        <PlanHealth conflicts={conflicts} onDownloadCsv={downloadCsv} onPrint={() => window.print()} plan={plan} />
      </div>
    </div>
  );
}
