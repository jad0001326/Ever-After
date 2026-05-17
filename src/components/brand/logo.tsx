import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoVariant = "full" | "wordmark" | "icon";

type LogoProps = {
  variant?: LogoVariant;
  className?: string;
  wordmarkClassName?: string;
  showArch?: boolean;
  href?: string;
  ariaLabel?: string;
};

function Arch({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 180 54" fill="none" aria-hidden="true" className={cn("h-6 w-[7.25rem]", className)}>
      <path
        d="M14 47C34 15 62 6 90 6C118 6 146 15 166 47"
        stroke="var(--champagne)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M18 47C37 18 63.5 10 90 10C116.5 10 143 18 162 47"
        stroke="var(--champagne)"
        strokeOpacity="0.65"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BrandWord({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display text-[2rem] font-semibold leading-none tracking-[0.045em] text-[var(--ink)]",
        className
      )}
    >
      EverAft
    </span>
  );
}

function IconMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-grid size-9 place-items-center rounded-sm border border-[color:var(--champagne)]/70 bg-[var(--background)]",
        className
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 28 28" className="size-6" fill="none">
        <path
          d="M4.5 22.5C7.1 13.2 10.8 7.5 14 5.5C17.2 7.5 20.9 13.2 23.5 22.5"
          stroke="var(--ink)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M8.5 16.5H19.5" stroke="var(--champagne)" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function Logo({
  variant = "full",
  className,
  wordmarkClassName,
  showArch = true,
  href,
  ariaLabel = "EverAft home"
}: LogoProps) {
  const content =
    variant === "icon" ? (
      <IconMark className={className} />
    ) : (
      <span className={cn("inline-flex flex-col items-start", className)}>
        {showArch && <Arch className={variant === "wordmark" ? "mb-0.5 h-4 w-20" : "mb-1"} />}
        <BrandWord className={cn(variant === "wordmark" ? "text-2xl" : "text-3xl", wordmarkClassName)} />
      </span>
    );

  if (!href) return content;

  return (
    <Link href={href} aria-label={ariaLabel} className="inline-flex items-center">
      {content}
    </Link>
  );
}
