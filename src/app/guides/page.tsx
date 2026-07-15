import Link from "next/link";
import { ArrowRight, Calculator, CheckSquare2 } from "lucide-react";
import { GuideCard } from "@/components/guides/guide-card";
import { NewsletterForm } from "@/components/home/newsletter-form";
import { ButtonLink } from "@/components/ui/button";
import { buildBreadcrumbSchema, buildMetadata } from "@/lib/seo";
import { planningGuides } from "@/lib/planning-guides";

export const metadata = buildMetadata({
  title: "Wedding Planning Guides",
  description:
    "Practical Scottish wedding planning guides for comparing venues, understanding costs and building a realistic wedding budget.",
  path: "/guides",
  image: null,
  keywords: ["wedding planning guides", "Scottish wedding costs", "wedding venue checklist", "wedding budget guide"]
});

const categories = ["Costs", "Choosing a venue", "Venue practicalities"] as const;

export default function GuidesPage() {
  const featured = planningGuides.filter((guide) => guide.featured);
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: "Home", path: "/" },
    { name: "Planning guides", path: "/guides" }
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <section className="border-b border-[var(--line)] bg-[#f3eee5]">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <nav aria-label="Breadcrumb" className="text-sm text-[var(--muted)]">
            <Link className="hover:text-[var(--foreground)]" href="/">Home</Link>
            <span aria-hidden="true" className="mx-2">/</span>
            <span>Planning guides</span>
          </nav>
          <div className="mt-10 grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <h1 className="max-w-4xl font-display text-[clamp(3.7rem,8vw,7.5rem)] font-semibold leading-[0.84] tracking-[-0.05em] text-[var(--ink)]">
                Plan the venue. See the whole cost.
              </h1>
            </div>
            <div className="max-w-xl lg:pb-2">
              <p className="text-lg leading-8 text-[#4c4a43]">
                Clear, practical guidance for the decisions that change your wedding: venue costs, packages, guest numbers and the contract you are about to sign.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <ButtonLink href="/wedding-budget-planner"><Calculator size={17} /> Open budget planner</ButtonLink>
                <ButtonLink href="/guides/wedding-venue-viewing-checklist" variant="secondary"><CheckSquare2 size={17} /> Get the checklist</ButtonLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">Start here</p>
            <h2 className="mt-3 font-display text-5xl font-semibold tracking-[-0.04em] sm:text-6xl">The decisions with the biggest impact.</h2>
          </div>
          <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#35513c]" href="/venues">
            Compare Scottish venues <ArrowRight size={16} />
          </Link>
        </div>
        <div className="mt-9 grid gap-5 lg:grid-cols-3">
          {featured.map((guide) => <GuideCard guide={guide} key={guide.slug} prominent />)}
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          {categories.map((category, categoryIndex) => {
            const guides = planningGuides.filter((guide) => guide.category === category);
            return (
              <section className={categoryIndex === 0 ? "" : "mt-16 border-t border-[var(--line)] pt-14"} key={category}>
                <div className="grid gap-8 lg:grid-cols-[0.35fr_1fr]">
                  <div>
                    <h2 className="font-display text-4xl font-semibold tracking-[-0.035em]">{category}</h2>
                    <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                      {category === "Costs"
                        ? "Build a total you understand before the deposits begin."
                        : category === "Choosing a venue"
                          ? "Turn beautiful viewings and very different brochures into a confident shortlist."
                          : "Check the capacity, contract and logistics that make the day work."}
                    </p>
                  </div>
                  <div className="grid gap-5 md:grid-cols-2">
                    {guides.map((guide) => <GuideCard guide={guide} key={guide.slug} />)}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <section className="bg-[#f2ede4]">
        <div className="mx-auto grid max-w-7xl gap-9 px-4 py-14 sm:px-6 lg:grid-cols-[0.68fr_1.32fr] lg:px-8 lg:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">EverAft notes</p>
            <h2 className="mt-3 font-display text-5xl font-semibold leading-[0.95] tracking-[-0.04em]">Useful planning, occasionally.</h2>
          </div>
          <div className="lg:pl-8">
            <p className="max-w-xl text-base leading-7 text-[var(--muted)]">
              New venue guides, clearer cost advice and thoughtful Scottish venue finds. No daily countdowns and no wedding spam.
            </p>
            <NewsletterForm />
          </div>
        </div>
      </section>
    </>
  );
}
