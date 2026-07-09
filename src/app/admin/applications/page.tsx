import type { Metadata } from "next";
import Link from "next/link";
import { Check, ClipboardList, X } from "lucide-react";
import { reviewSupplierApplication } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Supplier applications" };

type Application = {
  id: string;
  business_name: string;
  owner_name: string;
  email: string;
  phone: string;
  website_url: string | null;
  instagram_handle: string | null;
  facebook_url: string | null;
  location: string;
  coverage_radius_miles: number;
  category: string;
  description: string;
  services: string;
  pricing: string | null;
  gallery_urls: string | null;
  status: "pending" | "approved" | "rejected";
  admin_notes: string | null;
  created_at: string;
};

export default async function SupplierApplicationsPage({ searchParams }: { searchParams: Promise<{ message?: string; status?: string }> }) {
  await requireAdmin();
  const { message, status } = await searchParams;
  const selectedStatus = status === "approved" || status === "rejected" || status === "pending" ? status : "pending";
  const supabase = createAdminClient();
  const { data, error } = supabase
    ? await supabase.from("supplier_applications").select("*").eq("status", selectedStatus).order("created_at", { ascending: false }).limit(100)
    : { data: [], error: new Error("Set SUPABASE_SERVICE_ROLE_KEY to review supplier applications.") };
  const applications = (data ?? []) as Application[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link className="text-sm font-semibold text-[#35533e]" href="/admin">Back to admin</Link>
          <p className="mt-5 text-sm font-semibold tracking-[0.16em] text-[#95502b]">Supplier acquisition</p>
          <h1 className="mt-3 font-display text-5xl font-semibold tracking-[-0.04em]">Applications</h1>
          <p className="mt-3 text-[var(--muted)]">Review new businesses before any profile is published.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm font-semibold">
          {(["pending", "approved", "rejected"] as const).map((item) => <Link className={item === selectedStatus ? "rounded-full bg-[var(--brand)] px-4 py-2 text-white" : "rounded-full bg-white px-4 py-2 text-[#4d483f] ring-1 ring-[var(--line)]"} href={`/admin/applications?status=${item}`} key={item}>{item[0].toUpperCase() + item.slice(1)}</Link>)}
        </div>
      </div>
      {message ? <p className="mt-6 rounded-2xl bg-[#eef4ea] px-4 py-3 text-sm text-[#285237]">{message}</p> : null}
      {error ? <p className="mt-6 rounded-2xl bg-[#fff4ed] px-4 py-3 text-sm text-[#9e341f]">{error.message}</p> : null}
      <div className="mt-8 grid gap-5">
        {applications.map((application) => <ApplicationCard application={application} key={application.id} />)}
        {applications.length === 0 && !error ? <div className="rounded-3xl border border-[var(--line)] bg-white p-8 text-center"><ClipboardList className="mx-auto text-[#95502b]" size={24} /><h2 className="mt-4 font-display text-3xl font-semibold">Nothing to review here.</h2><p className="mt-2 text-sm text-[var(--muted)]">New supplier applications will appear in this queue.</p></div> : null}
      </div>
    </div>
  );
}

function ApplicationCard({ application }: { application: Application }) {
  return (
    <article className="rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3"><h2 className="font-display text-3xl font-semibold tracking-[-0.03em]">{application.business_name}</h2><span className="rounded-full bg-[#f2ede4] px-3 py-1 text-xs font-semibold text-[#6d5138]">{application.category}</span></div>
          <p className="mt-2 text-sm text-[var(--muted)]">{application.location} · {application.coverage_radius_miles} mile radius</p>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-[#4d483f]">{application.description}</p>
        </div>
        <p className="shrink-0 text-sm text-[var(--muted)]">{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(application.created_at))}</p>
      </div>
      <dl className="mt-5 grid gap-4 border-t border-[var(--line)] pt-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Contact" value={`${application.owner_name} · ${application.email}`} />
        <Info label="Phone" value={application.phone} />
        <Info label="Services" value={application.services} />
        <Info label="Pricing" value={application.pricing ?? "Not supplied"} />
      </dl>
      <div className="mt-5 flex flex-wrap gap-3 text-sm font-semibold text-[var(--brand)]">
        {application.website_url ? <a href={application.website_url} rel="noopener noreferrer" target="_blank">Website</a> : null}
        {application.facebook_url ? <a href={application.facebook_url} rel="noopener noreferrer" target="_blank">Facebook</a> : null}
        {application.instagram_handle ? <span>{application.instagram_handle}</span> : null}
        {application.gallery_urls ? <span className="font-normal text-[var(--muted)]">Gallery links supplied</span> : null}
      </div>
      {application.status === "pending" ? <div className="mt-6 grid gap-3 sm:grid-cols-2"><ReviewForm application={application} status="approved" /><ReviewForm application={application} status="rejected" /></div> : application.admin_notes ? <p className="mt-5 rounded-2xl bg-[#f7f3eb] px-4 py-3 text-sm text-[#4d483f]">Review note: {application.admin_notes}</p> : null}
    </article>
  );
}

function ReviewForm({ application, status }: { application: Application; status: "approved" | "rejected" }) {
  const isApproval = status === "approved";
  return (
    <form action={reviewSupplierApplication} className={isApproval ? "rounded-2xl border border-[#cdddcf] bg-[#f4faf4] p-4" : "rounded-2xl border border-[#ead2c3] bg-[#fff8f3] p-4"}>
      <input name="applicationId" type="hidden" value={application.id} />
      <input name="status" type="hidden" value={status} />
      <p className="font-semibold text-[#2e4634]">{isApproval ? "Approve application" : "Decline application"}</p>
      <Textarea className="mt-3 min-h-20" name="adminNotes" placeholder={isApproval ? "Optional internal note" : "Reason or internal note"} required={!isApproval} />
      <Button className="mt-3" type="submit" variant={isApproval ? "primary" : "secondary"}>{isApproval ? <Check size={16} /> : <X size={16} />}{isApproval ? "Approve" : "Decline"}</Button>
    </form>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold tracking-[0.14em] text-[#8a806f]">{label}</dt><dd className="mt-1 break-words leading-6 text-[#4d483f]">{value}</dd></div>;
}
