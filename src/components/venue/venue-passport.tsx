import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type VenuePassportVariant = "heritage" | "cartographic";

export type VenuePassportVenue = {
  id: string;
  slug: string;
  name: string;
  type: string;
  town: string;
  region: string;
};

type VenuePassportProps = {
  venue: VenuePassportVenue;
  variant?: VenuePassportVariant;
  className?: string;
};

type PassportPalette = {
  heritageBackground: string;
  heritageInk: string;
  paper: string;
  paperInk: string;
  accent: string;
};

const passportPalettes: PassportPalette[] = [
  { heritageBackground: "#24432f", heritageInk: "#fbf7ef", paper: "#efe7da", paperInk: "#20382a", accent: "#bc845f" },
  { heritageBackground: "#5b302e", heritageInk: "#fff8ed", paper: "#f2e5dc", paperInk: "#4d2928", accent: "#c48a67" },
  { heritageBackground: "#2e414d", heritageInk: "#fbf6eb", paper: "#e6e9e7", paperInk: "#253943", accent: "#c19a70" },
  { heritageBackground: "#493a4b", heritageInk: "#fff7ed", paper: "#ece5e8", paperInk: "#403143", accent: "#c58f72" },
  { heritageBackground: "#4b543d", heritageInk: "#fff8ea", paper: "#ece9dc", paperInk: "#3e4933", accent: "#c69a64" },
  { heritageBackground: "#49565a", heritageInk: "#fff8ef", paper: "#e8e9e5", paperInk: "#37464a", accent: "#c4a178" }
];

export function VenuePassport({ venue, variant = "heritage", className }: VenuePassportProps) {
  const palette = paletteFor(venue.slug);
  const isHeritage = variant === "heritage";
  const background = isHeritage ? palette.heritageBackground : palette.paper;
  const ink = isHeritage ? palette.heritageInk : palette.paperInk;
  const style = {
    "--passport-background": background,
    "--passport-ink": ink,
    "--passport-accent": palette.accent
  } as CSSProperties;

  return (
    <div
      aria-label={`${venue.name} EverAft illustrated venue profile. This is not venue photography.`}
      className={cn(
        "relative isolate aspect-[4/3] min-w-0 overflow-hidden rounded-[1.35rem] bg-[var(--passport-background)] text-[var(--passport-ink)]",
        className
      )}
      role="img"
      style={style}
    >
      {isHeritage ? <HeritagePassport venue={venue} /> : <CartographicPassport venue={venue} />}
    </div>
  );
}

function HeritagePassport({ venue }: { venue: VenuePassportVenue }) {
  return (
    <>
      <ContourLines className="absolute inset-0 size-full opacity-[0.16]" />
      <div className="absolute -right-[18%] -top-[38%] aspect-square w-[68%] rounded-full border border-[var(--passport-ink)] opacity-[0.12]" />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[47%] font-display text-[clamp(7rem,26vw,12rem)] font-medium leading-none opacity-[0.075]"
      >
        {venueMonogram(venue.name)}
      </span>

      <div className="relative z-10 flex h-full min-w-0 flex-col px-[7%] py-[6.5%]">
        <div className="flex min-w-0 items-start justify-between gap-3 text-[clamp(0.58rem,1.2vw,0.72rem)] font-semibold uppercase tracking-[0.14em]">
          <span className="min-w-0">EverAft · Venue Passport</span>
          <span className="shrink-0 rounded-full border border-current px-2.5 py-1 opacity-[0.85]">{venue.type}</span>
        </div>

        <VenueTypeIllustration className="mx-auto mt-[2%] min-h-0 w-[74%] flex-1 opacity-80" type={venue.type} />

        <div className="flex min-w-0 items-end justify-between gap-3">
          <p className="min-w-0 font-display text-[clamp(1rem,3vw,1.55rem)] font-semibold leading-[0.94] tracking-[-0.015em]">
            {venue.town}
            <span className="mt-1 block text-[0.72em] font-medium opacity-[0.78]">{venue.region}</span>
          </p>
          <p className="max-w-[42%] text-right text-[clamp(0.48rem,1vw,0.62rem)] font-semibold uppercase leading-[1.35] tracking-[0.12em] opacity-70">
            Illustrated venue profile
          </p>
        </div>
      </div>
    </>
  );
}

