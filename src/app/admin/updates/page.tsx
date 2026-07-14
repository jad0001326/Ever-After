import type { Metadata } from "next";
import Link from "next/link";
import { Check, CheckCircle2, Clock3, ExternalLink, FilePenLine, Mail, X } from "lucide-react";
import { approveVendorUpdateRequest, rejectVendorUpdateRequest } from "@/app/actions/vendor-updates";
import { Button, ButtonLink } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildVenueUpdateComparisons, type VenueUpdateReviewVenue } from "@/lib/vendor-update-review";
import type { Database } from "@/types/database";

export const metadata: Metadata = { title: "Venue update reviews" };

type ReviewStatus = "pending" | "approved" | "rejected";
type SearchParams = { message?: string; status?: string };
type UpdateRequest = Database["public"]["Tables"]["vendor_update_requests"]["Row"];
type ReviewVenue = VenueUpdateReviewVenue & {
  id: string;
  slug: string;
  town: string;
  region: string;
};
type ReviewProfile = { id: string; email: string | null; full_name: string | null };

export default async function AdminVenueUpdatesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const { message, status } = await searchParams;
  const selectedStatus: ReviewStatus = status === "approved" || status === "rejected" ? status : "pending";
  const supabase = await createClient();

  const [{ data: requestData, error }, { data: statusData }] = await Promise.all([
    supabase!.from("vendor_update_requests").select("*").eq("status", selectedStatus).order("created_at", { ascending: selectedStatus !== "pending" }).limit(100),
    supabase!.from("vendor_update_requests").select("status")
  ]);
  const requests = (requestData ?? []) as UpdateRequest[];
  const venueIds = Array.from(new Set(requests.map((request) => request.venue_id)));
  const vendorIds = Array.from(new Set(requests.map((request) => request.vendor_user_id)));

  const [{ data: venueData }, { data: profileData }] = await Promise.all([
    venueIds.length
      ? supabase!.from("venues").select("id, slug, name, town, region, summary, description, official_website_url, official_gallery_url").in("id", venueIds)
      : Promise.resolve({ data: [] as ReviewVenue[] }),
    vendorIds.length
      ? supabase!.from("profiles").select("id, email, full_name").in("id", vendorIds)
      : Promise.resolve({ data: [] as ReviewProfile[] })
  ]);
  const venuesById = new Map((venueData ?? []).map((venue) => [venue.id, venue as ReviewVenue]));
  const profilesById = new Map((profileData ?? []).map((profile) => [profile.id, profile as ReviewProfile]));
  const counts: Record<ReviewStatus, number> = { pending: 0, approved: 0, rejected: 0 };
  for (const row of statusData ?? []) counts[row.status] += 1;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link className="text-sm font-semibold text-[#35533e]" href="/admin">Back to admin</Link>
          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-[#9d7b45]">Listing accuracy</p>
          <h1 className="mt-3 font-display text-5xl font-semibold tracking-[-0.04em]">Venue update reviews</h1>
          <p className="mt-3 max-w-2xl text-[var(--muted)]">Compare venue-owner edits with the live listing before publishing them.</p>
        </div>
        <ButtonLink href="/admin" variant="secondary">Back to listings</ButtonLink>
      </div>

      <div className="mt-7 flex flex-wrap gap-2 text-sm font-semibold">
        {(["pending", "approved", "rejected"] as const).map((item) => (
          <Link
            className={item === selectedStatus ? "rounded-full bg-[var(--brand)] px-4 py-2 text-white" : "rounded-full bg-white px-4 py-2 text-[#4d483f] ring-1 ring-[var(--line)]"}
            href={`/admin/updates?status=${item}`}
            key={item}
          >
            {statusLabel(item)} ({counts[item]})
          </Link>
        ))}
      </div>

      {message ? <p className="mt-6 rounded-2xl bg-[#eef4ea] px-4 py-3 text-sm text-[#285237]">{message}</p> : null}
      {error ? <p className="mt-6 rounded-2xl bg-[#fff4ed] px-4 py-3 text-sm text-[#9e341f]">{error.message}</p> : null}

      <div className="mt-8 grid gap-6">
        {requests.map((request) => {
          const venue = venuesById.get(request.venue_id) ?? null;
          const submitter = profilesById.get(request.vendor_user_id) ?? null;
          const comparisons = venue ? buildVenueUpdateComparisons(request, venue) : [];

          return (
            <article className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white" key={request.id}>
              <div className="border-b border-[var(--line)] px-5 py-5 sm:px-7">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9d7b45]">{statusLabel(request.status)}</p>
                    <h2 className="mt-2 font-display text-3xl font-semibold">{venue?.name ?? "Unknown venue"}</h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">{venue ? `${venue.town}, ${venue.region}` : "Venue details unavailable"}</p>
                  </div>
                  <div className="text-sm text-[#5b554c] lg:text-right">
                    <p className="font-semibold">{submitter?.full_name || "Approved venue owner"}</p>
                    <p className="mt-1 flex items-center gap-2 lg:justify-end"><Mail size={14} /> {submitter?.email ?? "Email unavailable"}</p>
                    <p className="mt-1 text-[var(--muted)]">Submitted {formatDateTime(request.created_at)}</p>
                    {venue ? <Link className="mt-3 inline-flex items-center gap-2 font-semibold text-[#35533e]" href={`/venues/${venue.slug}`} target="_blank">View live listing <ExternalLink size={14} /></Link> : null}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl bg-[#f7f3eb] px-4 py-3 text-sm leading-6 text-[#4d483f]">
                  <p className="font-semibold">Owner&apos;s note</p>
                  <p className="mt-1 whitespace-pre-wrap">{request.requested_message}</p>
                </div>
              </div>

              <div className="px-5 py-5 sm:px-7 sm:py-7">
                <div className="flex items-center gap-2">
                  <FilePenLine className="text-[#8b6d3c]" size={18} />
                  <h3 className="font-semibold">Submitted fields</h3>
                </div>

                <div className="mt-4 grid gap-4">
                  {comparisons.map((comparison) => (
                    <section className="overflow-hidden rounded-2xl border border-[var(--line)]" key={comparison.key}>
                      <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[#fbf8f3] px-4 py-3">
                        <h4 className="text-sm font-semibold text-[#4a443c]">{comparison.label}</h4>
                        <span className={comparison.changed ? "text-xs font-semibold text-[#426044]" : "text-xs font-semibold text-[#8a806f]"}>{comparison.changed ? "Changed" : "No change"}</span>
                      </div>
                      <div className="grid md:grid-cols-2">
                        <ComparisonValue label={request.status === "pending" ? "Current listing" : "Before review"} value={comparison.before} />
                        <ComparisonValue
                          className="border-t border-[var(--line)] bg-[#f7fbf5] md:border-l md:border-t-0"
                          label={request.status === "approved" ? "Published value" : "Owner's request"}
                          value={comparison.after}
                        />
                      </div>
                    </section>
                  ))}
                  {comparisons.length === 0 ? <p className="rounded-2xl bg-[#f7f3eb] px-4 py-4 text-sm text-[var(--muted)]">No listing fields were supplied with this request.</p> : null}
                </div>

                {request.status === "pending" ? (
                  <div className="mt-6 grid gap-4 xl:grid-cols-2">
                    <form action={approveVendorUpdateRequest} className="rounded-2xl border border-[#cdddcf] bg-[#f4faf4] p-4">
                      <input name="requestId" type="hidden" value={request.id} />
                      <p className="flex items-center gap-2 font-semibold text-[#2e4634]"><CheckCircle2 size={17} /> Approve and publish</p>
                      <p className="mt-2 text-sm leading-6 text-[#405246]">All submitted fields shown above will replace the current listing values together.</p>
                      <Textarea className="mt-3 min-h-24" name="adminNotes" maxLength={1000} placeholder="Optional note for the venue owner" />
                      <Button className="mt-3" type="submit"><Check size={16} /> Approve updates</Button>
                    </form>

                    <form action={rejectVendorUpdateRequest} className="rounded-2xl border border-[#ead2c3] bg-[#fff8f3] p-4">
                      <input name="requestId" type="hidden" value={request.id} />
                      <p className="flex items-center gap-2 font-semibold text-[#6f3928]"><X size={17} /> Return for changes</p>
                      <p className="mt-2 text-sm leading-6 text-[#76594c]">Nothing will change on the live listing. The owner will receive your reason.</p>
                      <Textarea className="mt-3 min-h-24" name="adminNotes" maxLength={1000} placeholder="Explain what needs to change" required />
                      <Button className="mt-3" type="submit" variant="secondary"><X size={16} /> Decline updates</Button>
                    </form>
                  </div>
                ) : (
                  <div className="mt-6 rounded-2xl bg-[#f7f3eb] p-4 text-sm text-[#4d483f]">
                    <p className="flex items-center gap-2 font-semibold">{request.status === "approved" ? <CheckCircle2 size={16} /> : <Clock3 size={16} />} {statusLabel(request.status)}</p>
                    {request.reviewed_at ? <p className="mt-2">Reviewed {formatDateTime(request.reviewed_at)}</p> : null}
                    {request.admin_notes ? <p className="mt-2 whitespace-pre-wrap leading-6">Review note: {request.admin_notes}</p> : null}
                  </div>
                )}
              </div>
            </article>
          );
        })}

        {requests.length === 0 && !error ? (
          <div className="rounded-3xl border border-[var(--line)] bg-white p-10 text-center">
            <FilePenLine className="mx-auto text-[#9d7b45]" size={28} />
            <h2 className="mt-4 font-display text-3xl font-semibold">No {statusLabel(selectedStatus).toLowerCase()} updates.</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">New venue-owner edits will appear here automatically.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ComparisonValue({ className = "", label, value }: { className?: string; label: string; value: string | null }) {
  return (
    <div className={`p-4 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a806f]">{label}</p>
      <p className="mt-2 break-words whitespace-pre-wrap text-sm leading-6 text-[#4d483f]">{value || "Not provided"}</p>
    </div>
  );
}

function statusLabel(status: ReviewStatus) {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Needs changes";
  return "Awaiting review";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(value));
}
