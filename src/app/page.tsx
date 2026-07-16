import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Check, Heart, MapPinned, Search, ShieldCheck, Sparkles } from "lucide-react";
import { FeaturedVenues } from "@/components/home/featured-venues";
import { NewsletterForm } from "@/components/home/newsletter-form";
import { SearchBar } from "@/components/search/search-bar";
import { ButtonLink } from "@/components/ui/button";
import { buildMetadata } from "@/lib/seo";
import { absoluteUrl } from "@/lib/utils";
import { planningGuides } from "@/lib/planning-guides";

export const metadata = buildMetadata({
  title: "Find Scottish Wedding Venues",
  description:
    "Search Scottish wedding venues including castles, barns, country estates and luxury hotels with clear pricing and guest capacity.",
  path: "/",
  image: absoluteUrl("/images/everaft-wedding-reception.png"),
  keywords: ["Scottish wedding venues", "Scotland wedding venues", "wedding venues Scotland"]
});

type CategoryCard = {
  name: string;
  detail: string;
  href?: string;
  image: string;
};

const categoryCards: CategoryCard[] = [
  {
    name: "Venues",
    detail: "Live now",
    href: "/venues",
    image: "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=1100&q=82"
  },
  {
    name: "Photography",
    detail: "Explore photographers",
    href: "/photographers",
    image: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1100&q=82"
  },
  {
    name: "Florists",
    detail: "Joining the directory",
    image: "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=1100&q=82"
  },
  {
    name: "Music",
    detail: "Joining the directory",
    image: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=1100&q=82"
  }
];

const steps = [
  ["Discover", "Browse businesses that suit your setting, style and priorities."],
  ["Shortlist", "Save the names you want to come back to, without losing the thread."],
  ["Enquire", "Share the details that matter, then start a direct conversation."]
] as const;

