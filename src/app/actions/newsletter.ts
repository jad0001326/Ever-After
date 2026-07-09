"use server";

import { createHash, randomBytes } from "node:crypto";
import { absoluteUrl } from "@/lib/utils";
import { allowPublicFormSubmission } from "@/lib/rate-limit";
import { emailNotificationsEnabled, notifyNewsletterConfirmation } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";

export type NewsletterState = { ok: boolean; message: string } | null;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function subscribeToNewsletter(_: NewsletterState, formData: FormData): Promise<NewsletterState> {
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const website = formData.get("website")?.toString().trim() ?? "";

  if (website) return { ok: true, message: "Thanks — please check your inbox to confirm." };
  if (!emailPattern.test(email) || email.length > 254) return { ok: false, message: "Enter a valid email address." };
  if (!emailNotificationsEnabled()) return { ok: false, message: "Newsletter sign-up is not live just yet. Please try again shortly." };
  if (!(await allowPublicFormSubmission("newsletter", 3))) return { ok: false, message: "Please wait a few minutes before trying again." };

  const supabase = createAdminClient();
  if (!supabase) return { ok: false, message: "Newsletter sign-up is temporarily unavailable." };

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const unsubscribeToken = randomBytes(32).toString("base64url");
  const unsubscribeTokenHash = createHash("sha256").update(unsubscribeToken).digest("hex");
  const { error } = await supabase.from("newsletter_subscribers").upsert(
    {
      email,
      status: "pending",
      confirmation_token_hash: tokenHash,
      unsubscribe_token_hash: unsubscribeTokenHash,
      confirmed_at: null
    },
    { onConflict: "email" }
  );

  if (error) return { ok: false, message: "We could not save your subscription. Please try again." };

  await notifyNewsletterConfirmation({
    email,
    confirmationUrl: absoluteUrl(`/newsletter/confirm?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`),
    unsubscribeUrl: absoluteUrl(`/newsletter/unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(unsubscribeToken)}`),
    idempotencyKey: `newsletter-confirm-${token}`
  });

  return { ok: true, message: "Check your inbox to confirm your subscription." };
}
