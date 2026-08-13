"use client";

import { useActionState } from "react";
import { FileCheck2, UploadCloud } from "lucide-react";
import { stageSupplierCatalogueFile } from "@/app/actions/supplier-catalogue";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function SupplierCatalogueImportForm({ defaultResearchDate }: { defaultResearchDate: string }) {
  const [state, formAction, pending] = useActionState(stageSupplierCatalogueFile, null);
  return (
    <section className="rounded-3xl border border-[var(--line)] bg-white p-6">
      <h2 className="font-display text-3xl font-semibold">Stage a research batch</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Validate a source-backed CSV or Excel workbook, then stage valid rows for admin review. This never publishes suppliers or sends outreach.</p>
      <form action={formAction} className="mt-5 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Batch source label"><Input maxLength={240} minLength={3} name="sourceLabel" required placeholder="August 2026 videographer research" /></Field>
          <Field label="Default research date"><Input max={defaultResearchDate} name="researchDate" required type="date" defaultValue={defaultResearchDate} /></Field>
        </div>
        <label className="grid gap-2 text-sm font-medium text-[#4a443c]">
          Supplier catalogue file
          <input accept=".csv,.xlsx" className="focus-ring w-full rounded-2xl border border-[var(--line)] bg-[#fbf8f3] px-4 py-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-[var(--brand)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" name="file" required type="file" />
        </label>
        <p className="text-sm text-[var(--muted)]"><a className="font-semibold text-[#35533e] underline" href="/templates/supplier-catalogue-import-template.csv">Download the CSV template</a>. Services and service areas use a vertical bar between values.</p>
        <div className="flex flex-wrap gap-3">
          <Button disabled={pending} name="mode" type="submit" value="validate" variant="secondary"><FileCheck2 size={16} />{pending ? "Checking..." : "Validate file"}</Button>
          <Button disabled={pending} name="mode" type="submit" value="stage"><UploadCloud size={16} />{pending ? "Staging..." : "Stage valid rows"}</Button>
        </div>
      </form>
      {state ? <div aria-live="polite" className="mt-5 rounded-2xl bg-[#fbf8f3] p-4">
        <p className={state.ok ? "text-sm font-semibold text-[#35533e]" : "text-sm font-semibold text-[#8a3c19]"}>{state.message}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4"><Metric label="Rows read" value={state.rowsRead} /><Metric label="Valid" value={state.validRows} /><Metric label="Staged" value={state.stagedRows} /><Metric label="Duplicate hints" value={state.duplicateHints} /></div>
        {state.errors.length ? <IssueList title="Issues" issues={state.errors} tone="error" /> : null}
        {state.warnings.length ? <IssueList title="Warnings" issues={state.warnings} tone="warning" /> : null}
      </div> : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-white p-3 ring-1 ring-[var(--line)]"><p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>;
}

function IssueList({ issues, title, tone }: { issues: { row: number; business?: string; message: string }[]; title: string; tone: "error" | "warning" }) {
  return <div className={`mt-4 rounded-2xl p-4 ${tone === "error" ? "bg-[#fff4ed] text-[#7a3b19]" : "bg-[#fff9ef] text-[#715622]"}`}><p className="text-sm font-semibold">{title} ({issues.length})</p><ul className="mt-2 grid gap-1 text-sm">{issues.slice(0, 80).map((issue, index) => <li key={`${issue.row}-${index}`}>Row {issue.row || "-"}{issue.business ? ` - ${issue.business}` : ""}: {issue.message}</li>)}</ul></div>;
}
