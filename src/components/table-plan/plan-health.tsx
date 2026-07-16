"use client";

import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, HeartPulse, Printer } from "lucide-react";
import type { RuleConflict, TablePlan } from "@/lib/table-plan/types";

export function PlanHealth({ plan, conflicts, onPrint, onDownloadCsv }: { plan: TablePlan; conflicts: RuleConflict[]; onPrint: () => void; onDownloadCsv: () => void }) {
  const capacity = plan.tables.reduce((sum, table) => sum + table.capacity, 0);
  const assigned = plan.guests.filter((guest) => guest.tableId).length;
  const available = Math.max(0, capacity - assigned);
  return (
    <aside className="print:hidden self-start rounded-[1.5rem] border border-[var(--line)] bg-white p-5 lg:sticky lg:top-24">
      <h2 className="flex items-center gap-2 font-display text-2xl font-semibold text-[var(--brand)]"><HeartPulse size={21} /> Plan health</h2>
      <dl className="mt-5 space-y-3 text-sm">
        <SummaryRow label="Guests" value={String(plan.guests.length)} />
        <SummaryRow label="Tables" value={String(plan.tables.length)} />
        <SummaryRow label="Rules" value={String(plan.rules.length)} />
        <SummaryRow label="Seats available" value={String(available)} />
      </dl>
      <div className="mt-5 border-t border-[var(--line)] pt-5">
        {conflicts.length === 0 ? (
          <div className="rounded-xl bg-[#eaf2eb] p-3 text-sm text-[#23462f]"><p className="flex items-center gap-2 font-semibold"><CheckCircle2 size={17} /> No hard-rule conflicts</p><p className="mt-1 text-xs leading-5 text-[#506757]">Generate again to try a different arrangement, or select guests to move them manually.</p></div>
        ) : (
          <div className="rounded-xl bg-[#fff2ea] p-3 text-sm text-[#7f3e25]"><p className="flex items-center gap-2 font-semibold"><AlertTriangle size={17} /> {conflicts.length} issue{conflicts.length === 1 ? "" : "s"} to review</p><ul className="mt-2 space-y-2 text-xs leading-5">{conflicts.map((conflict, index) => <li key={`${conflict.ruleId ?? "capacity"}-${index}`}>{conflict.message}</li>)}</ul></div>
        )}
      </div>
      <div className="mt-6 border-t border-[var(--line)] pt-5">
        <h3 className="flex items-center gap-2 font-display text-xl font-semibold"><Download size={18} /> Export plan</h3>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Print the tables or save them as a PDF, then export the venue-ready guest list.</p>
        <button className="focus-ring mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-white" onClick={onPrint} type="button"><Printer size={17} /> Print / save PDF</button>
        <button className="focus-ring mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--brand)] px-4 text-sm font-semibold text-[var(--brand)]" onClick={onDownloadCsv} type="button"><FileSpreadsheet size={17} /> Export guest list CSV</button>
      </div>
    </aside>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><dt className="text-[var(--muted)]">{label}</dt><dd className="font-semibold text-[var(--foreground)]">{value}</dd></div>;
}
