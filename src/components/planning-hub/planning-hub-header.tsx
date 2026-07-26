import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Camera, MapPinned, Sparkles } from "lucide-react";

export function PlanningHubHeader({ stage = "venue" }: { stage?: "venue" | "photography" }) {
  const photography = stage === "photography";
  return (
    <header className="border-b border-[#d9d0c3] bg-[#fbf8f2]">
      <div className="mx-auto max-w-[96rem] px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full text-sm font-semibold text-[#24432f]" href="/wedding-budget-planner" prefetch={false}>
            <ArrowLeft size={17} /> Public Budget Planner
          </Link>
          <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#e8efe8] px-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#24432f]">
            <Sparkles size={14} /> Private beta
          </span>
        </div>
        <div className="mt-6 max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9c542d]">My EverAft</p>
          <h1 className="mt-2 font-[Georgia] text-4xl font-semibold leading-[0.95] tracking-[-0.04em] text-[#173526] sm:text-6xl">
            {photography ? "Choose photography that fits your real plan." : "Turn venue browsing into your wedding plan."}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#625f57] sm:text-base">
            {photography
              ? "Find photographers who cover your venue or location, then keep estimates, quotes, bookings and payments connected to the same wedding budget."
              : "Find a Scottish venue, compare the strongest options and keep every estimate, quote, booking and payment connected to your wedding budget."}
          </p>
        </div>
        <nav aria-label="Planning stages" className="mt-6 flex gap-2 overflow-x-auto pb-1">
          <StageLink active={!photography} href="/planning-hub" icon={<MapPinned size={16} />} label="Venue" />
          <StageLink active={photography} href="/planning-hub/photography" icon={<Camera size={16} />} label="Photography" />
        </nav>
      </div>
    </header>
  );
}

function StageLink({
  active,
  href,
  icon,
  label
}: {
  active: boolean;
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`focus-ring inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold ${
        active ? "bg-[#173526] text-white" : "border border-[#cfc3b3] bg-white text-[#173526]"
      }`}
      href={href}
      prefetch={false}
    >
      {icon} {label}
    </Link>
  );
}
