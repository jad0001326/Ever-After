import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Archive, CheckCircle2, ClipboardList, DatabaseZap, Edit, FilePenLine, Images, Inbox, Mail, MessageSquareText, Plus, Search, Send, Star, UploadCloud, UsersRound } from "lucide-react";
import { bulkUpdateVenues } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button, ButtonLink } from "@/components/ui/button";
import { formatPriceRange } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Admin dashboard"
};

type AdminSearchParams = {
  message?: string;
  q?: string;
  quality?: string;
  listing?: string;
  claim?: string;
  invite?: string;
  featured?: string;
};

type AdminVenue = {
  id: string;
  name: string;
  slug: string;
  type: string;
  region: string;
  town: string;
  price_from: number | null;
  price_to: number | null;
  capacity_max: number;
  status: string;
  listing_status: string | null;
  claim_status: string | null;
  invite_status: string | null;
  official_website_url: string | null;
  official_gallery_url: string | null;
  vendor_contact_email: string | null;
  image_is_representative: boolean | null;
  is_claimed: boolean | null;
  is_featured: boolean;
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  const [{ message, ...filters }] = await Promise.all([searchParams, requireAdmin()]);
  const supabase = await createClient();
  const [{ data, error }, { data: claims }, { data: amenityLinks }, { data: newEnquiries }, { count: pendingPhotoReviews }, { count: pendingUpdateReviews }] = await Promise.all([
    supabase!
      .from("venues")
      .select("id, name, slug, type, region, town, price_from, price_to, capacity_max, status, listing_status, claim_status, invite_status, official_website_url, official_gallery_url, vendor_contact_email, image_is_representative, is_claimed, is_featured")
      .order("updated_at", { ascending: false }),
    supabase!.from("venue_claims").select("id, status").eq("status", "pending"),
    supabase!.from("venue_amenities").select("venue_id"),
    supabase!.from("enquiries").select("id, status").eq("status", "new"),
    supabase!.from("venue_image_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase!.from("vendor_update_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
  ]);
  const amenityCounts = new Map<string, number>();
  for (const link of amenityLinks ?? []) amenityCounts.set(link.venue_id, (amenityCounts.get(link.venue_id) ?? 0) + 1);
  const venues = (data ?? []) as AdminVenue[];
  const enriched = venues.map((venue) => ({ venue, readiness: readinessForVenue(venue, amenityCounts.get(venue.id) ?? 0) }));
  const filtered = enriched.filter((item) => matchesAdminFilters(item, filters));
  const stats = qualityStats(enriched);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#9d7b45]">Admin CMS</p>
          <h1 className="mt-3 font-display text-5xl font-semibold">Venue listings</h1>
          <p className="mt-3 text-[var(--muted)]">Operational filters, readiness checks, and outreach tracking.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/admin/import" variant="secondary">
            <UploadCloud size={17} /> Import venues
          </ButtonLink>
          <ButtonLink href="/admin/outreach" variant="secondary">
            <Send size={17} /> Outreach
          </ButtonLink>
          <ButtonLink href="/admin/enrichment" variant="secondary">
            <DatabaseZap size={17} /> Enrichment review
          </ButtonLink>
          <ButtonLink href="/admin/enquiries" variant="secondary">
            <MessageSquareText size={17} /> Leads
          </ButtonLink>
          <ButtonLink href="/admin/claims" variant="secondary">
            <Inbox size={17} /> Review claims
          </ButtonLink>
          <ButtonLink href="/admin/images" variant="secondary">
            <Images size={17} /> Review photos
          </ButtonLink>
          <ButtonLink href="/admin/updates" variant="secondary">
            <FilePenLine size={17} /> Review edits
          </ButtonLink>
          <ButtonLink href="/admin/applications" variant="secondary">
            <ClipboardList size={17} /> Applications
          </ButtonLink>
          <ButtonLink href="/admin/suppliers" variant="secondary">
            <UsersRound size={17} /> Suppliers
          </ButtonLink>
          <ButtonLink href="/admin/venues/new">
            <Plus size={17} /> Add venue
          </ButtonLink>
        </div>
      </div>

      {message ? <p className="mb-6 rounded-2xl bg-white px-4 py-3 text-sm text-[#5f594f] ring-1 ring-[var(--line)]">{message}</p> : null}
      {error ? <p className="mb-6 rounded-2xl bg-[#fff4ed] px-4 py-3 text-sm text-[#8a3c19] ring-1 ring-[#f0c2a8]">Supabase error: {error.message}</p> : null}

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <AdminStat icon={<Edit size={18} />} label="Listings" value={venues.length.toString()} />
        <AdminStat icon={<CheckCircle2 size={18} />} label="Launch ready" value={stats.launchReady.toString()} />
        <AdminStat icon={<Archive size={18} />} label="Missing price" value={stats.missingPrice.toString()} />
        <AdminStat icon={<MessageSquareText size={18} />} label="New leads" value={(newEnquiries?.length ?? 0).toString()} />
        <AdminStat icon={<Inbox size={18} />} label="Pending claims" value={(claims?.length ?? 0).toString()} />
        <AdminStat icon={<Images size={18} />} label="Photo reviews" value={(pendingPhotoReviews ?? 0).toString()} />
        <AdminStat icon={<FilePenLine size={18} />} label="Pending edits" value={(pendingUpdateReviews ?? 0).toString()} />
      </section>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QualityPill label="Missing vendor email" value={stats.missingVendorEmail} href="/admin/enrichment?blocker=missing_email" />
        <QualityPill label="Representative image" value={stats.representativeImage} href="/admin?quality=representative_image" />
        <QualityPill label="Unclaimed" value={stats.unclaimed} href="/admin?quality=unclaimed" />
        <QualityPill label="Invite not sent" value={stats.inviteNotSent} href="/admin?invite=not_sent" />
      </section>

      <AdminFilters filters={filters} />

      <form action={bulkUpdateVenues} className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white">
        <div className="flex flex-col gap-3 border-b border-[var(--line)] px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold">{filtered.length} venue{filtered.length === 1 ? "" : "s"} shown</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Select venues to publish, archive, feature, or update invite status.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <select className="focus-ring h-11 rounded-full border border-[var(--line)] bg-white px-4 text-sm" name="bulkAction" defaultValue="">
              <option value="" disabled>Bulk action</option>
              <option value="publish">Publish</option>
              <option value="draft">Move to draft</option>
              <option value="archive">Archive</option>
              <option value="feature">Feature</option>
              <option value="unfeature">Unfeature</option>
              <option value="mark_invite_sent">Mark invite sent</option>
              <option value="reset_invite">Reset invite</option>
            </select>
            <Button type="submit">Apply</Button>
          </div>
        </div>
        <div className="grid grid-cols-[auto_1fr_auto] gap-4 border-b border-[var(--line)] px-5 py-4 text-sm font-semibold text-[#5a5248] lg:grid-cols-[auto_1.2fr_1fr_1.1fr_1.2fr_auto]">
          <span>Select</span>
          <span>Venue</span>
          <span className="hidden lg:block">Market</span>
          <span className="hidden lg:block">Readiness</span>
          <span className="hidden lg:block">Outreach</span>
          <span>Action</span>
        </div>
        {filtered.map(({ venue, readiness }) => (
          <div className="grid grid-cols-[auto_1fr_auto] items-start gap-4 border-b border-[var(--line)] px-5 py-4 last:border-b-0 lg:grid-cols-[auto_1.2fr_1fr_1.1fr_1.2fr_auto]" key={venue.id}>
            <input className="mt-1 size-4 accent-[#334235]" name="venueIds" type="checkbox" value={venue.id} aria-label={`Select ${venue.name}`} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{venue.name}</p>
                {venue.is_featured ? <span className="inline-flex items-center gap-1 rounded-full bg-[#fff9ef] px-2 py-0.5 text-xs font-semibold text-[#8a672d]"><Star size={12} /> Featured</span> : null}
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">{venue.type} - {venue.listing_status ?? venue.status} - {venue.claim_status ?? "unclaimed"}</p>
              <p className="mt-1 text-sm text-[var(--muted)] lg:hidden">{venue.town}, {venue.region}</p>
            </div>
            <p className="hidden text-sm text-[var(--muted)] lg:block">{venue.town}, {venue.region}</p>
            <div className="hidden lg:block">
              <p className="text-sm font-semibold text-[#3f4d38]">Launch ready: {readiness.score}/{readiness.total}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{readiness.missing.length ? `Needs: ${readiness.missing.join(", ")}` : "Ready for launch review"}</p>
            </div>
            <div className="hidden text-sm text-[var(--muted)] lg:block">
              <p>{formatPriceRange(venue.price_from, venue.price_to) ?? "No price"} - {venue.capacity_max} guests</p>
              <p className="mt-1"><Mail className="mr-1 inline" size={14} />{venue.invite_status ?? "not_sent"}</p>
            </div>
            <Link className="focus-ring inline-flex size-10 items-center justify-center rounded-full bg-[#f4efe7] text-[#3f4d38] transition hover:bg-[#e8dece]" href={`/admin/venues/${venue.id}/edit`} aria-label={`Edit ${venue.name}`}>
              <Edit size={16} />
            </Link>
          </div>
        ))}
        {filtered.length === 0 ? (
          <div className="px-5 py-8 text-sm text-[var(--muted)]">No venues match these admin filters.</div>
        ) : null}
      </form>
    </div>
  );
}

