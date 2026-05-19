import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, Mail, MessageSquareText, Phone, UsersRound } from "lucide-react";
import { updateEnquiryStatus } from "@/app/actions/enquiries";
import { Button, ButtonLink } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Enquiry inbox"
};

type EnquiryStatus = "new" | "contacted" | "converted" | "closed";

type EnquirySearchParams = {
  message?: string;
  status?: string;
};

type AdminEnquiry = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  wedding_date: string | null;
  guest_count: number | null;
  message: string;
  status: EnquiryStatus;
  created_at: string;
  venues: {
    name: string;
    slug: string;
    town: string;
    region: string;
    vendor_contact_email: string | null;
  } | null;
};

const statusOptions: [EnquiryStatus, string][] = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["converted", "Converted"],
  ["closed", "Closed"]
];

export default async function AdminEnquiriesPage({ searchParams }: { searchParams: Promise<EnquirySearchParams> }) {
  const [{ message, status }] = await Promise.all([searchParams, requireAdmin()]);
  const selectedStatus = statusOptions.some(([optionValue]) => optionValue === status) ? (status as EnquiryStatus) : null;
  const supabase = await createClient();
  let query = supabase!
    .from("enquiries")
    .select("id, name, email, phone, wedding_date, guest_count, message, status, created_at, venues(name, slug, town, region, vendor_contact_email)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (selectedStatus) query = query.eq("status", selectedStatus);

  const [{ data, error }, { data: statsData }] = await Promise.all([
    query,
    supabase!.from("enquiries").select("status").limit(1000)
  ]);
  const enquiries = (data ?? []) as unknown as AdminEnquiry[];
  const stats = statusStats((statsData ?? []) as { status: EnquiryStatus }[]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link className="text-sm font-semibold text-[#5c6b52]" href="/admin">Back to admin</Link>
          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.22em] text-[#9d7b45]">Lead pipeline</p>
          <h1 className="mt-3 font-display text-5xl font-semibold">Enquiry inbox</h1>
          <p className="mt-3 text-[var(--muted)]">Track couple enquiries from first message through follow-up and conversion.</p>
        </div>
        <ButtonLink href="/admin/enquiries" variant="secondary">All leads</ButtonLink>
      </div>

      {message ? <p className="mb-6 rounded-2xl bg-white px-4 py-3 text-sm text-[#5f594f] ring-1 ring-[var(--line)]">{message}</p> : null}
      {error ? <p className="mb-6 rounded-2xl bg-[#fff4ed] px-4 py-3 text-sm text-[#8a3c19] ring-1 ring-[#f0c2a8]">Supabase error: {error.message}</p> : null}

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statusOptions.map(([optionValue, label]) => (
          <Link className="rounded-2xl border border-[var(--line)] bg-white p-4 transition hover:bg-[#fbf8f3]" href={`/admin/enquiries?status=${optionValue}`} key={optionValue}>
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{stats[optionValue]}</p>
          </Link>
        ))}
      </section>

      <div className="grid gap-4">
        {enquiries.map((enquiry) => (
          <section className="rounded-3xl border border-[var(--line)] bg-white p-5" key={enquiry.id}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={enquiry.status} />
                  <p className="text-sm text-[var(--muted)]">{formatDate(enquiry.created_at)}</p>
                </div>
                <h2 className="mt-3 font-display text-3xl font-semibold">{enquiry.name}</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {enquiry.venues ? (
                    <>
                      For <Link className="font-semibold text-[#5c6b52]" href={`/venues/${enquiry.venues.slug}`}>{enquiry.venues.name}</Link>, {enquiry.venues.town}
                    </>
                  ) : (
                    "Venue no longer available"
                  )}
                </p>
              </div>

              <form action={updateEnquiryStatus} className="flex flex-wrap gap-3">
                <input name="enquiryId" type="hidden" value={enquiry.id} />
                <select className="focus-ring h-11 rounded-full border border-[var(--line)] bg-white px-4 text-sm" name="status" defaultValue={enquiry.status}>
                  {statusOptions.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}
                </select>
                <Button type="submit" variant="secondary">Update</Button>
              </form>
            </div>

            <div className="mt-5 grid gap-3 text-sm text-[#4f4a43] sm:grid-cols-2 lg:grid-cols-4">
              <LeadMeta icon={<Mail size={16} />} text={enquiry.email} href={`mailto:${enquiry.email}`} />
              <LeadMeta icon={<Phone size={16} />} text={enquiry.phone ?? "No phone"} href={enquiry.phone ? `tel:${enquiry.phone}` : undefined} />
              <LeadMeta icon={<CalendarDays size={16} />} text={enquiry.wedding_date ? formatDate(enquiry.wedding_date) : "No date yet"} />
              <LeadMeta icon={<UsersRound size={16} />} text={enquiry.guest_count ? `${enquiry.guest_count} guests` : "Guest count unknown"} />
            </div>

            <div className="mt-5 rounded-2xl bg-[#fbf8f3] p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#4a443c]"><MessageSquareText size={16} /> Couple message</p>
              <p className="text-sm leading-6 text-[var(--muted)]">{enquiry.message}</p>
            </div>
          </section>
        ))}

        {enquiries.length === 0 ? (
          <section className="rounded-3xl border border-[var(--line)] bg-white p-8 text-center">
            <h2 className="font-display text-3xl font-semibold">No enquiries found</h2>
            <p className="mt-3 text-sm text-[var(--muted)]">Clear the status filter or wait for the next venue enquiry to arrive.</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function statusStats(enquiries: { status: EnquiryStatus }[]) {
  return statusOptions.reduce<Record<EnquiryStatus, number>>(
    (stats, [status]) => {
      stats[status] = enquiries.filter((enquiry) => enquiry.status === status).length;
      return stats;
    },
    { new: 0, contacted: 0, converted: 0, closed: 0 }
  );
}

function StatusBadge({ status }: { status: EnquiryStatus }) {
  const labels: Record<EnquiryStatus, string> = {
    new: "New",
    contacted: "Contacted",
    converted: "Converted",
    closed: "Closed"
  };
  const classes: Record<EnquiryStatus, string> = {
    new: "bg-[#eef4ea] text-[#3f5c35]",
    contacted: "bg-[#f4efe7] text-[#755c31]",
    converted: "bg-[#eaf2f7] text-[#34566a]",
    closed: "bg-[#f3f0ee] text-[#6a6259]"
  };

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${classes[status]}`}>{labels[status]}</span>;
}

function LeadMeta({ href, icon, text }: { href?: string; icon: ReactNode; text: string }) {
  const content = (
    <>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#f4efe7] text-[#8b6d3c]">{icon}</span>
      <span className="min-w-0 truncate">{text}</span>
    </>
  );

  if (href) return <a className="flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--line)] px-3 py-2 transition hover:bg-[#fbf8f3]" href={href}>{content}</a>;
  return <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--line)] px-3 py-2">{content}</div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}
