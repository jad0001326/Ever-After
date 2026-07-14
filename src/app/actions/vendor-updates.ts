"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { notifyVendorUpdateReviewed } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";

type ReviewDecision = "approved" | "rejected";

export async function approveVendorUpdateRequest(formData: FormData) {
  await reviewVendorUpdateRequest(formData, "approved");
}

export async function rejectVendorUpdateRequest(formData: FormData) {
  await reviewVendorUpdateRequest(formData, "rejected");
}

async function reviewVendorUpdateRequest(formData: FormData, decision: ReviewDecision): Promise<never> {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) redirectWithMessage("Venue update reviews are not configured yet.");

  const requestId = formData.get("requestId")?.toString().trim() ?? "";
  const adminNotes = formData.get("adminNotes")?.toString().trim().slice(0, 1000) || null;
  if (!requestId) redirectWithMessage("Select a venue update request to review.");
  if (decision === "rejected" && !adminNotes) redirectWithMessage("Add a short reason so the venue owner knows what to change.");

  const { data: request, error: requestError } = await supabase
    .from("vendor_update_requests")
    .select("id, venue_id, vendor_user_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (requestError || !request) redirectWithMessage(requestError?.message ?? "That venue update request could not be found.");
  if (request.status !== "pending") redirectWithMessage("That venue update request has already been reviewed.");

  const [{ data: venue }, { data: vendorProfile }] = await Promise.all([
    supabase.from("venues").select("id, name, slug").eq("id", request.venue_id).maybeSingle(),
    supabase.from("profiles").select("email").eq("id", request.vendor_user_id).maybeSingle()
  ]);
  if (!venue) redirectWithMessage("The venue linked to this request could not be found.");

  const { data: reviewed, error } = await supabase.rpc("review_vendor_update_request", {
    p_request_id: request.id,
    p_decision: decision,
    p_admin_notes: adminNotes
  });
  if (error) redirectWithMessage(error.message);
  if (!reviewed?.length) redirectWithMessage("The review was not completed. Refresh the queue and try again.");

  await notifyVendorUpdateReviewed({
    requestId: request.id,
    venueName: venue.name,
    venueSlug: venue.slug,
    vendorEmail: vendorProfile?.email ?? null,
    status: decision,
    adminNotes
  });

  revalidatePath("/admin");
  revalidatePath("/admin/updates");
  revalidatePath("/vendor");
  revalidatePath("/venues");
  revalidatePath(`/venues/${venue.slug}`);

  redirectWithMessage(decision === "approved"
    ? `${venue.name} updates approved and published.`
    : `${venue.name} updates returned to the venue owner.`);
}

function redirectWithMessage(message: string): never {
  redirect(`/admin/updates?message=${encodeURIComponent(message)}`);
}