function readinessForVenue(venue: AdminVenue, amenityCount: number) {
  const checks = [
    { label: "price", ok: venue.price_from != null || venue.price_to != null },
    { label: "website", ok: Boolean(venue.official_website_url) },
    { label: "gallery", ok: Boolean(venue.official_gallery_url) },
    { label: "vendor email", ok: Boolean(venue.vendor_contact_email) },
    { label: "amenities", ok: amenityCount > 0 },
    { label: "approved image", ok: !venue.image_is_representative },
    { label: "claim status", ok: Boolean(venue.claim_status) }
  ];
  return {
    score: checks.filter((check) => check.ok).length,
    total: checks.length,
    missing: checks.filter((check) => !check.ok).map((check) => check.label)
  };
}

function matchesAdminFilters(item: { venue: AdminVenue; readiness: ReturnType<typeof readinessForVenue> }, filters: Omit<AdminSearchParams, "message">) {
  const { venue, readiness } = item;
  const q = filters.q?.trim().toLowerCase();
  if (q && !`${venue.name} ${venue.town} ${venue.region} ${venue.type}`.toLowerCase().includes(q)) return false;
  if (filters.listing && (venue.listing_status ?? venue.status) !== filters.listing) return false;
  if (filters.claim && (venue.claim_status ?? "unclaimed") !== filters.claim) return false;
  if (filters.invite && (venue.invite_status ?? "not_sent") !== filters.invite) return false;
  if (filters.featured === "yes" && !venue.is_featured) return false;
  if (filters.featured === "no" && venue.is_featured) return false;
  if (filters.quality === "missing_price" && (venue.price_from != null || venue.price_to != null)) return false;
  if (filters.quality === "missing_vendor_email" && venue.vendor_contact_email) return false;
  if (filters.quality === "representative_image" && !venue.image_is_representative) return false;
  if (filters.quality === "unclaimed" && venue.is_claimed) return false;
  if (filters.quality === "missing_gallery" && venue.official_gallery_url) return false;
  if (filters.quality === "ready" && readiness.score < readiness.total) return false;
  return true;
}

