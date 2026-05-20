import Image from "next/image";
import { ArrowRight, Building2, ShieldCheck, Sparkles } from "lucide-react";
import { FeaturedVenues } from "@/components/home/featured-venues";
import { SearchBar } from "@/components/search/search-bar";
import { ButtonLink } from "@/components/ui/button";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Find Scottish Wedding Venues",
  description:
    "Search Scottish wedding venues including castles, barns, country estates and luxury hotels with clear pricing and guest capacity.",
  path: "/",
  keywords: ["Scottish wedding venues", "Scotland wedding venues", "wedding venues Scotland"]
});

export default function Home() {
  return (
    <>
      <section className="relative min-h-[82svh] overflow-hidden bg-[#171915] text-white">
        <Image
          alt="Elegant Scottish wedding venue dining room"
          className="object-cover opacity-70"
          fill
          priority
          sizes="100vw"
          src="https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=2200&q=84"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,17,13,0.78),rgba(15,17,13,0.38),rgba(15,17,13,0.16))]" />
        <div className="relative mx-auto flex min-h-[82svh] max-w-7xl flex-col justify-end px-4 pb-8 pt-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl pb-8">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm backdrop-blur">
              <Sparkles size={15} />
              Scotland&apos;s most beautiful wedding venues, curated.
            </div>
            <h1 className="font-display text-6xl font-semibold leading-[0.92] sm:text-7xl lg:text-8xl">
              Find the place your story gathers.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/82">
              Search castles, barns, luxury hotels, and country estates with clear pricing, capacity,
              style, and enquiry paths built for modern couples.
            </p>
            <div className="mt-7">
              <ButtonLink href="/venues" variant="secondary">
                Browse venues <ArrowRight size={17} />
              </ButtonLink>
            </div>
          </div>
          <SearchBar />
        </div>
      </section>
      <FeaturedVenues />
      <section className="bg-[#f7f2ea]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="font-display text-4xl font-semibold">Plan by location and style</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            Start with popular Scotland wedding searches and quickly jump into venue lists tailored to your day.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/venues?location=Edinburgh" variant="secondary">Wedding venues in Edinburgh</ButtonLink>
            <ButtonLink href="/venues?location=Glasgow" variant="secondary">Wedding venues in Glasgow</ButtonLink>
            <ButtonLink href="/venues?type=Castle" variant="secondary">Scottish castle wedding venues</ButtonLink>
            <ButtonLink href="/venues?type=Country Estate" variant="secondary">Country estate venues</ButtonLink>
          </div>
        </div>
      </section>
      <section className="bg-[#334235] text-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/70">For venues</p>
            <h2 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Own or manage a Scottish wedding venue?</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78">
              Claim your listing to verify details, add approved imagery, and keep enquiry paths accurate during launch.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/venues" variant="secondary">
              <Building2 size={17} /> Find your listing
            </ButtonLink>
            <ButtonLink href="/vendor" className="bg-white/12 text-white ring-1 ring-white/25 hover:bg-white/18">
              <ShieldCheck size={17} /> Vendor dashboard
            </ButtonLink>
          </div>
        </div>
      </section>
      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
          {[
            ["Curated discovery", "Search by real wedding constraints, not generic directory tags."],
            ["Transparent signals", "Compare price ranges, capacity, venue type, and amenities quickly."],
            ["Planning-ready", "Favourites and enquiries create the base for a fuller planning ecosystem."]
          ].map(([title, copy]) => (
            <div className="border-t border-[var(--line)] pt-6" key={title}>
              <h3 className="font-display text-3xl font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{copy}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
