"use server";

import { allowPublicFormSubmission } from "@/lib/rate-limit";
import { emailNotificationsEnabled, notifyContactMessage } from "@/lib/email";

export type ContactState = { ok: boolean; message: string } | null;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendContactMessage(_: ContactState, formData: FormData): Promise<ContactState> {
  const name = formData.get("name")?.toString().trim().slice(0, 120) ?? "";
  const email = formData.get("email")?.toString().trim().toLowerCase().slice(0, 254) ?? "";
  const subject = formData.get("subject")?.toString().trim().slice(0, 160) ?? "";
  const message = formData.get("message")?.toString().trim().slice(0, 2_000) ?? "";
  const website = formData.get("website")?.toString().trim() ?? "";

  if (website) return { ok: true, message: "Thanks — we’ll be in touch." };
  if (!name || !emailPattern.test(email) || !subject || message.length < 10) {
    return { ok: false, message: "Please add your name, a valid email address, subject and a short message." };
  }
  if (!emailNotificationsEnabled()) return { ok: false, message: "Messages are temporarily unavailable. Please try again shortly." };
  if (!(await allowPublicFormSubmission("contact", 3))) return { ok: false, message: "Please wait a few minutes before trying again." };

  await notifyContactMessage({ name, email, subject, message });
  return { ok: true, message: "Thanks — your message has been sent." };
}