function qualityStats(items: { venue: AdminVenue; readiness: ReturnType<typeof readinessForVenue> }[]) {
  return {
    launchReady: items.filter((item) => item.readiness.score === item.readiness.total).length,
    missingPrice: items.filter((item) => item.venue.price_from == null && item.venue.price_to == null).length,
    missingVendorEmail: items.filter((item) => !item.venue.vendor_contact_email).length,
    representativeImage: items.filter((item) => item.venue.image_is_representative).length,
    unclaimed: items.filter((item) => !item.venue.is_claimed).length,
    inviteNotSent: items.filter((item) => (item.venue.invite_status ?? "not_sent") === "not_sent").length
  };
}

function AdminFilters({ filters }: { filters: Omit<AdminSearchParams, "message"> }) {
  return (
    <form className="mb-6 rounded-3xl border border-[var(--line)] bg-white p-5">
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-7">
        <label className="grid gap-2 text-sm font-medium text-[#4a443c] lg:col-span-2">
          Search
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9a9286]" size={16} />
            <input className="focus-ring h-11 w-full rounded-full border border-[var(--line)] bg-white pl-10 pr-4 text-sm" name="q" defaultValue={filters.q ?? ""} placeholder="Name, town, region" />
          </div>
        </label>
        <FilterSelect name="quality" label="Quality" value={filters.quality} options={[
          ["", "All quality"],
          ["missing_price", "Missing price"],
          ["missing_vendor_email", "Missing vendor email"],
          ["missing_gallery", "Missing gallery"],
          ["representative_image", "Representative image"],
          ["unclaimed", "Unclaimed"],
          ["ready", "Launch ready"]
        ]} />
        <FilterSelect name="listing" label="Listing" value={filters.listing} options={[
          ["", "All listings"],
          ["draft", "Draft"],
          ["published", "Published"],
          ["claimed", "Claimed"],
          ["archived", "Archived"]
        ]} />
        <FilterSelect name="claim" label="Claim" value={filters.claim} options={[
          ["", "All claims"],
          ["unclaimed", "Unclaimed"],
          ["pending", "Pending"],
          ["approved", "Approved"],
          ["rejected", "Rejected"]
        ]} />
        <FilterSelect name="invite" label="Invite" value={filters.invite} options={[
          ["", "All invites"],
          ["not_sent", "Not sent"],
          ["sent", "Sent"],
          ["bounced", "Bounced"],
          ["replied", "Replied"],
          ["claimed", "Claimed"]
        ]} />
        <FilterSelect name="featured" label="Featured" value={filters.featured} options={[
          ["", "All"],
          ["yes", "Featured"],
          ["no", "Not featured"]
        ]} />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="submit" variant="secondary">Apply filters</Button>
        <ButtonLink href="/admin" variant="secondary">Clear filters</ButtonLink>
      </div>
    </form>
  );
}

function FilterSelect({ label, name, options, value }: { label: string; name: string; options: [string, string][]; value?: string }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[#4a443c]">
      {label}
      <select className="focus-ring h-11 rounded-full border border-[var(--line)] bg-white px-4 text-sm" name={name} defaultValue={value ?? ""}>
        {options.map(([optionValue, labelText]) => <option key={optionValue || labelText} value={optionValue}>{labelText}</option>)}
      </select>
    </label>
  );
}

function QualityPill({ href, label, value }: { href: string; label: string; value: number }) {
  return (
    <Link className="rounded-2xl border border-[var(--line)] bg-white p-4 transition hover:bg-[#fbf8f3]" href={href}>
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </Link>
  );
}

function AdminStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-[var(--line)] bg-white p-5">
      <div className="mb-4 grid size-10 place-items-center rounded-full bg-[#f4efe7] text-[#8b6d3c]">{icon}</div>
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
