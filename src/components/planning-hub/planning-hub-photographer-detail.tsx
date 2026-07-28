import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Clock, ExternalLink, Images, Mail, X } from "lucide-react";
import type { PlanningHubPhotographerDetail } from "@/lib/planning-hub/types";

export function PlanningHubPhotographerDetailPanel({
  detail,
  loading,
  onClose
}: {
  detail: PlanningHubPhotographerDetail | null;
  loading: boolean;
  onClose: () => void;
}) {
  if (!loading && !detail) return null;

  return (
    <section
      aria-busy={loading}
      aria-label={loading ? "Loading photographer details" : `${detail?.name ?? "Photographer"} details`}
      aria-live="polite"
      className="focus-ring mb-6 scroll-mt-24 overflow-hidden rounded-3xl border border-[#cfc3b3] bg-white"
      id="photographer-detail"
      tabIndex={-1}
    >
      {loading ? (
        <div className="grid min-h-72 place-items-center p-8 text-center">
          <div>
            <p className="font-display text-3xl font-semibold text-[#173526]">Opening photographer profile…</p>
            <p className="mt-2 text-sm text-[#625f57]">Gallery and coverage details load only when requested.</p>
          </div>
        </div>
      ) : detail ? (
        <>
          <div className="relative">
            <div className="grid aspect-[16/8] grid-cols-2 gap-1 overflow-hidden bg-[#eee8dd] sm:grid-cols-3">
              {(detail.gallery.length ? detail.gallery.slice(0, 3) : [{ id: "hero", url: detail.heroImageUrl, alt: detail.name }]).map((image, index) => (
                <div className={`relative ${index === 0 ? "col-span-2 sm:col-span-2" : ""}`} key={image.id}>
                  <Image alt={image.alt || `${detail.name} wedding photography`} className={detail.hasApprovedPhoto ? "object-cover" : "object-contain p-10"} fill sizes={index === 0 ? "(min-width: 640px) 55vw, 100vw" : "(min-width: 640px) 28vw, 50vw"} src={image.url} />
                </div>
              ))}
            </div>
            <button aria-label="Close photographer details" className="focus-ring absolute right-3 top-3 z-10 inline-grid min-h-11 min-w-11 place-items-center rounded-full bg-white text-[#173526] shadow" onClick={onClose} type="button">
              <X size={19} />
            </button>
          </div>
          <div className="p-5 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9c542d]">Photographer details</p>
            <h2 className="mt-2 font-display text-4xl font-semibold text-[#173526]">{detail.name}</h2>
            <p className="mt-2 text-sm text-[#625f57]">{detail.baseTown}, {detail.region}{detail.travelsNationwide ? " · travels nationwide" : ""}</p>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-[#514b43]">{detail.description || detail.summary}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {detail.styles.map((style) => <span className="rounded-full bg-[#f4efe7] px-3 py-1 text-xs font-medium text-[#665a4b]" key={style}>{style}</span>)}
              {detail.services.slice(0, 5).map((service) => <span className="rounded-full bg-[#e8efe8] px-3 py-1 text-xs font-medium text-[#415348]" key={service}>{service}</span>)}
            </div>
            <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <Detail icon={<Clock size={16} />} label="Coverage" value={formatRange(detail.coverageHoursMin, detail.coverageHoursMax, "hours")} />
              <Detail icon={<Images size={16} />} label="Turnaround" value={formatRange(detail.turnaroundWeeksMin, detail.turnaroundWeeksMax, "weeks")} />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-[#173526] px-5 text-sm font-semibold text-[#173526]" href={`/photographers/${detail.slug}`} prefetch={false}>
                Full profile <ExternalLink size={15} />
              </Link>
              {detail.enquiryUrl ? (
                <a className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-[#173526] px-5 text-sm font-semibold text-white" href={detail.enquiryUrl} rel="noreferrer" target="_blank">
                  Enquire <Mail size={15} />
                </a>
              ) : detail.officialWebsiteUrl ? (
                <a className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-[#173526] px-5 text-sm font-semibold text-white" href={detail.officialWebsiteUrl} rel="noreferrer" target="_blank">
                  Visit website <ExternalLink size={15} />
                </a>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl bg-[#f8f4ed] p-4"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#7a6d59]">{icon}{label}</p><p className="mt-2 text-[#403b35]">{value}</p></div>;
}

function formatRange(min: number | null, max: number | null, unit: string) {
  if (min == null && max == null) return "Ask photographer";
  if (min != null && max != null && min !== max) return `${min}–${max} ${unit}`;
  return `${min ?? max} ${unit}`;
}
