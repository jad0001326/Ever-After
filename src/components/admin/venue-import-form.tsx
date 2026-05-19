"use client";

import { useActionState } from "react";
import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { importVenuesFromFile } from "@/app/actions/venue-import";
import { Button } from "@/components/ui/button";

export function VenueImportForm() {
  const [state, formAction, pending] = useActionState(importVenuesFromFile, null);

  return (
    <div className="grid gap-6">
      <form action={formAction} className="rounded-3xl border border-[var(--line)] bg-white p-6">
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-[#4a443c]" htmlFor="file">Venue intake workbook</label>
          <input
            accept=".xlsx,.csv"
            className="focus-ring w-full rounded-2xl border border-[var(--line)] bg-[#fbf8f3] px-4 py-3 text-sm text-[#4a443c] file:mr-4 file:rounded-full file:border-0 file:bg-[var(--brand)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            id="file"
            name="file"
            required
            type="file"
          />
          <p className="text-sm leading-6 text-[var(--muted)]">
            Upload the EverAft intake workbook or a CSV exported from the Venue Intake sheet. Imports are created as drafts and matched by slug to prevent duplicates.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button disabled={pending} name="mode" type="submit" value="validate" variant="secondary">
            <FileSpreadsheet size={16} />
            {pending ? "Checking..." : "Validate file"}
          </Button>
          <Button disabled={pending} name="mode" type="submit" value="import">
            <UploadCloud size={16} />
            {pending ? "Importing..." : "Import valid rows as drafts"}
          </Button>
        </div>
      </form>

      {state ? (
        <section className="rounded-3xl border border-[var(--line)] bg-white p-6">
          <h2 className="font-display text-3xl font-semibold">Import results</h2>
          <p className={state.ok ? "mt-2 text-sm text-[var(--brand)]" : "mt-2 text-sm text-[#8a3c19]"}>{state.message}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-5">
            <Metric label="Rows read" value={state.rowsRead} />
            <Metric label="Valid rows" value={state.validRows} />
            <Metric label="Imported" value={state.importedRows} />
            <Metric label="Skipped" value={state.skippedRows} />
            <Metric label="Warnings" value={state.warnings.length} />
          </div>
          {state.warnings.length > 0 ? (
            <div className="mt-6 overflow-hidden rounded-2xl border border-[#e5d5b7]">
              <div className="grid grid-cols-[80px_1fr_2fr] gap-3 bg-[#fff9ef] px-4 py-3 text-sm font-semibold text-[#715622]">
                <span>Row</span>
                <span>Venue</span>
                <span>Warning</span>
              </div>
              {state.warnings.slice(0, 80).map((warning, index) => (
                <div className="grid grid-cols-[80px_1fr_2fr] gap-3 border-t border-[#e5d5b7] px-4 py-3 text-sm text-[#4a443c]" key={`${warning.row}-${index}`}>
                  <span>{warning.row || "-"}</span>
                  <span>{warning.venue || "-"}</span>
                  <span>{warning.message}</span>
                </div>
              ))}
            </div>
          ) : null}
          {state.errors.length > 0 ? (
            <div className="mt-6 overflow-hidden rounded-2xl border border-[#efd2bf]">
              <div className="grid grid-cols-[80px_1fr_2fr] gap-3 bg-[#fff4ed] px-4 py-3 text-sm font-semibold text-[#7a3b19]">
                <span>Row</span>
                <span>Venue</span>
                <span>Issue</span>
              </div>
              {state.errors.slice(0, 80).map((error, index) => (
                <div className="grid grid-cols-[80px_1fr_2fr] gap-3 border-t border-[#efd2bf] px-4 py-3 text-sm text-[#4a443c]" key={`${error.row}-${index}`}>
                  <span>{error.row || "-"}</span>
                  <span>{error.venue || "-"}</span>
                  <span>{error.message}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-[#fbf8f3] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a806f]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
