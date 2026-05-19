"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireUser } from "@/lib/auth";
import { notifyNewEnquiry } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";

export type EnquiryState = { ok: boolean; message: string } | null;

const enquiryStatuses = ["new", "contacted", "converted", "closed"] as const;

type EnquiryStatus = (typeof enquiryStatuses)[number];

function cleanText(value: FormDataEntryValue | null) {
  return value?.toString().trim() ?? "";
}

function isEnquiryStatus(value: string): value is EnquiryStatus {
  return enquiryStatuses.includes(value as EnquiryStatus);
}

export async function createEnquiry(_: EnquiryState, formData: FormData): Promise<EnquiryState> {
  const venueId = cleanText(formData.get("venueId"));
  const name = cleanText(formData.get("name"));
  const email = cleanText(formData.get("email")).toLowerCase();
  const message = cleanText(formData.get("message"));
  const website = cleanText(formData.get("website"));

  if (!venueId || !name || !email || !message) {
    return { ok: false, message: "Please complete the required fields." };
  }

  if (website) {
    return { ok: false, message: "We could not send this enquiry. Please try again." };
  }

  if (!email.includes("@") || message.length < 10) {
    return { ok: false, message: "Please add a valid email address and a short message." };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Supabase is not configured, so enquiries cannot be stored yet." };

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const phone = cleanText(formData.get("phone")) || null;
  const weddingDate = cleanText(formData.get("weddingDate")) || null;
  const guestCount = Number(cleanText(formData.get("guestCount"))) || null;

  const { data: enquiry, error } = await supabase.from("enquiries").insert({
    venue_id: venueId,
    user_id: user?.id ?? null,
    name,
    email,
    phone,
    wedding_date: weddingDate,
    guest_count: guestCount,
    message
  }).select("id").single();

  if (error) return { ok: false, message: error.message };

  const { data: venue } = await supabase
    .from("venues")
    .select("name, slug, vendor_contact_email")
    .eq("id", venueId)
    .maybeSingle();

  if (venue && enquiry) {
    await notifyNewEnquiry({
      enquiryId: enquiry.id,
      venueName: venue.name,
      venueSlug: venue.slug,
      vendorEmail: venue.vendor_contact_email,
      coupleName: name,
      coupleEmail: email,
      phone,
      weddingDate,
      guestCount,
      message
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/enquiries");
  revalidatePath("/vendor");
  return { ok: true, message: "Enquiry sent. The venue team can follow up shortly." };
}

export async function updateEnquiryStatus(formData: FormData) {
  await requireAdmin();
  const enquiryId = cleanText(formData.get("enquiryId"));
  const status = cleanText(formData.get("status"));

  if (!enquiryId || !isEnquiryStatus(status)) redirect("/admin/enquiries?message=Choose+a+valid+lead+status");

  const supabase = await createClient();
  const { error } = await supabase!.from("enquiries").update({ status }).eq("id", enquiryId);

  if (error) redirect(`/admin/enquiries?message=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin");
  revalidatePath("/admin/enquiries");
  revalidatePath("/vendor");
  redirect("/admin/enquiries?message=Lead+updated");
}

export async function updateVendorEnquiryStatus(formData: FormData) {
  const { user, supabase } = await requireUser("/vendor", "Sign in to manage your leads");
  const enquiryId = cleanText(formData.get("enquiryId"));
  const status = cleanText(formData.get("status"));

  if (!enquiryId || !isEnquiryStatus(status)) redirect("/vendor?message=Choose+a+valid+lead+status");

  const { data: enquiry, error: enquiryError } = await supabase!
    .from("enquiries")
    .select("id, venue_id")
    .eq("id", enquiryId)
    .maybeSingle();

  if (enquiryError || !enquiry) redirect(`/vendor?message=${encodeURIComponent(enquiryError?.message ?? "Lead not found")}`);

  const { data: venue, error: venueError } = await supabase!
    .from("venues")
    .select("id")
    .eq("id", enquiry.venue_id)
    .eq("claimed_by", user.id)
    .eq("is_claimed", true)
    .maybeSingle();

  if (venueError || !venue) redirect(`/vendor?message=${encodeURIComponent(venueError?.message ?? "Lead access denied")}`);

  const { error } = await supabase!.from("enquiries").update({ status }).eq("id", enquiryId);

  if (error) redirect(`/vendor?message=${encodeURIComponent(error.message)}`);
  revalidatePath("/vendor");
  revalidatePath("/admin/enquiries");
  redirect("/vendor?message=Lead+updated");
}
