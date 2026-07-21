import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, Calculator, Check, ExternalLink } from "lucide-react";
import { GuideCard } from "@/components/guides/guide-card";
import { NewsletterForm } from "@/components/home/newsletter-form";
import { ButtonLink } from "@/components/ui/button";
import { buildBreadcrumbSchema, buildMetadata } from "@/lib/seo";
import { getPlanningGuide, getRelatedGuides, planningGuides } from "@/lib/planning-guides";
import { absoluteUrl } from "@/lib/utils";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return planningGuides.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getPlanningGuide(slug);
  if (!guide) return {};

  const metadata = buildMetadata({
    title: guide.title,
    description: guide.description,
    path: `/guides/${guide.slug}`,
    image: null,
    keywords: [
      guide.title,
      guide.shortTitle,
      "Scottish wedding planning",
      guide.category === "Photography" ? "Scottish wedding photographers" : "Scottish wedding planning advice"
    ]
  });

  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      type: "article",
      publishedTime: guide.publishedAt,
      modifiedTime: guide.updatedAt
    }
  };
}

export default async function GuidePage({ params }: PageProps) {
  const { slug } = await params;
  const guide = getPlanningGuide(slug);
  if (!guide) notFound();

  const path = `/guides/${guide.slug}`;
  const guideAction =
    guide.category === "Photography"
      ? { href: "/photographers", label: "Browse photographers" }
      : guide.category === "Planning"
        ? { href: "/wedding-table-planner", label: "Open table planner" }
        : { href: "/venues", label: "Browse venues" };
  const related = getRelatedGuides(guide);
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Planning guides", path: "/guides" },
        { name: guide.title, path }
      ]),
      {
        "@type": "Article",
        headline: guide.title,
        description: guide.description,
        datePublished: guide.publishedAt,
        dateModified: guide.updatedAt,
        mainEntityOfPage: absoluteUrl(path),
        author: { "@type": "Organization", name: "EverAft", url: absoluteUrl() },
        publisher: { "@type": "Organization", name: "EverAft", url: absoluteUrl() }
      },
      {
        "@type": "FAQPage",
        mainEntity: guide.faqs.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer }
        }))
      }
    ]
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <header className="border-b border-[var(--line)] bg-[#f3eee5]">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-18 lg:px-8 lg:py-20">
          <nav aria-label="Breadcrumb" className="text-sm text-[var(--muted)]">
            <Link className="hover:text-[var(--foreground)]" href="/guides">Planning guides</Link>
            <span aria-hidden="true" className="mx-2">/</span>
            <span>{guide.category}</span>
          </nav>
          <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#95502b]">
            <span>{guide.category}</span>
            <span aria-hidden="true" className="size-1 rounded-full bg-[#c2ab92]" />
            <span className="normal-case tracking-normal text-[var(--muted)]">{guide.readMinutes} minute read</span>
            <span aria-hidden="true" className="size-1 rounded-full bg-[#c2ab92]" />
            <time className="normal-case tracking-normal text-[var(--muted)]" dateTime={guide.updatedAt}>
              Updated {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${guide.updatedAt}T00:00:00Z`))}
            </time>
          </div>
          <h1 className="mt-6 max-w-4xl font-display text-[clamp(3.5rem,8vw,6.8rem)] font-semibold leading-[0.88] tracking-[-0.05em] text-[var(--ink)]">
            {guide.title}
          </h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-[#4c4a43] sm:text-xl">{guide.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/wedding-budget-planner"><Calculator size={17} /> Open budget planner</ButtonLink>
            <ButtonLink href={guideAction.href} variant="secondary"><ArrowRight size={17} /> {guideAction.label}</ButtonLink>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:px-8 lg:py-16">
        <div className="min-w-0">
          <div className="space-y-5 text-[1.05rem] leading-8 text-[#3f3c36]">
            {guide.intro.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>

          {guide.answer ? (
            <aside className="mt-10 border-l-4 border-[#ad5d32] bg-[#f7f2ea] px-6 py-6 sm:px-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#95502b]">The short answer</p>
              <p className="mt-3 text-base font-medium leading-8 text-[var(--ink)]">{guide.answer}</p>
            </aside>
          ) : null}

          <div className="mt-12 space-y-14">
            {guide.sections.map((section, index) => (
              <section key={section.heading}>
                <h2 className="font-display text-4xl font-semibold leading-[1] tracking-[-0.035em] text-[var(--ink)] sm:text-5xl">{section.heading}</h2>
                {section.paragraphs ? (
                  <div className="mt-6 space-y-5 text-base leading-8 text-[#4c4a43]">
                    {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  </div>
                ) : null}
                {section.bullets ? (
                  <ul className="mt-6 grid gap-3">
                    {section.bullets.map((bullet) => (
                      <li className="flex gap-3 text-base leading-7 text-[#4c4a43]" key={bullet}>
                        <Check aria-hidden="true" className="mt-1.5 shrink-0 text-[#9d7b45]" size={17} />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {section.table ? (
                  <div className="mt-7 overflow-x-auto rounded-[1.25rem] border border-[var(--line)] bg-white">
                    <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
                      <thead className="bg-[#eee7dc] text-[var(--ink)]">
                        <tr>{section.table.headers.map((header) => <th className="px-5 py-4 font-semibold" key={header}>{header}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--line)]">
                        {section.table.rows.map((row) => (
                          <tr className="align-top" key={row.join("-")}>
                            {row.map((cell, cellIndex) => (
                              <td className={cellIndex === 0 ? "px-5 py-4 font-semibold text-[var(--ink)]" : "px-5 py-4 leading-6 text-[var(--muted)]"} key={`${cell}-${cellIndex}`}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {index === 1 ? <InlinePlannerCta action={guideAction} category={guide.category} /> : null}
              </section>
            ))}
          </div>

          <section className="mt-16 border-y border-[var(--line)] py-10">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">Your next step</p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.035em]">Put the guide to work.</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {guide.venueLinks.map((venueLink) => (
                <Link className="focus-ring group flex items-center justify-between gap-4 rounded-2xl bg-white px-5 py-4 text-sm font-semibold ring-1 ring-[var(--line)] transition hover:bg-[#f7f1e8]" href={venueLink.href} key={venueLink.href}>
                  {venueLink.label}<ArrowUpRight aria-hidden="true" className="shrink-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" size={16} />
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-14">
            <h2 className="font-display text-4xl font-semibold tracking-[-0.035em]">Questions, answered</h2>
            <div className="mt-7 divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {guide.faqs.map(({ question, answer }) => (
                <details className="group py-5" key={question}>
                  <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-5 font-semibold [&::-webkit-details-marker]:hidden">
                    {question}<span aria-hidden="true" className="text-xl font-normal transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 max-w-3xl pr-10 text-sm leading-7 text-[var(--muted)]">{answer}</p>
                </details>
              ))}
            </div>
          </section>

          {guide.sources?.length ? (
            <section className="mt-12 rounded-2xl bg-[#f3eee5] px-6 py-6">
              <h2 className="text-sm font-semibold text-[var(--ink)]">Sources and further reading</h2>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-[var(--muted)]">
                {guide.sources.map((source) => (
                  <li key={source.href}>
                    <a className="inline-flex items-center gap-2 underline decoration-[#bca98e] underline-offset-4 hover:text-[var(--ink)]" href={source.href} rel="noreferrer" target="_blank">
                      {source.label}<ExternalLink aria-hidden="true" size={13} />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-28 rounded-[1.5rem] border border-[var(--line)] bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#95502b]">Keep in mind</p>
            <ul className="mt-5 grid gap-4">
              {guide.takeaways.map((takeaway) => (
                <li className="flex gap-3 text-sm leading-6 text-[var(--muted)]" key={takeaway}>
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-[#ad5d32]" />{takeaway}
                </li>
              ))}
            </ul>
            <Link className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#35513c]" href={guideAction.href}>
              {guideAction.label} <ArrowRight size={15} />
            </Link>
          </div>
        </aside>
      </div>

      <section className="border-y border-[var(--line)] bg-[#f2ede4]">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.7fr_1.3fr] lg:px-8 lg:py-18">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">EverAft notes</p>
            <h2 className="mt-3 font-display text-5xl font-semibold leading-[0.95] tracking-[-0.04em]">More useful than another mood board.</h2>
          </div>
          <div className="lg:pl-8">
            <p className="max-w-xl text-base leading-7 text-[var(--muted)]">Occasional planning advice, venue finds and new tools. Confirm your email once and unsubscribe whenever you like.</p>
            <NewsletterForm />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
        <div className="flex items-end justify-between gap-5">
          <h2 className="font-display text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">Keep planning</h2>
          <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#35513c]" href="/guides">All guides <ArrowRight size={16} /></Link>
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {related.map((relatedGuide) => <GuideCard guide={relatedGuide} key={relatedGuide.slug} />)}
        </div>
      </section>
    </article>
  );
}

function InlinePlannerCta({
  action,
  category
}: {
  action: { href: string; label: string };
  category: (typeof planningGuides)[number]["category"];
}) {
  const plannerCopy =
    category === "Photography"
      ? "Add a realistic photography allowance, then replace it with the complete quote, deposit and balance when you book."
      : category === "Planning"
        ? "Turn the decisions into one working guest, table or budget plan, then replace assumptions as details are confirmed."
        : "Add the likely costs to your live plan, then replace every estimate with written quotes and confirmed dates.";

  return (
    <aside className="mt-9 rounded-[1.5rem] bg-[var(--brand)] px-6 py-7 text-white sm:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d19a72]">Make it specific to your wedding</p>
      <h3 className="mt-3 font-display text-3xl font-semibold tracking-[-0.03em]">Turn the advice into a live plan.</h3>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">{plannerCopy}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink className="bg-[#ad5d32] text-white hover:bg-[#914920]" href="/wedding-budget-planner">Open budget planner <ArrowRight size={16} /></ButtonLink>
        <Link className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 px-5 text-sm font-semibold text-white transition hover:bg-white/10" href={action.href}>
          {action.label}
        </Link>
      </div>
    </aside>
  );
}