function CartographicPassport({ venue }: { venue: VenuePassportVenue }) {
  return (
    <>
      <ContourLines className="absolute -right-[15%] -top-[8%] h-[115%] w-[82%] opacity-[0.28]" />
      <div className="absolute inset-y-0 left-0 w-[1.1%] bg-[var(--passport-accent)]" />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[18%] right-[1%] font-display text-[clamp(8rem,30vw,14rem)] font-medium leading-none opacity-[0.07]"
      >
        {venueMonogram(venue.name)}
      </span>

      <div className="relative z-10 flex h-full min-w-0 flex-col px-[8%] py-[7%]">
        <div className="flex items-start justify-between gap-4 text-[clamp(0.55rem,1.1vw,0.7rem)] font-semibold uppercase tracking-[0.15em]">
          <span>EverAft field guide</span>
          <span className="border-b border-[var(--passport-accent)] pb-1">Scotland</span>
        </div>

        <div className="my-auto max-w-[78%]">
          <p className="mb-2 text-[clamp(0.54rem,1.1vw,0.68rem)] font-semibold uppercase tracking-[0.16em] text-[var(--passport-accent)]">
            {venue.type} · {venue.region}
          </p>
          <p className="font-display text-[clamp(2.2rem,7.5vw,4.8rem)] font-medium leading-[0.82] tracking-[-0.05em]">
            {venue.town}
          </p>
        </div>

        <div className="flex items-end justify-between gap-3 border-t border-current pt-[4%] text-[clamp(0.5rem,1vw,0.62rem)] font-semibold uppercase tracking-[0.12em]">
          <span>{venueMonogram(venue.name)} · {shortReference(venue.id)}</span>
          <span className="max-w-[48%] text-right opacity-[0.68]">Editorial location profile</span>
        </div>
      </div>
    </>
  );
}

function VenueTypeIllustration({ type, className }: { type: string; className?: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.25,
    vectorEffect: "non-scaling-stroke" as const
  };

  if (type === "Barn") {
    return (
      <svg aria-hidden="true" className={className} viewBox="0 0 300 165">
        <path {...common} d="M28 146h244M60 146V76l90-53 90 53v70M60 77h180M111 146V91h78v55M126 146v-38h48v38M150 108v38" />
        <path {...common} d="M60 95 150 42l90 53M81 146v-31h22v31M197 146v-31h22v31M40 146c5-18 15-31 30-39M260 146c-5-18-15-31-30-39" opacity=".72" />
        <path {...common} d="M22 35c36-21 81-30 128-30s92 9 128 30" opacity=".55" />
      </svg>
    );
  }

  if (type === "Luxury Hotel") {
    return (
      <svg aria-hidden="true" className={className} viewBox="0 0 300 165">
        <path {...common} d="M28 146h244M52 146V69h196v77M79 69V45h142v24M104 45V28h92v17M142 146v-32c0-11 16-11 16 0v32" />
        <path {...common} d="M40 69h220M69 92h21v23H69zM106 92h21v23h-21zM173 92h21v23h-21zM210 92h21v23h-21zM119 45V28M181 45V28" />
        <path {...common} d="M18 146c7-20 20-34 39-41M282 146c-7-20-20-34-39-41M24 31c35-18 77-26 126-26s91 8 126 26" opacity=".58" />
      </svg>
    );
  }

  if (type === "Country Estate") {
    return (
      <svg aria-hidden="true" className={className} viewBox="0 0 300 165">
        <path {...common} d="M26 146h248M53 146V91h44v55M203 146V91h44v55M91 146V65h118v81M105 65l45-37 45 37M139 146v-30c0-12 22-12 22 0v30" />
        <path {...common} d="M82 91h26M192 91h26M112 84h18v22h-18zM170 84h18v22h-18zM69 108h16v20H69zM215 108h16v20h-16z" />
        <path {...common} d="M16 146c7-22 20-36 39-43M284 146c-7-22-20-36-39-43M24 32c35-18 77-27 126-27s91 9 126 27" opacity=".58" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 300 165">
      <path {...common} d="M35 146h230M52 146V94h38v52M210 146V94h38v52M90 146V73h120v73M113 73V52h74v21M132 52V31h36v21" />
      <path {...common} d="M48 94h46M206 94h46M108 73h84M127 52h46M141 146v-27c0-12 18-12 18 0v27M110 92h17v24h-17zM173 92h17v24h-17z" />
      <path {...common} d="M22 146c6-19 17-30 31-33M278 146c-6-19-17-30-31-33M18 146c4-10 10-16 18-19M282 146c-4-10-10-16-18-19M22 30c29-18 67-25 128-25s99 7 128 25" opacity=".58" />
    </svg>
  );
}

function ContourLines({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} preserveAspectRatio="none" viewBox="0 0 500 360">
      <g fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M-30 322C75 207 135 386 246 270S424 124 547 176" />
        <path d="M-48 292C67 181 139 350 244 244S420 93 552 151" />
        <path d="M-61 260C70 155 139 316 240 216S417 62 562 124" />
        <path d="M-70 229C58 127 137 283 235 189S415 31 568 96" />
        <path d="M-74 195C54 99 134 248 230 158S411 5 576 65" />
        <path d="M-80 161C50 71 132 216 226 129S404-19 584 34" />
        <path d="M-82 128C42 46 129 181 220 99S395-40 590 6" />
      </g>
    </svg>
  );
}

function paletteFor(seed: string) {
  return passportPalettes[stableHash(seed) % passportPalettes.length];
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash;
}

function venueMonogram(name: string) {
  const words = name
    .replace(/^the\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "EA";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return `${words[0][0]}${words.at(-1)?.[0] ?? ""}`.toUpperCase();
}

function shortReference(id: string) {
  return id.replaceAll("-", "").slice(0, 5).toUpperCase();
}
