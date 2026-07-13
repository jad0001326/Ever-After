import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, DatabaseZap } from "lucide-react";

export type StatusTone = "success" | "warning" | "danger" | "neutral" | "info";

const toneClasses: Record<StatusTone, string> = {
  success: "bg-[#eaf3e8] text-[#35533e]",
  warning: "bg-[#fff1df] text-[#7b451f]",
  danger: "bg-[#fff0e8] text-[#8a3c19]",
  neutral: "bg-[#f4efe7] text-[#5b5348]",
  info: "bg-[#eaf2f7] text-[#34566a]"
};

export function EnrichmentMetric({ href, label, value, tone = "neutral" }: { href?: string; label: string; value: number; tone?: StatusTone }) {
  const content = (
    <>
      <div className={`mb-4 grid size-10 place-items-center rounded-full ${toneClasses[tone]}`}>
        {tone === "success" ? <CheckCircle2 size={18} /> : tone === "danger" || tone === "warning" ? <AlertTriangle size={18} /> : <DatabaseZap size={18} />}
      </div>
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </>
  );

  if (href) {
    return <Link className="rounded-3xl border border-[var(--line)] bg-white p-5 transition hover:bg-[#fbf8f3]" href={href}>{content}</Link>;
  }
  return <div className="rounded-3xl border border-[var(--line)] bg-white p-5">{content}</div>;
}

export function EnrichmentStatus({ children, tone = "neutral" }: { children: ReactNode; tone?: StatusTone }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneClasses[tone]}`}>{children}</span>;
}

export function EnrichmentTags({ empty = "None", values, tone = "neutral" }: { empty?: string; values: string[]; tone?: StatusTone }) {
  const uniqueValues = Array.from(new Set(values));
  if (uniqueValues.length === 0) return <span className="text-sm text-[var(--muted)]">{empty}</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {uniqueValues.map((value) => <EnrichmentStatus key={value} tone={tone}>{formatEnrichmentLabel(value)}</EnrichmentStatus>)}
    </div>
  );
}

export function EnrichmentSetupBanner({ message }: { message: string }) {
  return (
    <section className="rounded-3xl border border-[#e5d5b7] bg-[#fff9ef] p-6 text-[#715622]">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 shrink-0" size={20} />
        <div>
          <h2 className="font-display text-3xl font-semibold">Enrichment review needs setup</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6">{message}</p>
          <p className="mt-2 text-sm leading-6">No records were changed. Configure the service-role key and apply the enrichment workflow migration, then reload this page.</p>
        </div>
      </div>
    </section>
  );
}

export function EnrichmentRecordLink({ href, label = "Review" }: { href: string; label?: string }) {
  return <Link className="focus-ring inline-flex items-center gap-2 text-sm font-semibold text-[#35533e]" href={href}>{label}<ArrowRight size={16} /></Link>;
}

export function formatEnrichmentLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatEnrichmentDate(value: string | null | undefined) {
  if (!value) return "Not checked";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not checked";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function safeEnrichmentUrl(value: string | null | undefined) {
  if (!value || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}
