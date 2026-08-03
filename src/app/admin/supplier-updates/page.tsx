import type { Metadata } from "next";
import Link from "next/link";
import { Check, ExternalLink, X } from "lucide-react";
import { approveSupplierUpdateRequest, rejectSupplierUpdateRequest } from "@/app/actions/supplier-updates";
import { Button, ButtonLink } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { requireAdmin } from "@/lib/auth";
import { publicSupplierProfilePath } from "@/lib/supplier-public-routes";
import { buildSupplierUpdateComparisons } from "@/lib/supplier-update-review";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { SupplierCategorySlug } from "@/types/supplier";

export const metadata: Metadata = { title: "Supplier update reviews" };
type Status = "pending" | "approved" | "rejected";
type Request = Database["public"]["Tables"]["supplier_update_requests"]["Row"];
type Supplier = Database["public"]["Tables"]["supplier_listings"]["Row"];

export default async function AdminSupplierUpdatesPage({ searchParams }: { searchParams: Promise<{ status?: string; message?: string }> }) {
  await requireAdmin();
  const { status, message } = await searchParams;
  const selected: Status = status === "approved" || status === "rejected" ? status : "pending";
  const supabase = await createClient();
  const [{ data, error }, { data: allStatuses }] = await Promise.all([
    supabase!.from("supplier_update_requests").select("*").eq("status", selected).order("created_at", { ascending: selected !== "pending" }).limit(100),
    supabase!.from("supplier_update_requests").select("status")
  ]);
  const requests = (data ?? []) as Request[];
  const supplierIds = Array.from(new Set(requests.map((request) => request.supplier_id)));
  const submitterIds = Array.from(new Set(requests.map((request) => request.submitted_by)));
  const [{ data: suppliers }, { data: profiles }] = await Promise.all([
    supplierIds.length ? supabase!.from("supplier_listings").select("*").in("id", supplierIds) : Promise.resolve({ data: [] }),
    submitterIds.length ? supabase!.from("profiles").select("id, email, full_name").in("id", submitterIds) : Promise.resolve({ data: [] })
  ]);
  const supplierById = new Map((suppliers ?? []).map((supplier) => [supplier.id, supplier as Supplier]));
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const counts: Record<Status, number> = { pending: 0, approved: 0, rejected: 0 };
  for (const row of allStatuses ?? []) counts[row.status] += 1;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#9d7b45]">Admin review</p><h1 className="mt-3 font-display text-5xl font-semibold">Supplier profile updates</h1><p className="mt-3 text-[var(--muted)]">Compare owner proposals before publishing bounded profile fields.</p></div>
        <ButtonLink href="/admin" variant="secondary">Back to admin</ButtonLink>
      </div>
      {message ? <p className="mt-6 rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[var(--line)]">{message}</p> : null}
      {error ? <p className="mt-6 rounded-2xl bg-[#fff4ed] px-4 py-3 text-sm text-red-700">{error.message}</p> : null}
      <nav className="my-6 flex flex-wrap gap-2" aria-label="Review status">
        {(["pending", "approved", "rejected"] as Status[]).map((item) => <Link className={item === selected ? "rounded-full bg-[#334235] px-4 py-2 text-sm font-semibold text-white" : "rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-[var(--line)]"} href={`/admin/supplier-updates?status=${item}`} key={item}>{item[0].toUpperCase() + item.slice(1)} ({counts[item]})</Link>)}
      </nav>
      <div className="grid gap-6">
        {requests.map((request) => {
          const supplier = supplierById.get(request.supplier_id);
          if (!supplier) return null;
          const submitter = profileById.get(request.submitted_by);
          const comparisons = buildSupplierUpdateComparisons(request, supplier).filter((row) => row.changed);
          return <article className="rounded-3xl border border-[var(--line)] bg-white p-6" key={request.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between"><div><h2 className="font-display text-3xl font-semibold">{supplier.name}</h2><p className="mt-1 text-sm text-[var(--muted)]">Submitted by {submitter?.full_name || submitter?.email || request.submitted_by} - {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(request.created_at))}</p></div>{supplier.listing_status === "published" ? <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#5c6b52]" href={publicSupplierProfilePath(supplier.category_slug as SupplierCategorySlug, supplier.slug)}>Public profile <ExternalLink size={14} /></Link> : null}</div>
            <p className="mt-4 rounded-2xl bg-[#fbf8f3] p-4 text-sm"><span className="font-semibold">Owner note:</span> {request.requested_message}</p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--line)]">
              {comparisons.map((row) => <div className="grid gap-2 border-b border-[var(--line)] p-4 last:border-0 md:grid-cols-[11rem_1fr_1fr]" key={row.key}><p className="text-sm font-semibold">{row.label}</p><div><p className="text-xs uppercase tracking-wide text-[var(--muted)]">Current</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{row.before}</p></div><div><p className="text-xs uppercase tracking-wide text-[var(--muted)]">Proposed</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{row.after}</p></div></div>)}
              {comparisons.length === 0 ? <p className="p-4 text-sm text-[var(--muted)]">No field differences remain.</p> : null}
            </div>
            {request.status === "pending" ? <div className="mt-5 grid gap-4 md:grid-cols-2">
              <form action={approveSupplierUpdateRequest}><input name="requestId" type="hidden" value={request.id} /><Textarea className="min-h-24" maxLength={1000} name="adminNotes" placeholder="Optional approval note" /><Button className="mt-3" type="submit"><Check size={16} />Approve changes</Button></form>
              <form action={rejectSupplierUpdateRequest}><input name="requestId" type="hidden" value={request.id} /><Textarea className="min-h-24" maxLength={1000} name="adminNotes" required placeholder="Explain what the owner should change" /><Button className="mt-3" type="submit" variant="secondary"><X size={16} />Return to owner</Button></form>
            </div> : <p className="mt-4 text-sm"><span className="font-semibold capitalize">{request.status}</span>{request.admin_notes ? ` - ${request.admin_notes}` : ""}</p>}
          </article>;
        })}
        {requests.length === 0 ? <div className="rounded-3xl border border-[var(--line)] bg-white p-8 text-center text-sm text-[var(--muted)]">No {selected} supplier updates.</div> : null}
      </div>
    </div>
  );
}
