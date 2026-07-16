import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Calculator, Camera, Check, Clock3, ExternalLink, MapPin } from "lucide-react";
import { SupplierVisual } from "@/components/supplier/supplier-visual";
import { ButtonLink } from "@/components/ui/button";
import { buildBreadcrumbSchema, buildMetadata } from "@/lib/seo";
import { getPhotographerListingBySlug } from "@/lib/suppliers";
import { absoluteUrl, gbp } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supplier = await getPhotographerListingBySlug(slug);
  if (!supplier) return { title: "Photographer not found" };
  return buildMetadata({
    title: `${supplier.name} | Wedding Photographer`,
    description: supplier.summary,
    path: `/photographers/${supplier.slug}`,
    image: supplier.heroImageUrl,
    keywords: [`${supplier.name} wedding photographer`, `wedding photographer ${supplier.region}`, "Scottish wedding photography"]
  });
}

export default async function PhotographerDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supplier = await getPhotographerListingBySlug(slug);
  if (!supplier) notFound();

  const photographer = supplier.photographer;
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: "Home", path: "/" },
    { name: "Photographers", path: "/photographers" },
    { name: supplier.name, path: `/photographers/${supplier.slug}` }
  ]);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: supplier.name,
    description: supplier.summary,
    url: absoluteUrl(`/photographers/${supplier.slug}`),
    sameAs: [supplier.officialWebsiteUrl, supplier.instagramUrl, supplier.facebookUrl].filter(Boolean),
    areaServed: supplier.travelsNationwide ? "United Kingdom" : [supplier.region, ...supplier.serviceAreas],
    priceRange: supplier.startingPricePence == null ? undefined : `From ${gbp.format(supplier.startingPricePence / 100)}`,
    image: supplier.heroImageUrl ?? undefined
  };
  const features = [
    [photographer?.secondPhotographerAvailable, "Second photographer available"],
    [photographer?.engagementShootAvailable, "Engagement shoots"],
    [photographer?.droneAvailable, "Drone coverage available"],
    [photographer?.filmPhotographyAvailable, "Film photography available"],
    [photographer?.albumsAvailable, "Albums available"]
  ].filter(([available]) => available === true) as Array<[boolean, string]>;
  const enquiryUrl = supplier.enquiryUrl ?? supplier.officialWebsiteUrl;

  return (
    <main>
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} type="application/ld+json" />
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} type="application/ld+json" />
      <section className="border-b border-[var(--line)] bg-[#f2ede4]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-14">
          <div className="relative min-h-[24rem] overflow-hidden rounded-[1.75rem] bg-[#e9e0d2] lg:min-h-[38rem]">
            <SupplierVisual imageUrl={supplier.heroImageUrl} name={supplier.name} priority />
            {supplier.imageCredit ? <p className="absolute bottom-3 right-3 rounded-full bg-black/55 px-3 py-1 text-[10px] text-white">{supplier.imageCredit}</p> : null}
          </div>
          <div className="self-center lg:pl-6">
            <Link className="text-sm font-semibold text-[#35533e]" href="/photographers">Back to photographers</Link>
            <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-[#95502b]">Wedding photographer</p>
            <h1 className="mt-3 font-display text-6xl font-semibold leading-[0.9] tracking-[-0.045em] sm:text-7xl">{supplier.name}</h1>
            <p className="mt-6 text-lg leading-8 text-[var(--muted)]">{supplier.summary}</p>
            <p className="mt-5 flex items-center gap-2 text-sm font-medium text-[#4f4a43]"><MapPin className="text-[#9d7b45]" size={18} />Based in {supplier.baseTown}, {supplier.region}{supplier.travelsNationwide ? " · UK-wide coverage" : ""}</p>
            <div className="mt-8 flex flex-wrap gap-3">{enquiryUrl ? <ButtonLink href={enquiryUrl} rel="noopener noreferrer" target="_blank">Visit website <ExternalLink size={16} /></ButtonLink> : null}<ButtonLink href={`/wedding-budget-planner?supplier=${encodeURIComponent(supplier.id)}`} variant="secondary"><Calculator size={16} /> Add to budget</ButtonLink></div>
            <div className="mt-7 flex gap-3">{supplier.instagramUrl ? <SocialLink href={supplier.instagramUrl} label="Instagram" /> : null}{supplier.facebookUrl ? <SocialLink href={supplier.facebookUrl} label="Facebook" /> : null}</div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] lg:px-8 lg:py-20">
        <div>
          <section><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">About</p><h2 className="mt-3 font-display text-4xl font-semibold">Their approach</h2><div className="mt-5 grid gap-4 text-base leading-8 text-[var(--muted)]">{supplier.description.split(/\n+/).filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></section>
          {photographer?.styles.length ? <section className="mt-12 border-t border-[var(--line)] pt-10"><h2 className="font-display text-3xl font-semibold">Photography style</h2><div className="mt-5 flex flex-wrap gap-2">{photographer.styles.map((style) => <span className="rounded-full bg-[#f4efe7] px-4 py-2 text-sm font-medium text-[#5d5142]" key={style}>{style}</span>)}</div></section> : null}
          {supplier.services.length ? <section className="mt-12 border-t border-[var(--line)] pt-10"><h2 className="font-display text-3xl font-semibold">Services</h2><ul className="mt-5 grid gap-3 sm:grid-cols-2">{supplier.services.map((service) => <li className="flex gap-3 text-sm leading-6" key={service}><Check className="mt-0.5 shrink-0 text-[#5d7758]" size={17} />{service}</li>)}</ul></section> : null}
          {supplier.images.length > 1 ? <section className="mt-12 border-t border-[var(--line)] pt-10"><h2 className="font-display text-3xl font-semibold">Portfolio</h2><div className="mt-6 grid gap-4 sm:grid-cols-2">{supplier.images.slice(0, 6).map((image) => <figure className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-[#eee8dd]" key={image.id}><Image alt={image.alt} className="object-cover" fill sizes="(min-width: 640px) 40vw, 100vw" src={image.url} />{image.creditText ? <figcaption className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-1 text-[10px] text-white">{image.creditText}</figcaption> : null}</figure>)}</div></section> : null}
          {supplier.venues.length ? <section className="mt-12 border-t border-[var(--line)] pt-10"><h2 className="font-display text-3xl font-semibold">Venues they have worked at</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{supplier.venues.map((venue) => <Link className="focus-ring flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white p-4 transition hover:bg-[#f8f4ed]" href={`/venues/${venue.venueSlug}`} key={venue.venueId}><Building2 className="text-[#9d7b45]" size={19} /><span><strong className="block text-sm">{venue.venueName}</strong><span className="mt-1 block text-xs text-[var(--muted)]">{venue.venueTown}</span></span></Link>)}</div></section> : null}
        </div>

        <aside className="h-fit rounded-3xl border border-[var(--line)] bg-white p-6 lg:sticky lg:top-28">
          <h2 className="font-display text-3xl font-semibold">At a glance</h2>
          <dl className="mt-6 grid gap-5">
            <Detail label="Pricing" icon={<Camera size={17} />} value={supplier.startingPricePence == null ? "Contact for current pricing" : `Packages from ${gbp.format(supplier.startingPricePence / 100)}`} />
            {photographer?.coverageHoursMin || photographer?.coverageHoursMax ? <Detail label="Coverage" icon={<Clock3 size={17} />} value={coverageLabel(photographer.coverageHoursMin, photographer.coverageHoursMax)} /> : null}
            {photographer?.turnaroundWeeksMin || photographer?.turnaroundWeeksMax ? <Detail label="Typical turnaround" icon={<Clock3 size={17} />} value={turnaroundLabel(photographer.turnaroundWeeksMin, photographer.turnaroundWeeksMax)} /> : null}
            <Detail label="Travel" icon={<MapPin size={17} />} value={supplier.travelsNationwide ? "Available across the UK" : supplier.serviceAreas.length ? supplier.serviceAreas.join(", ") : `${supplier.region} and surrounding areas`} />
          </dl>
          {supplier.pricingSummary ? <p className="mt-6 rounded-2xl bg-[#f7f3eb] p-4 text-sm leading-6 text-[var(--muted)]">{supplier.pricingSummary}</p> : null}
          {features.length ? <ul className="mt-6 grid gap-3 border-t border-[var(--line)] pt-5">{features.map(([, label]) => <li className="flex items-center gap-3 text-sm" key={label}><Check className="text-[#5d7758]" size={16} />{label}</li>)}</ul> : null}
          {!supplier.isClaimed ? <div className="mt-7 border-t border-[var(--line)] pt-5"><p className="text-sm font-semibold">Is this your business?</p><p className="mt-2 text-xs leading-5 text-[var(--muted)]">Apply to verify and manage this profile.</p><ButtonLink className="mt-4 w-full" href="/for-business?category=Photographer" variant="secondary">Claim this listing</ButtonLink></div> : null}
        </aside>
      </div>
    </main>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="grid grid-cols-[2rem_1fr] gap-2"><span className="mt-0.5 text-[#9d7b45]">{icon}</span><div><dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a806f]">{label}</dt><dd className="mt-1 text-sm leading-6 text-[#403b34]">{value}</dd></div></div>; }
function SocialLink({ href, label }: { href: string; label: string }) { return <a className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--brand)] transition hover:bg-[#f7f1e8]" href={href} rel="noopener noreferrer" target="_blank">{label}<ExternalLink size={14} /></a>; }
function coverageLabel(min: number | null, max: number | null) { if (min != null && max != null && max > min) return `${min}–${max} hours`; return `${min ?? max} hours`; }
function turnaroundLabel(min: number | null, max: number | null) { if (min != null && max != null && max > min) return `${min}–${max} weeks`; return `${min ?? max} weeks`; }
