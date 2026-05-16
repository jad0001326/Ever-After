"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EnquiryState = { ok: boolean; message: string } | null;

export async function createEnquiry(_: EnquiryState, formData: FormData): Promise<EnquiryState> {
  const venueId = formData.get("venueId")?.toString();
  const name = formData.get("name")?.toString();
  const email = formData.get("email")?.toString();
  const message = formData.get("message")?.toString();

  if (!venueId || !name || !email || !message) {
    return { ok: false, message: "Please complete the required fields." };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: true, message: "Demo enquiry captured. Connect Supabase to store submissions." };

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("enquiries").insert({
    venue_id: venueId,
    user_id: user?.id ?? null,
    name,
    email,
    phone: formData.get("phone")?.toString() || null,
    wedding_date: formData.get("weddingDate")?.toString() || null,
    guest_count: Number(formData.get("guestCount")) || null,
    message
  });

  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin");
  return { ok: true, message: "Enquiry sent. The venue team can follow up from the admin dashboard." };
}
