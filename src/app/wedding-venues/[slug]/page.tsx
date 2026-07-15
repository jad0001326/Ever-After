import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Calculator, CheckCircle2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { VenueCard } from "@/components/venue/venue-card";
import { buildVenueHref } from "@/lib/search";
import { buildBreadcrumbSchema, buildMetadata } from "@/lib/seo";
import { getVenueCollection, venueCollections } from "@/lib/venue-collections";
import { searchVenueListings } from "@/lib/venues";
import { absoluteUrl } from "@/lib/utils";

type PageProps = { params: Promise<{ slug: string }> };

export const revalidate = 3600;

export function generateStaticParams() {
  return venueCollections.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const collection = getVenueCollection(slug);
  if (!collection) return {};

  return buildMetadata({
    title: collection.title,
    description: collection.description,
    path: `/wedding-venues/${collection.slug}`,
    image: null,
    keywords: [collection.title, `${collection.title} prices`, "Scottish wedding venues"]
  });
}

export default async function WeddingVenueCollectionPage({ params }: PageProps) {
  const { slug } = await params;
  const collection = getVenueCollection(slug);
  if (!collection) notFound();

  const results = await searchVenueListings(collection.searchParams);
  const related = collection.relatedSlugs.map(getVenueCollection).filter((item) => item != null);
  const path = `/wedding-venues/${collection.slug}`;
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Wedding venues", path: "/venues" },
        { name: collection.title, path }
      ]),
      {
        "@type": "ItemList",
        name: collection.title,
        numberOfItems: results.total,
        itemListElement: results.venues.map((venue, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: venue.name,
          url: absoluteUrl(`/venues/${venue.slug}`)
        }))
      },
      {
        "@type": "FAQPage",
        mainEntity: collection.faqs.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer }
        }))
      }
    ]
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <section className="border-b border-[var(--line)] bg-[#f7f2ea]">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <nav aria-label="Breadcrumb" className="text-sm text-[var(--muted)]">
            <Link className="hover:text-[var(--foreground)]" href="/venues">Wedding venues</Link>
            <span aria-hidden="true" className="mx-2">/</span>
            <span>{collection.title}</span>
          </nav>
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-[#95502b]">{collection.eyebrow}</p>
          <h1 className="mt-4 max-w-4xl font-display text-5xl font-semibold leading-[0.95] tracking-[-0.04em] sm:text-7xl">{collection.title}</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#4c4a43]">{collection.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="#venues">See {results.total} {results.total === 1 ? "venue" : "venues"} <ArrowRight size={17} /></ButtonLink>
            <ButtonLink href="/wedding-budget-planner" variant="secondary"><Calculator size={17} /> Build your wedding budget</ButtonLink>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-4 py-12 text-base leading-8 text-[var(--muted)] sm:px-6 md:grid-cols-2 lg:px-8">
        {collection.intro.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </section>

      <section className="border-y border-[var(--line)] bg-white">
        <div className="mx-auto grid max-w-5xl gap-7 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
          {collection.highlights.map((highlight) => (
            <article className="flex gap-3" key={highlight.title}>
              <CheckCircle2 className="mt-1 shrink-0 text-[#9d7b45]" size={19} />
              <div><h2 className="font-semibold">{highlight.title}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{highlight.copy}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8" id="venues">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">Compare venues</p><h2 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">Start your shortlist</h2></div>
          <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#5c6b52]" href={buildVenueHref(collection.searchParams)}>{collection.browseLabel} <ArrowRight size={16} /></Link>
        </div>
        {results.error ? <p className="mt-8 rounded-2xl bg-[#fff4ed] px-4 py-3 text-sm text-[#8a3c19]">Venue results are temporarily unavailable.</p> : results.venues.length ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{results.venues.map((venue, index) => <VenueCard key={venue.id} priority={index === 0} venue={venue} />)}</div>
        ) : <p className="mt-8 rounded-3xl border border-[var(--line)] bg-white p-8 text-[var(--muted)]">We are adding more matching venues. Browse the full directory while this collection grows.</p>}
      </section>

      <section className="border-y border-[var(--line)] bg-[#f2ede4]">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="font-display text-4xl font-semibold sm:text-5xl">Questions to help you compare</h2>
          <div className="mt-8 divide-y divide-[#cfc3b4] border-y border-[#cfc3b4]">
            {collection.faqs.map(({ question, answer }) => <details className="group py-5" key={question}><summary className="focus-ring cursor-pointer list-none font-semibold [&::-webkit-details-marker]:hidden">{question}</summary><p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">{answer}</p></details>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] bg-[var(--brand)] px-6 py-10 text-white sm:px-10"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d19a72]">Make the shortlist practical</p><h2 className="mt-3 max-w-2xl font-display text-4xl font-semibold">See how your venue fits the whole wedding budget.</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-white/75">Add a venue, enter your guest count and track estimates, confirmed costs, deposits and what is still left to pay.</p><ButtonLink className="mt-6 bg-[#ad5d32] text-white hover:bg-[#914920]" href="/wedding-budget-planner">Try the free budget planner <ArrowRight size={17} /></ButtonLink></div>
        <div className="mt-10"><h2 className="font-display text-3xl font-semibold">Explore related venue guides</h2><div className="mt-5 flex flex-wrap gap-3">{related.map((item) => <Link className="focus-ring rounded-full bg-white px-4 py-3 text-sm font-semibold ring-1 ring-[var(--line)] hover:bg-[#f7f1e8]" href={`/wedding-venues/${item.slug}`} key={item.slug}>{item.title}</Link>)}</div></div>
      </section>
    </main>
  );
}