const faqs = [
  [
    "How does EverAft choose suppliers?",
    "Businesses submit their details for review before we publish a new listing. We prioritise clear information, a real point of contact and a useful experience for couples."
  ],
  [
    "Is it free for couples?",
    "Yes. Creating an EverAft account, saving venues and sending an enquiry are free for couples."
  ],
  [
    "Can I list my wedding business?",
    "Yes. Send an application with your business details, service area and portfolio links. We will review it before adding it to the directory."
  ],
  [
    "Where in the UK do you cover?",
    "EverAft is launching with a carefully reviewed Scottish venue collection and is opening the directory to wedding businesses across the UK."
  ]
] as const;

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "EverAft",
        url: absoluteUrl(),
        description: "A growing wedding directory for couples planning celebrations across the UK."
      },
      {
        "@type": "WebSite",
        name: "EverAft",
        url: absoluteUrl(),
        potentialAction: {
          "@type": "SearchAction",
          target: `${absoluteUrl("/venues")}?location={search_term_string}`,
          "query-input": "required name=search_term_string"
        }
      }
    ]
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="relative isolate overflow-hidden border-b border-[var(--line)] bg-[var(--background)]">
        <div className="hero-image-mask pointer-events-none absolute inset-y-0 right-0 hidden w-[61%] lg:block">
          <Image
            alt="Wedding breakfast in a light-filled country house"
            className="object-cover object-center"
            fill
            priority
            sizes="61vw"
            src="/images/everaft-wedding-reception.png"
          />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-14 sm:px-6 sm:pt-20 lg:px-8 lg:pb-12 lg:pt-24">
          <div className="max-w-3xl lg:max-w-[57%]">
            <h1 className="font-display text-[clamp(3.9rem,8.1vw,7.8rem)] font-semibold leading-[0.84] tracking-[-0.052em] text-[var(--ink)]">
              Find the people who make it unforgettable.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#4c4a43] sm:text-xl">
              Discover thoughtful wedding venues and photographers, with more trusted supplier categories opening alongside them.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/venues">
                Explore venues <ArrowRight size={17} />
              </ButtonLink>
              <ButtonLink href="/for-business" variant="secondary">
                List your business
              </ButtonLink>
            </div>
          </div>
          <div className="mt-12 lg:mt-16">
            <SearchBar />
          </div>
        </div>
      </section>

      <section aria-labelledby="supplier-categories" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.16em] text-[#95502b]">Explore by need</p>
            <h2 className="mt-3 font-display text-5xl font-semibold tracking-[-0.04em] sm:text-6xl" id="supplier-categories">
              The good ones, in one place.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-[var(--muted)]">Venues and photographers are open now, with more wedding categories following through 2026.</p>
        </div>
        <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categoryCards.map((category) => {
            const card = (
              <div className="group relative aspect-[1.1/1] overflow-hidden rounded-[1.45rem] bg-[#eae4d9]">
                <Image alt="" className="object-cover transition duration-700 group-hover:scale-105" fill sizes="(min-width: 1024px) 25vw, 50vw" src={category.image} />
                <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(10,18,12,0.76),transparent)] px-5 pb-5 pt-16 text-white">
                  <p className="font-display text-3xl font-semibold tracking-[-0.03em]">{category.name}</p>
                  <p className="mt-1 text-sm text-white/78">{category.detail}</p>
                </div>
              </div>
            );
            return category.href ? <Link aria-label={`Explore ${category.name}`} className="focus-ring rounded-[1.45rem]" href={category.href} key={category.name}>{card}</Link> : <div key={category.name}>{card}</div>;
          })}
        </div>
      </section>

      <FeaturedVenues />

      <section className="border-y border-[var(--line)] bg-[#f7f2ea]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="font-display text-4xl font-semibold">Plan by location and style</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            Start with popular Scotland wedding searches and quickly jump into venue lists tailored to your day.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/wedding-venues/edinburgh" variant="secondary">Wedding venues in Edinburgh</ButtonLink>
            <ButtonLink href="/wedding-venues/glasgow" variant="secondary">Wedding venues in Glasgow</ButtonLink>
            <ButtonLink href="/wedding-venues/stirling" variant="secondary">Wedding venues in Stirling</ButtonLink>
            <ButtonLink href="/wedding-venues/perthshire" variant="secondary">Wedding venues in Perthshire</ButtonLink>
            <ButtonLink href="/wedding-venues/ayrshire" variant="secondary">Wedding venues in Ayrshire</ButtonLink>
            <ButtonLink href="/wedding-venues/castles" variant="secondary">Scottish castle wedding venues</ButtonLink>
            <ButtonLink href="/wedding-venues/country-estates" variant="secondary">Country estate venues</ButtonLink>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-8 lg:grid-cols-[0.55fr_1.45fr] lg:gap-14">
          <div>
            <p className="text-sm font-semibold tracking-[0.16em] text-[#95502b]">Planning guides</p>
            <h2 className="mt-3 font-display text-5xl font-semibold leading-[0.95] tracking-[-0.04em] sm:text-6xl">Useful before you book.</h2>
            <p className="mt-5 max-w-sm text-base leading-7 text-[var(--muted)]">Understand the venue, the package and the true cost before the deposit leaves your account.</p>
            <ButtonLink className="mt-7" href="/guides" variant="secondary">Explore all guides <ArrowRight size={17} /></ButtonLink>
          </div>
          <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {planningGuides.filter((guide) => guide.featured).map((guide, index) => (
              <Link className="focus-ring group grid gap-2 py-6 sm:grid-cols-[2rem_1fr_auto] sm:items-center sm:gap-5" href={`/guides/${guide.slug}`} key={guide.slug}>
                <span className="text-xs font-semibold text-[#a08a72]">0{index + 1}</span>
                <div>
                  <h3 className="font-display text-3xl font-semibold tracking-[-0.03em]">{guide.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{guide.description}</p>
                </div>
                <ArrowRight className="hidden transition group-hover:translate-x-1 sm:block" size={18} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-[#f2ede4]" id="how-it-works">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.85fr_1.75fr] lg:gap-16 lg:px-8 lg:py-24">
          <div>
            <p className="text-sm font-semibold tracking-[0.16em] text-[#95502b]">How it works</p>
            <h2 className="mt-3 font-display text-5xl font-semibold leading-[0.95] tracking-[-0.04em] sm:text-6xl">A calmer way to plan.</h2>
            <p className="mt-5 max-w-sm text-base leading-7 text-[var(--muted)]">Thoughtful tools and useful information, so you can focus on what matters most.</p>
          </div>
          <ol className="grid gap-7 md:grid-cols-3 md:gap-8">
            {steps.map(([title, copy], index) => (
              <li className="border-t border-[#cfc3b4] pt-5" key={title}>
                <span className="grid size-10 place-items-center rounded-full border border-[#b86e45] text-sm text-[#8b4825]">{index + 1}</span>
                <h3 className="mt-6 font-display text-3xl font-semibold tracking-[-0.03em]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid overflow-hidden bg-[var(--brand)] text-white lg:grid-cols-[1.15fr_0.85fr]">
          <div className="px-6 py-12 sm:px-10 lg:px-14 lg:py-16">
            <p className="text-sm font-semibold tracking-[0.16em] text-[#d19a72]">For wedding businesses</p>
            <h2 className="mt-4 max-w-xl font-display text-5xl font-semibold leading-[0.92] tracking-[-0.045em] sm:text-6xl">Meet the couples who are looking for you.</h2>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/78">A considered, affordable place for brilliant wedding businesses to be discovered, trusted and contacted.</p>
            <ButtonLink className="mt-8 bg-[#ad5d32] text-white hover:bg-[#914920]" href="/for-business">Create your listing <ArrowRight size={17} /></ButtonLink>
            <div className="mt-12 grid gap-6 border-t border-white/20 pt-7 sm:grid-cols-3">
              <Benefit icon={<Heart size={18} />} text="A listing that feels like your brand" />
              <Benefit icon={<Search size={18} />} text="Quality enquiries, not noise" />
              <Benefit icon={<Sparkles size={18} />} text="Clear, human support" />
            </div>
          </div>
          <div className="relative min-h-80 bg-[#d7c8b7]">
            <Image alt="Florist creating a wedding arrangement" className="object-cover" fill sizes="(min-width: 1024px) 40vw, 100vw" src="https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=1400&q=84" />
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
          <TrustItem icon={<ShieldCheck size={20} />} title="Reviewed business profiles" copy="We collect the details couples need before a new listing goes live." />
          <TrustItem icon={<MapPinned size={20} />} title="Built for UK weddings" copy="Search experience and supplier onboarding designed around local planning." />
          <TrustItem icon={<Check size={20} />} title="Direct, useful enquiries" copy="Clear contact paths without forcing couples through an unfamiliar process." />
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:py-24" id="faq">
        <h2 className="text-center font-display text-5xl font-semibold tracking-[-0.04em] sm:text-6xl">Questions, answered.</h2>
        <div className="mt-10 divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {faqs.map(([question, answer]) => (
            <details className="group py-1" key={question}>
              <summary className="focus-ring flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-3 text-left text-base font-semibold text-[#25221e] [&::-webkit-details-marker]:hidden">
                {question}
                <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full border border-[var(--line)] text-xl font-normal transition group-open:rotate-45">+</span>
              </summary>
              <p className="max-w-2xl pb-6 pr-12 text-sm leading-7 text-[var(--muted)]">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="border-t border-[var(--line)] bg-[#f2ede4]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.68fr_1.32fr] lg:px-8 lg:py-20">
          <div className="relative min-h-56 overflow-hidden rounded-[1.4rem] bg-[#dcd0c0]">
            <Image alt="Wedding stationery on linen" className="object-cover" fill sizes="(min-width: 1024px) 35vw, 100vw" src="https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1000&q=84" />
          </div>
          <div className="lg:self-center lg:pl-8">
            <p className="text-sm font-semibold tracking-[0.16em] text-[#95502b]">EverAft notes</p>
            <h2 className="mt-3 font-display text-5xl font-semibold leading-[0.95] tracking-[-0.04em] sm:text-6xl">A little inspiration, when you want it.</h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-[var(--muted)]">Monthly ideas, thoughtful supplier finds and planning advice — no wedding spam.</p>
            <NewsletterForm />
          </div>
        </div>
      </section>
    </>
  );
}

function Benefit({ icon, text }: { icon: ReactNode; text: string }) {
  return <p className="flex gap-3 text-sm leading-6 text-white/88"><span className="mt-0.5 text-[#e4a77a]">{icon}</span>{text}</p>;
}

function TrustItem({ copy, icon, title }: { copy: string; icon: ReactNode; title: string }) {
  return (
    <div className="flex gap-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f2ede4] text-[#95502b]">{icon}</span>
      <div>
        <h3 className="font-display text-2xl font-semibold tracking-[-0.025em]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{copy}</p>
      </div>
    </div>
  );
}
