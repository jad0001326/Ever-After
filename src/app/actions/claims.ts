"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { notifyClaimReviewed, notifyClaimSubmitted } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";

export type ClaimState = { ok: boolean; message: string } | null;

function requiredText(formData: FormData, key: string) {
  return formData.get(key)?.toString().trim() ?? "";
}

export async function submitVenueClaim(_: ClaimState, formData: FormData): Promise<ClaimState> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Supabase is not configured, so claims cannot be stored yet." };

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const slug = requiredText(formData, "slug");
  if (!user) {
    redirect(`/login?message=Sign+in+to+claim+this+listing&redirectTo=${encodeURIComponent(`/venues/${slug}/claim`)}`);
  }

  const venueId = requiredText(formData, "venueId");
  const claimantName = requiredText(formData, "claimantName");
  const businessEmail = requiredText(formData, "businessEmail");
  const claimantRole = requiredText(formData, "claimantRole");
  const businessPhone = requiredText(formData, "businessPhone");
  const message = requiredText(formData, "message");
  const evidenceUrl = requiredText(formData, "evidenceUrl");
  const authorised = formData.get("authorised") === "on";
  const permissionConfirmed = formData.get("permissionConfirmed") === "on";
  const termsAccepted = formData.get("termsAccepted") === "on";

  if (!venueId || !claimantName || !businessEmail || !claimantRole || !businessPhone || !message) {
    return { ok: false, message: "Please complete all required fields." };
  }

  if (!businessEmail.includes("@")) return { ok: false, message: "Please use a valid business email." };

  if (!authorised || !permissionConfirmed || !termsAccepted) {
    return { ok: false, message: "Please confirm the authorisations and display permissions before submitting." };
  }

  const { data: existing } = await supabase
    .from("venue_claims")
    .select("id, status")
    .eq("venue_id", venueId)
    .eq("claimant_user_id", user.id)
    .in("status", ["pending", "approved"])
    .maybeSingle();

  if (existing) return { ok: false, message: existing.status === "approved" ? "This claim has already been approved." : "You already have a claim under review for this venue." };

  const { data: claim, error } = await supabase.from("venue_claims").insert({
    venue_id: venueId,
    claimant_user_id: user.id,
    claimant_name: claimantName,
    claimant_email: user.email ?? businessEmail,
    claimant_role: claimantRole,
    business_email: businessEmail,
    business_phone: businessPhone,
    message,
    evidence_url: evidenceUrl || null,
    status: "pending",
    permission_confirmed: permissionConfirmed,
    terms_accepted: termsAccepted
  }).select("id").single();

  if (error) return { ok: false, message: error.message };

  await supabase.from("venues").update({ claim_status: "pending" }).eq("id", venueId).eq("claim_status", "unclaimed");
  const { data: venue } = await supabase.from("venues").select("name, slug").eq("id", venueId).maybeSingle();

  if (claim && venue) {
    await notifyClaimSubmitted({
      claimId: claim.id,
      venueName: venue.name,
      venueSlug: venue.slug,
      claimantName,
      claimantEmail: user.email ?? businessEmail,
      businessEmail,
      businessPhone,
      claimantRole,
      message
    });
  }

  revalidatePath(`/venues/${slug}`);
  revalidatePath("/admin/claims");
  return { ok: true, message: "Your claim has been submitted for review." };
}

