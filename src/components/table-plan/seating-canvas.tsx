"use client";

import { Lock, MousePointer2 } from "lucide-react";
import type { TablePlan, TablePlanGuest, TablePlanTable } from "@/lib/table-plan/types";
import { cn } from "@/lib/utils";

type SeatingCanvasProps = {
  plan: TablePlan;
  selectedGuestId: string | null;
  onSeatClick: (tableId: string, seatIndex: number, occupantId: string | null) => void;
  onSelectGuest: (guestId: string) => void;
};

export function SeatingCanvas({ plan, selectedGuestId, onSeatClick, onSelectGuest }: SeatingCanvasProps) {
  const unassigned = plan.guests.filter((guest) => !guest.tableId);
  return (
    <section aria-label="Seating arrangement" className="min-w-0 rounded-[1.5rem] border border-[var(--line)] bg-[#fffdf9] p-4 sm:p-5">
      <div className="print:hidden mb-4 flex flex-col gap-2 border-b border-[var(--line)] pb-4 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
        <span className="inline-flex items-center gap-2"><MousePointer2 size={16} /> Select a guest, then choose a seat.</span>
        {selectedGuestId ? <span className="font-semibold text-[var(--brand)]">Guest selected</span> : null}
      </div>
      <div className="grid gap-5 2xl:grid-cols-2">
        {plan.tables.map((table) => <TableDiagram key={table.id} onSeatClick={onSeatClick} onSelectGuest={onSelectGuest} plan={plan} selectedGuestId={selectedGuestId} table={table} />)}
      </div>
      {plan.tables.length === 0 ? <div className="grid min-h-80 place-items-center text-center"><div><p className="font-display text-3xl font-semibold">Add a table to begin</p><p className="mt-2 text-sm text-[var(--muted)]">Set its capacity, then generate your arrangement.</p></div></div> : null}
      {unassigned.length > 0 ? (
        <div className="print:hidden mt-5 rounded-2xl border border-dashed border-[#c7bba9] bg-white p-4">
          <p className="text-sm font-semibold">Unassigned guests</p>
          <div className="mt-3 flex flex-wrap gap-2">{unassigned.map((guest) => <button className={cn("focus-ring rounded-full border px-3 py-2 text-xs font-semibold", selectedGuestId === guest.id ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[#fbf7f0] text-[var(--foreground)]")} key={guest.id} onClick={() => onSelectGuest(guest.id)} type="button">{guest.name}</button>)}</div>
        </div>
      ) : null}
    </section>
  );
}

function TableDiagram({ table, plan, selectedGuestId, onSeatClick, onSelectGuest }: { table: TablePlanTable; plan: TablePlan; selectedGuestId: string | null; onSeatClick: SeatingCanvasProps["onSeatClick"]; onSelectGuest: SeatingCanvasProps["onSelectGuest"] }) {
  const seats = Array.from({ length: table.capacity }, (_, seatIndex) => plan.guests.find((guest) => guest.tableId === table.id && guest.seatIndex === seatIndex) ?? null);
  const occupied = seats.filter(Boolean).length;
  return (
    <article className="print:break-inside-avoid overflow-hidden rounded-[1.35rem] border border-[#ded4c5] bg-white">
      <div className="flex items-center justify-between border-b border-[#e8dfd2] px-4 py-3">
        <div><h2 className="font-display text-2xl font-semibold text-[var(--brand)]">{table.name}</h2><p className="text-xs text-[var(--muted)]">{occupied} of {table.capacity} seats filled</p></div>
        {table.locked ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--brand)]"><Lock size={14} /> Locked</span> : null}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1fr)] items-stretch gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)] sm:gap-3 sm:p-4">
        <div className="min-w-0 space-y-2">{seats.filter((_, index) => index % 2 === 0).map((guest, index) => <SeatButton guest={guest} hasSelection={Boolean(selectedGuestId)} isSelected={Boolean(guest && selectedGuestId === guest.id)} key={index} locked={table.locked} onClick={() => onSeatClick(table.id, index * 2, guest?.id ?? null)} onSelectGuest={onSelectGuest} seatIndex={index * 2} />)}</div>
        <div className="grid min-h-40 place-items-center rounded-[999px] border-2 border-[#c8ac82] bg-[#f5ead8] px-2 text-center shadow-[inset_0_0_0_7px_#fff9ef]">
          <div><p className="font-display text-xl font-semibold text-[var(--brand)]">{table.name}</p><p className="mt-1 text-[11px] text-[var(--muted)]">Capacity {table.capacity}</p></div>
        </div>
        <div className="min-w-0 space-y-2">{seats.filter((_, index) => index % 2 === 1).map((guest, index) => <SeatButton guest={guest} hasSelection={Boolean(selectedGuestId)} isSelected={Boolean(guest && selectedGuestId === guest.id)} key={index} locked={table.locked} onClick={() => onSeatClick(table.id, index * 2 + 1, guest?.id ?? null)} onSelectGuest={onSelectGuest} seatIndex={index * 2 + 1} />)}</div>
      </div>
    </article>
  );
}

function SeatButton({ guest, seatIndex, hasSelection, isSelected, locked, onClick, onSelectGuest }: { guest: TablePlanGuest | null; seatIndex: number; hasSelection: boolean; isSelected: boolean; locked: boolean; onClick: () => void; onSelectGuest: (id: string) => void }) {
  return (
    <button
      aria-label={guest ? `Seat ${seatIndex + 1}, ${guest.name}` : `Empty seat ${seatIndex + 1}`}
      className={cn("focus-ring flex min-h-14 min-w-0 w-full items-center gap-2 rounded-xl border px-2.5 text-left transition", guest ? "border-[#d7d0c5] bg-[#fffdf9]" : "border-dashed border-[#c8bca9] bg-[#fbf8f2]", isSelected ? "border-[var(--brand)] bg-[#e6efe8] ring-2 ring-[#9eb4a3]" : "hover:border-[#9eb4a3]", locked ? "cursor-default opacity-75" : "")}
      onClick={() => { if (locked) return; if (guest && !hasSelection) onSelectGuest(guest.id); else onClick(); }}
      type="button"
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#e9e1d4] text-[10px] font-bold text-[#6b6257]">{seatIndex + 1}</span>
      <span className={cn("min-w-0 truncate text-xs font-semibold", guest ? "text-[var(--foreground)]" : "text-[#8a8176]")}>{guest?.name ?? "Empty seat"}</span>
    </button>
  );
}
