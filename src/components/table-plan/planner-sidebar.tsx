"use client";

import { ClipboardPaste, Lock, Plus, Search, Trash2, Unlock, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import type { SeatingRuleType, TablePlan, TablePlanGuest, TablePlanTable } from "@/lib/table-plan/types";
import { cn } from "@/lib/utils";

export type PlannerPanel = "guests" | "tables" | "rules";

const RULE_LABELS: Record<SeatingRuleType, string> = {
  must_next_to: "Must sit next to",
  prefer_next_to: "Prefer to sit next to",
  must_not_next_to: "Must not sit next to",
  must_separate: "Must sit at separate tables",
};

type PlannerSidebarProps = {
  activePanel: PlannerPanel;
  plan: TablePlan;
  selectedGuestId: string | null;
  onActivePanelChange: (panel: PlannerPanel) => void;
  onAddGuest: (name: string) => void;
  onPasteGuests: (names: string[]) => void;
  onDeleteGuest: (guestId: string) => void;
  onSelectGuest: (guestId: string) => void;
  onAddTable: () => void;
  onUpdateTable: (tableId: string, updates: Partial<TablePlanTable>) => void;
  onDeleteTable: (tableId: string) => void;
  onAddRule: (personAId: string, type: SeatingRuleType, personBId: string) => void;
  onDeleteRule: (ruleId: string) => void;
};

export function PlannerSidebar(props: PlannerSidebarProps) {
  const tabs: Array<{ id: PlannerPanel; label: string }> = [
    { id: "guests", label: "Guests" },
    { id: "tables", label: "Tables" },
    { id: "rules", label: "Rules" },
  ];
  return (
    <aside className="print:hidden overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-white">
      <div className="grid grid-cols-3 border-b border-[var(--line)]">
        {tabs.map((tab) => (
          <button
            className={cn("focus-ring min-h-12 border-b-2 px-2 text-sm font-semibold transition", props.activePanel === tab.id ? "border-[var(--brand)] text-[var(--brand)]" : "border-transparent text-[var(--muted)] hover:bg-[#fbf7f0]")}
            key={tab.id}
            onClick={() => props.onActivePanelChange(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      {props.activePanel === "guests" ? <GuestPanel {...props} /> : null}
      {props.activePanel === "tables" ? <TablePanel {...props} /> : null}
      {props.activePanel === "rules" ? <RulePanel {...props} /> : null}
    </aside>
  );
}

function GuestPanel({ plan, selectedGuestId, onAddGuest, onPasteGuests, onDeleteGuest, onSelectGuest }: PlannerSidebarProps) {
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pastedNames, setPastedNames] = useState("");
  const tableNames = useMemo(() => new Map(plan.tables.map((table) => [table.id, table.name])), [plan.tables]);
  const guests = useMemo(() => plan.guests.filter((guest) => guest.name.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)), [plan.guests, search]);

  function submitGuest() {
    if (!name.trim()) return;
    onAddGuest(name.trim());
    setName("");
  }

  function submitPastedGuests() {
    const names = pastedNames.split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean);
    if (names.length === 0) return;
    onPasteGuests(names);
    setPastedNames("");
    setPasteOpen(false);
  }

  return (
    <div className="p-4">
      <label className="relative block">
        <span className="sr-only">Search guests</span>
        <Search className="pointer-events-none absolute left-3 top-3.5 text-[#817a70]" size={17} />
        <input className="focus-ring min-h-11 w-full rounded-xl border border-[var(--line)] bg-[#fffdf9] pl-10 pr-3 text-sm" onChange={(event) => setSearch(event.target.value)} placeholder="Search guests" value={search} />
      </label>
      <div className="mt-3 flex gap-2">
        <input className="focus-ring min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--line)] px-3 text-sm" onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitGuest(); }} placeholder="Guest name" value={name} />
        <button aria-label="Add guest" className="focus-ring grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--brand)] text-white" onClick={submitGuest} type="button"><UserPlus size={18} /></button>
      </div>
      <button className="focus-ring mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--brand)] text-sm font-semibold text-[var(--brand)]" onClick={() => setPasteOpen((open) => !open)} type="button"><ClipboardPaste size={17} /> Paste a guest list</button>
      {pasteOpen ? (
        <div className="mt-3 rounded-xl bg-[#f8f3ea] p-3">
          <label className="text-xs font-semibold text-[#514b43]" htmlFor="guest-list">One name per line</label>
          <textarea className="focus-ring mt-2 min-h-28 w-full resize-y rounded-lg border border-[var(--line)] bg-white p-3 text-sm" id="guest-list" onChange={(event) => setPastedNames(event.target.value)} placeholder={"Amy Fraser\nBen Fraser\nChloe Martin"} value={pastedNames} />
          <button className="focus-ring mt-2 min-h-10 w-full rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-white" onClick={submitPastedGuests} type="button">Add these guests</button>
        </div>
      ) : null}
      <div className="mt-5 flex items-center justify-between text-xs text-[var(--muted)]"><span>{plan.guests.length} guests</span><span>Select to move</span></div>
      <div className="mt-2 max-h-[34rem] divide-y divide-[#eee8de] overflow-y-auto">
        {guests.map((guest) => <GuestRow guest={guest} isSelected={selectedGuestId === guest.id} key={guest.id} onDelete={onDeleteGuest} onSelect={onSelectGuest} tableName={guest.tableId ? tableNames.get(guest.tableId) : undefined} />)}
        {guests.length === 0 ? <p className="py-8 text-center text-sm text-[var(--muted)]">{plan.guests.length === 0 ? "Add your first guest to begin." : "No guests match that search."}</p> : null}
      </div>
    </div>
  );
}

function GuestRow({ guest, tableName, isSelected, onSelect, onDelete }: { guest: TablePlanGuest; tableName?: string; isSelected: boolean; onSelect: (id: string) => void; onDelete: (id: string) => void }) {
  const initials = guest.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return (
    <div className={cn("group flex items-center gap-2 rounded-lg px-1 py-2", isSelected ? "bg-[#e6efe8] ring-1 ring-[#9eb4a3]" : "hover:bg-[#fbf7f0]")}>
      <button className="focus-ring flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => onSelect(guest.id)} type="button">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e0e9e2] text-xs font-semibold text-[var(--brand)]">{initials}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{guest.name}</span>
        <span className="max-w-20 truncate text-[11px] text-[var(--muted)]">{tableName ?? "Unassigned"}</span>
      </button>
      <button aria-label={`Delete ${guest.name}`} className="focus-ring grid size-8 shrink-0 place-items-center rounded-full text-[#8c8378] opacity-60 hover:bg-white hover:text-[#8f3f2b] group-hover:opacity-100" onClick={() => onDelete(guest.id)} type="button"><Trash2 size={15} /></button>
    </div>
  );
}

function TablePanel({ plan, onAddTable, onUpdateTable, onDeleteTable }: PlannerSidebarProps) {
  const [capacityDrafts, setCapacityDrafts] = useState<Record<string, string>>({});

  function commitCapacity(table: TablePlanTable) {
    const draft = capacityDrafts[table.id];
    const parsed = draft === undefined || draft === "" ? table.capacity : Number.parseInt(draft, 10);
    const capacity = Math.max(2, Math.min(20, Number.isFinite(parsed) ? parsed : table.capacity));
    onUpdateTable(table.id, { capacity });
    setCapacityDrafts((current) => {
      const next = { ...current };
      delete next[table.id];
      return next;
    });
  }

  return (
    <div className="p-4">
      <div className="space-y-3">
        {plan.tables.map((table) => (
          <div className="rounded-xl border border-[var(--line)] bg-[#fffdf9] p-3" key={table.id}>
            <div className="flex items-center gap-2">
              <input aria-label="Table name" className="focus-ring min-h-10 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-semibold" onChange={(event) => onUpdateTable(table.id, { name: event.target.value })} value={table.name} />
              <button aria-label={table.locked ? `Unlock ${table.name}` : `Lock ${table.name}`} className={cn("focus-ring grid size-10 place-items-center rounded-lg border", table.locked ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-white text-[var(--muted)]")} onClick={() => onUpdateTable(table.id, { locked: !table.locked })} type="button">{table.locked ? <Lock size={16} /> : <Unlock size={16} />}</button>
              <button aria-label={`Delete ${table.name}`} className="focus-ring grid size-10 place-items-center rounded-lg border border-[var(--line)] bg-white text-[#8f3f2b] disabled:opacity-40" disabled={plan.tables.length === 1} onClick={() => onDeleteTable(table.id)} type="button"><Trash2 size={16} /></button>
            </div>
            <label className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
              Capacity
              <input
                aria-label={`Capacity for ${table.name}`}
                className="focus-ring min-h-9 w-20 rounded-lg border border-[var(--line)] bg-white px-2 text-center text-sm text-[var(--foreground)]"
                inputMode="numeric"
                onBlur={() => commitCapacity(table)}
                onChange={(event) => setCapacityDrafts((current) => ({ ...current, [table.id]: event.target.value.replace(/\D/g, "") }))}
                onFocus={(event) => event.currentTarget.select()}
                onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                onPointerUp={(event) => event.currentTarget.select()}
                pattern="[0-9]*"
                type="text"
                value={capacityDrafts[table.id] ?? String(table.capacity)}
              />
            </label>
          </div>
        ))}
      </div>
      <button className="focus-ring mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-dashed border-[var(--brand)] text-sm font-semibold text-[var(--brand)]" onClick={onAddTable} type="button"><Plus size={17} /> Add table</button>
      <p className="mt-4 text-xs leading-5 text-[var(--muted)]">Locked tables keep their current guests and seats when you generate again.</p>
    </div>
  );
}

function RulePanel({ plan, onAddRule, onDeleteRule }: PlannerSidebarProps) {
  const [personAId, setPersonAId] = useState("");
  const [personBId, setPersonBId] = useState("");
  const [type, setType] = useState<SeatingRuleType>("must_next_to");
  const guestNames = useMemo(() => new Map(plan.guests.map((guest) => [guest.id, guest.name])), [plan.guests]);
  const canAdd = Boolean(personAId && personBId && personAId !== personBId);
  return (
    <div className="p-4">
      <p className="text-sm leading-6 text-[var(--muted)]">Hard rules are always prioritised. Preferences are used when the arrangement allows.</p>
      <div className="mt-4 space-y-3 rounded-xl bg-[#f8f3ea] p-3">
        <GuestSelect id="rule-person-a" label="Person A" onChange={setPersonAId} value={personAId} guests={plan.guests} />
        <label className="block text-xs font-semibold text-[#514b43]" htmlFor="rule-type">Rule
          <select className="focus-ring mt-1 min-h-10 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-normal text-[var(--foreground)]" id="rule-type" onChange={(event) => setType(event.target.value as SeatingRuleType)} value={type}>
            {Object.entries(RULE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <GuestSelect id="rule-person-b" label="Person B" onChange={setPersonBId} value={personBId} guests={plan.guests.filter((guest) => guest.id !== personAId)} />
        <button className="focus-ring min-h-10 w-full rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={!canAdd} onClick={() => { if (!canAdd) return; onAddRule(personAId, type, personBId); setPersonAId(""); setPersonBId(""); }} type="button"><span className="inline-flex items-center gap-2"><Plus size={16} /> Add rule</span></button>
      </div>
      <div className="mt-5 space-y-2">
        {plan.rules.map((rule) => (
          <div className="rounded-xl border border-[var(--line)] bg-white p-3" key={rule.id}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm leading-5"><span className="font-semibold">{guestNames.get(rule.personAId)}</span><br /><span className="text-xs text-[var(--muted)]">{RULE_LABELS[rule.type].toLowerCase()}</span><br /><span className="font-semibold">{guestNames.get(rule.personBId)}</span></p>
              <button aria-label="Delete rule" className="focus-ring grid size-8 place-items-center rounded-full text-[#8f3f2b] hover:bg-[#f8eee9]" onClick={() => onDeleteRule(rule.id)} type="button"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
        {plan.rules.length === 0 ? <p className="py-6 text-center text-sm text-[var(--muted)]">No seating rules yet.</p> : null}
      </div>
    </div>
  );
}

function GuestSelect({ id, label, value, guests, onChange }: { id: string; label: string; value: string; guests: TablePlanGuest[]; onChange: (value: string) => void }) {
  return <label className="block text-xs font-semibold text-[#514b43]" htmlFor={id}>{label}<select className="focus-ring mt-1 min-h-10 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-normal text-[var(--foreground)]" id={id} onChange={(event) => onChange(event.target.value)} value={value}><option value="">Choose a guest</option>{guests.map((guest) => <option key={guest.id} value={guest.id}>{guest.name}</option>)}</select></label>;
}