export async function approveVenueClaim(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  if (!supabase) redirect("/login?message=Configure+Supabase+environment+variables+first");

  const claimId = requiredText(formData, "claimId");
  const adminNotes = requiredText(formData, "adminNotes") || null;
  const { data: claim, error: claimError } = await supabase
    .from("venue_claims")
    .select("*")
    .eq("id", claimId)
    .single();

  if (claimError || !claim) redirect(`/admin/claims/${claimId}?message=${encodeURIComponent(claimError?.message ?? "Claim not found")}`);

  const { data: venue } = await supabase.from("venues").select("id, name, slug").eq("id", claim.venue_id).single();
  const { data: vendor } = await supabase.from("vendors").select("id").eq("contact_email", claim.business_email).maybeSingle();

  const vendorId = vendor?.id ?? (await supabase
    .from("vendors")
    .insert({
      name: venue?.name ?? claim.claimant_name,
      contact_email: claim.business_email,
      contact_phone: claim.business_phone
    })
    .select("id")
    .single()).data?.id;

  if (vendorId) {
    await supabase.from("vendor_users").upsert({
      vendor_id: vendorId,
      user_id: claim.claimant_user_id,
      role: claim.claimant_role || "owner",
      status: "active"
    });
  }

  await supabase.from("venues").update({
    is_claimed: true,
    claim_status: "approved",
    listing_status: "claimed",
    image_permission_status: "approved",
    image_is_representative: false,
    claimed_by: claim.claimant_user_id,
    claimed_at: new Date().toISOString(),
    vendor_contact_email: claim.business_email,
    vendor_contact_source_url: null,
    vendor_contact_verified_at: null,
    vendor_contact_verified_by: null,
    invite_status: "claimed"
  }).eq("id", claim.venue_id);

  await supabase.from("venue_claims").update({
    status: "approved",
    admin_notes: adminNotes,
    reviewed_at: new Date().toISOString(),
    reviewed_by: user.id
  }).eq("id", claim.id);

  await supabase.from("venue_claim_audit_log").insert({
    claim_id: claim.id,
    venue_id: claim.venue_id,
    admin_user_id: user.id,
    action: "approved",
    notes: adminNotes
  });

  if (venue) {
    await notifyClaimReviewed({
      claimId: claim.id,
      venueName: venue.name,
      venueSlug: venue.slug,
      claimantEmail: claim.claimant_email,
      businessEmail: claim.business_email,
      status: "approved",
      adminNotes
    });
  }

  revalidatePath("/admin/claims");
  revalidatePath(`/admin/claims/${claim.id}`);
  if (venue?.slug) revalidatePath(`/venues/${venue.slug}`);
  redirect(`/admin/claims/${claim.id}?message=Claim+approved`);
}

export async function rejectVenueClaim(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  if (!supabase) redirect("/login?message=Configure+Supabase+environment+variables+first");

  const claimId = requiredText(formData, "claimId");
  const adminNotes = requiredText(formData, "adminNotes") || null;
  const { data: claim, error } = await supabase.from("venue_claims").select("*").eq("id", claimId).single();
  if (error || !claim) redirect(`/admin/claims/${claimId}?message=${encodeURIComponent(error?.message ?? "Claim not found")}`);
  const { data: venue } = await supabase.from("venues").select("id, name, slug").eq("id", claim.venue_id).maybeSingle();

  await supabase.from("venue_claims").update({
    status: "rejected",
    admin_notes: adminNotes,
    reviewed_at: new Date().toISOString(),
    reviewed_by: user.id
  }).eq("id", claim.id);

  await supabase.from("venues").update({
    is_claimed: false,
    claim_status: "rejected",
    claimed_by: null,
    claimed_at: null
  }).eq("id", claim.venue_id).neq("claim_status", "approved");

  await supabase.from("venue_claim_audit_log").insert({
    claim_id: claim.id,
    venue_id: claim.venue_id,
    admin_user_id: user.id,
    action: "rejected",
    notes: adminNotes
  });

  if (venue) {
    await notifyClaimReviewed({
      claimId: claim.id,
      venueName: venue.name,
      venueSlug: venue.slug,
      claimantEmail: claim.claimant_email,
      businessEmail: claim.business_email,
      status: "rejected",
      adminNotes
    });
  }

  revalidatePath("/admin/claims");
  revalidatePath(`/admin/claims/${claim.id}`);
  if (venue?.slug) revalidatePath(`/venues/${venue.slug}`);
  redirect(`/admin/claims/${claim.id}?message=Claim+rejected`);
}
