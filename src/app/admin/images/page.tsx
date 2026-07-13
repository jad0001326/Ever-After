import type { Metadata } from "next";
import Link from "next/link";
import { Check, CheckCircle2, Clock3, ExternalLink, ImagePlus, ShieldCheck, Star, X } from "lucide-react";
import { approveVenueImageSubmission, rejectVenueImageSubmission } from "@/app/actions/vendor-images";
import { Button, ButtonLink } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { VENUE_IMAGE_SUBMISSIONS_BUCKET, type VenueImageSubmissionStatus } from "@/lib/venue-image-submissions";

export const metadata: Metadata = { title: "Venue photo reviews" };

type SearchParams = { message?: string; status?: string };

type ReviewVenue = {
  id: string;
  name: string;
  slug: string;
  town: string;
  region: string;
  image_is_representative: boolean;
};

export default async function AdminImagesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const { message, status } = await searchParams;
  const selectedStatus: VenueImageSubmissionStatus = status === "approved" || status === "rejected" ? status : "pending";
  const supabase = await createClient();

  const [{ data: submissions, error }, { data: statuses }] = await Promise.all([
    supabase!.from("venue_image_submissions").select("*").eq("status", selectedStatus).order("created_at", { ascending: selectedStatus === "pending" }).limit(100),
    supabase!.from("venue_image_submissions").select("status")
  ]);

  const venueIds = Array.from(new Set((submissions ?? []).map((submission) => submission.venue_id)));
  const submitterIds = Array.from(new Set((submissions ?? []).map((submission) => submission.submitted_by)));
  const [{ data: venues }, { data: profiles }] = await Promise.all([
    venueIds.length ? supabase!.from("venues").select("id, name, slug, town, region, image_is_representative").in("id", venueIds) : Promise.resolve({ data: [] as ReviewVenue[] }),
    submitterIds.length ? supabase!.from("profiles").select("id, email, full_name").in("id", submitterIds) : Promise.resolve({ data: [] as Array<{ id: string; email: string | null; full_name: string | null }> })
  ]);
  const venuesById = new Map((venues ?? []).map((venue) => [venue.id, venue]));
  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const counts = { pending: 0, approved: 0, rejected: 0 };
  for (const row of statuses ?? []) counts[row.status] += 1;

  const reviews = await Promise.all((submissions ?? []).map(async (submission) => {
    let previewUrl = submission.published_url;
    if (!previewUrl) {
      const { data } = await supabase!.storage.from(VENUE_IMAGE_SUBMISSIONS_BUCKET).createSignedUrl(submission.storage_path, 60 * 60);
      previewUrl = data?.signedUrl ?? null;
    }
    return {
      submission,
      venue: venuesById.get(submission.venue_id) ?? null,
      submitter: profilesById.get(submission.submitted_by) ?? null,
      previewUrl
    };
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link className="text-sm font-semibold text-[#35533e]" href="/admin">Back to admin</Link>
          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-[#9d7b45]">Photography desk</p>
          <h1 className="mt-3 font-display text-5xl font-semibold tracking-[-0.04em]">Venue photo reviews</h1>
          <p className="mt-3 max-w-2xl text-[var(--muted)]">Approve rights-confirmed venue photography before it replaces a Passport or enters the public gallery.</p>
        </div>
        <ButtonLink href="/admin" variant="secondary">Back to listings</ButtonLink>
      </div>

      <div className="mt-7 flex flex-wrap gap-2 text-sm font-semibold">
        {(["pending", "approved", "rejected"] as const).map((item) => (
          <Link className={item === selectedStatus ? "rounded-full bg-[var(--brand)] px-4 py-2 text-white" : "rounded-full bg-white px-4 py-2 text-[#4d483f] ring-1 ring-[var(--line)]"} href={`/admin/images?status=${item}`} key={item}>
            {statusLabel(item)} ({counts[item]})
          </Link>
        ))}
      </div>

      {message ? <p className="mt-6 rounded-2xl bg-[#eef4ea] px-4 py-3 text-sm text-[#285237]">{message}</p> : null}
      {error ? <p className="mt-6 rounded-2xl bg-[#fff4ed] px-4 py-3 text-sm text-[#9e341f]">{error.message}</p> : null}

      <div className="mt-8 grid gap-6">
        {reviews.map(({ previewUrl, submission, submitter, venue }) => (
          <article className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white" key={submission.id}>
            <div className="grid lg:grid-cols-[minmax(360px,0.9fr)_1.1fr]">
              <div className="relative min-h-72 bg-[#eee8de] lg:min-h-[480px]">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="absolute inset-0 h-full w-full object-cover" src={previewUrl} alt={submission.alt_text} />
                ) : <div className="grid h-full min-h-72 place-items-center text-[#9a8e7d]"><ImagePlus size={30} /></div>}
                <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#36523c] shadow-sm"><ShieldCheck size={14} /> Rights confirmed</span>
                {submission.is_preferred ? <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-[#fff9ef] px-3 py-1.5 text-xs font-semibold text-[#72572b] shadow-sm"><Star size={13} /> Owner&apos;s preferred main</span> : null}
              </div>

              <div className="p-5 sm:p-7">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9d7b45]">{statusLabel(submission.status)}</p>
                    <h2 className="mt-2 font-display text-3xl font-semibold">{venue?.name ?? "Unknown venue"}</h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">{venue ? `${venue.town}, ${venue.region}` : "Venue details unavailable"}</p>
                  </div>
                  {venue ? <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#4f5e46]" href={`/venues/${venue.slug}`} target="_blank">View listing <ExternalLink size={14} /></Link> : null}
                </div>

                <dl className="mt-6 grid gap-4 border-y border-[var(--line)] py-5 text-sm sm:grid-cols-2">
                  <Info label="Image description" value={submission.alt_text} />
                  <Info label="Photo credit" value={submission.credit_text ?? "No credit supplied"} />
                  <Info label="Submitted by" value={submitter?.full_name || submitter?.email || "Approved venue owner"} />
                  <Info label="File" value={`${submission.original_file_name} · ${formatFileSize(submission.file_size)}`} />
                  <Info label="Permission confirmed" value={submission.permission_confirmed_at ? formatDateTime(submission.permission_confirmed_at) : "Not recorded"} />
                  <Info label="Submitted" value={formatDateTime(submission.created_at)} />
                </dl>

                {submission.status === "pending" ? (
                  <div className="mt-6 grid gap-4 xl:grid-cols-2">
                    <form action={approveVenueImageSubmission} className="rounded-2xl border border-[#cdddcf] bg-[#f4faf4] p-4">
                      <input name="submissionId" type="hidden" value={submission.id} />
                      <p className="flex items-center gap-2 font-semibold text-[#2e4634]"><CheckCircle2 size={17} /> Approve and publish</p>
                      <label className="mt-3 flex items-start gap-3 text-sm leading-6 text-[#405246]"><input className="mt-1 size-4 shrink-0 accent-[#334235]" name="makePrimary" type="checkbox" defaultChecked={submission.is_preferred || Boolean(venue?.image_is_representative)} /><span>Use as the main listing image. The first approved real photo becomes the main image automatically.</span></label>
                      <Textarea className="mt-3 min-h-24" name="adminNotes" maxLength={1000} placeholder="Optional note for the venue owner" />
                      <Button className="mt-3" type="submit"><Check size={16} /> Approve photo</Button>
                    </form>

                    <form action={rejectVenueImageSubmission} className="rounded-2xl border border-[#ead2c3] bg-[#fff8f3] p-4">
                      <input name="submissionId" type="hidden" value={submission.id} />
                      <p className="flex items-center gap-2 font-semibold text-[#6f3928]"><X size={17} /> Return for changes</p>
                      <p className="mt-2 text-sm leading-6 text-[#76594c]">The file stays private and the venue owner can remove it and upload a replacement.</p>
                      <Textarea className="mt-3 min-h-24" name="adminNotes" maxLength={1000} placeholder="Explain what needs to change" required />
                      <Button className="mt-3" type="submit" variant="secondary"><X size={16} /> Decline photo</Button>
                    </form>
                  </div>
                ) : (
                  <div className="mt-6 rounded-2xl bg-[#f7f3eb] p-4 text-sm text-[#4d483f]">
                    <p className="flex items-center gap-2 font-semibold">{submission.status === "approved" ? <CheckCircle2 size={16} /> : <Clock3 size={16} />} {statusLabel(submission.status)}</p>
                    {submission.admin_notes ? <p className="mt-2 leading-6">Review note: {submission.admin_notes}</p> : null}
                    {submission.published_url ? <a className="mt-3 inline-flex items-center gap-2 font-semibold text-[#35533e]" href={submission.published_url} target="_blank" rel="noreferrer">Open published image <ExternalLink size={14} /></a> : null}
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}

        {reviews.length === 0 && !error ? (
          <div className="rounded-3xl border border-[var(--line)] bg-white p-10 text-center">
            <ImagePlus className="mx-auto text-[#9d7b45]" size={28} />
            <h2 className="mt-4 font-display text-3xl font-semibold">No {statusLabel(selectedStatus).toLowerCase()} photos.</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">New venue uploads will appear here automatically.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function statusLabel(status: VenueImageSubmissionStatus) {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Needs changes";
  return "Awaiting review";
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a806f]">{label}</dt><dd className="mt-1 break-words leading-6 text-[#4d483f]">{value}</dd></div>;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
