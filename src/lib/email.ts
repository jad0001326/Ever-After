import { absoluteUrl } from "@/lib/utils";

export type EmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string | string[];
  idempotencyKey?: string;
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
};

export type EmailSendResult = {
  ok: boolean;
  skipped: boolean;
  id?: string;
  error?: string;
};

type EnquiryNotification = {
  enquiryId: string;
  venueName: string;
  venueSlug: string;
  vendorEmail: string | null;
  coupleName: string;
  coupleEmail: string;
  phone: string | null;
  weddingDate: string | null;
  guestCount: number | null;
  message: string;
};

type ClaimNotification = {
  claimId: string;
  venueName: string;
  venueSlug: string;
  claimantName: string;
  claimantEmail: string;
  businessEmail: string;
  businessPhone: string;
  claimantRole: string;
  message: string;
};

type ClaimReviewedNotification = {
  claimId: string;
  venueName: string;
  venueSlug: string;
  claimantEmail: string;
  businessEmail: string;
  status: "approved" | "rejected";
  adminNotes: string | null;
};

type VendorUpdateNotification = {
  requestId: string;
  venueName: string;
  venueSlug: string;
  requesterEmail: string | null;
  requestedMessage: string;
};

export type VenueImagesSubmittedNotification = {
  submissionId: string;
  venueName: string;
  venueSlug: string;
  requesterEmail: string | null;
  imageCount: number;
};

export type VenueImageReviewedNotification = {
  submissionId: string;
  venueName: string;
  venueSlug: string;
  vendorEmail: string | null;
  status: "approved" | "rejected";
  adminNotes: string | null;
};

type NewsletterConfirmation = {
  email: string;
  confirmationUrl: string;
  unsubscribeUrl: string;
  idempotencyKey: string;
};

type SupplierApplicationNotification = {
  applicationId: string;
  businessName: string;
  ownerName: string;
  email: string;
  category: string;
  location: string;
};

type ContactMessageNotification = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

const resendUrl = "https://api.resend.com/emails";

function emailConfig() {
  return {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM_EMAIL ?? process.env.EMAIL_FROM,
    adminTo: splitEmails(process.env.ADMIN_NOTIFICATION_EMAIL ?? process.env.EMAIL_ADMIN_TO),
    replyTo: process.env.REPLY_TO_EMAIL ?? process.env.EMAIL_REPLY_TO
  };
}

function splitEmails(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function uniqueEmails(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.flatMap((value) => splitEmails(value ?? undefined))));
}

function htmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function textToHtml(text: string) {
  return text
    .split("\n")
    .map((line) => (line.trim() ? `<p>${htmlEscape(line)}</p>` : "<br />"))
    .join("");
}

export function emailNotificationsEnabled() {
  const { apiKey, from } = emailConfig();
  return Boolean(apiKey && from);
}

export async function sendEmail({ headers, html, idempotencyKey, replyTo, subject, tags, text, to }: EmailInput) {
  const { apiKey, from, replyTo: defaultReplyTo } = emailConfig();
  const recipients = Array.isArray(to) ? to : [to];

  if (!apiKey || !from || recipients.length === 0) {
    console.info(`Email skipped: ${subject}`);
    return { ok: false, skipped: true, error: "Email delivery is not configured." } satisfies EmailSendResult;
  }

  try {
    const response = await fetch(resendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject,
        text,
        html: html ?? textToHtml(text),
        reply_to: replyTo ?? defaultReplyTo,
        headers,
        tags
      })
    });

    if (!response.ok) {
      console.error(`Email failed: ${subject} (${response.status})`);
      return { ok: false, skipped: false, error: `Resend returned ${response.status}.` } satisfies EmailSendResult;
    }

    const data = (await response.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, skipped: false, id: data?.id } satisfies EmailSendResult;
  } catch (error) {
    console.error(`Email failed: ${subject}`, error);
    return { ok: false, skipped: false, error: "The email request failed." } satisfies EmailSendResult;
  }
}

export async function sendEmailBatch(messages: EmailInput[], idempotencyKey: string): Promise<EmailSendResult[]> {
  const { apiKey, from, replyTo: defaultReplyTo } = emailConfig();

  if (messages.length === 0) return [];
  if (messages.length > 100) throw new Error("Resend batches are limited to 100 emails.");
  if (!apiKey || !from) {
    return messages.map(() => ({ ok: false, skipped: true, error: "Email delivery is not configured." }));
  }

  try {
    const response = await fetch(`${resendUrl}/batch`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify(
        messages.map(({ headers, html, replyTo, subject, tags, text, to }) => ({
          from,
          to: Array.isArray(to) ? to : [to],
          subject,
          text,
          html: html ?? textToHtml(text),
          reply_to: replyTo ?? defaultReplyTo,
          headers,
          tags
        }))
      )
    });

    if (!response.ok) {
      console.error(`Email batch failed (${response.status})`);
      return messages.map(() => ({ ok: false, skipped: false, error: `Resend returned ${response.status}.` }));
    }

    const data = (await response.json().catch(() => null)) as { data?: Array<{ id?: string }> } | null;
    return messages.map((_, index) => ({
      ok: Boolean(data?.data?.[index]?.id),
      skipped: false,
      id: data?.data?.[index]?.id,
      error: data?.data?.[index]?.id ? undefined : "Resend did not return a delivery ID."
    }));
  } catch (error) {
    console.error("Email batch failed", error);
    return messages.map(() => ({ ok: false, skipped: false, error: "The email batch request failed." }));
  }
}

async function sendAll(messages: EmailInput[]) {
  await Promise.allSettled(messages.map((message) => sendEmail(message)));
}

export async function notifyNewEnquiry(input: EnquiryNotification) {
  const { adminTo, replyTo } = emailConfig();
  const venueUrl = absoluteUrl(`/venues/${input.venueSlug}`);
  const adminUrl = absoluteUrl("/admin/enquiries");
  const details = [
    `Venue: ${input.venueName}`,
    `Couple: ${input.coupleName}`,
    `Email: ${input.coupleEmail}`,
    input.phone ? `Phone: ${input.phone}` : null,
    input.weddingDate ? `Wedding date: ${input.weddingDate}` : null,
    input.guestCount ? `Guest count: ${input.guestCount}` : null,
    "",
    input.message
  ].filter((line): line is string => line !== null);

  const messages: EmailInput[] = [];
  if (adminTo.length > 0) {
    messages.push({
      to: adminTo,
      replyTo: input.coupleEmail,
      subject: `New enquiry for ${input.venueName}`,
      text: [...details, "", `Admin inbox: ${adminUrl}`, `Venue listing: ${venueUrl}`].join("\n"),
      idempotencyKey: `enquiry-admin-${input.enquiryId}`
    });
  }

  if (input.vendorEmail) {
    messages.push({
      to: input.vendorEmail,
      replyTo: input.coupleEmail,
      subject: `New EverAft enquiry for ${input.venueName}`,
      text: [
        `Hello ${input.venueName} team,`,
        "",
        "A couple has sent an enquiry through your EverAft listing.",
        "",
        ...details.slice(1),
        "",
        `Venue listing: ${venueUrl}`
      ].join("\n"),
      idempotencyKey: `enquiry-vendor-${input.enquiryId}`
    });
  }

  messages.push({
    to: input.coupleEmail,
    replyTo,
    subject: `We received your enquiry for ${input.venueName}`,
    text: [
      `Hi ${input.coupleName},`,
      "",
      `Thanks for enquiring with ${input.venueName}. Your message has been received and the venue team can follow up shortly.`,
      "",
      "Your message:",
      input.message,
      "",
      `Venue listing: ${venueUrl}`
    ].join("\n"),
    idempotencyKey: `enquiry-couple-${input.enquiryId}`
  });

  await sendAll(messages);
}

export async function notifyClaimSubmitted(input: ClaimNotification) {
  const { adminTo } = emailConfig();
  if (adminTo.length === 0) return;

  await sendEmail({
    to: adminTo,
    replyTo: input.businessEmail,
    subject: `New venue claim for ${input.venueName}`,
    text: [
      `Venue: ${input.venueName}`,
      `Claimant: ${input.claimantName}`,
      `Role: ${input.claimantRole}`,
      `Account email: ${input.claimantEmail}`,
      `Business email: ${input.businessEmail}`,
      `Business phone: ${input.businessPhone}`,
      "",
      input.message,
      "",
      `Review claim: ${absoluteUrl(`/admin/claims/${input.claimId}`)}`,
      `Venue listing: ${absoluteUrl(`/venues/${input.venueSlug}`)}`
    ].join("\n"),
    idempotencyKey: `claim-submitted-${input.claimId}`
  });
}

export async function notifyClaimReviewed(input: ClaimReviewedNotification) {
  const recipients = uniqueEmails([input.claimantEmail, input.businessEmail]);
  if (recipients.length === 0) return;

  const approved = input.status === "approved";
  await sendEmail({
    to: recipients,
    subject: approved ? `Your EverAft claim for ${input.venueName} was approved` : `Your EverAft claim for ${input.venueName} was reviewed`,
    text: [
      `Hello,`,
      "",
      approved
        ? `Your claim for ${input.venueName} has been approved. You can now manage the listing from the vendor dashboard.`
        : `Your claim for ${input.venueName} was not approved at this stage.`,
      input.adminNotes ? `Admin note: ${input.adminNotes}` : null,
      "",
      approved ? `Vendor dashboard: ${absoluteUrl("/vendor")}` : `Venue listing: ${absoluteUrl(`/venues/${input.venueSlug}`)}`
    ].filter((line): line is string => line !== null).join("\n"),
    idempotencyKey: `claim-${input.status}-${input.claimId}`
  });
}

export async function notifyVendorUpdateRequested(input: VendorUpdateNotification) {
  const { adminTo } = emailConfig();
  if (adminTo.length === 0) return;

  await sendEmail({
    to: adminTo,
    replyTo: input.requesterEmail ?? undefined,
    subject: `Vendor update request for ${input.venueName}`,
    text: [
      `Venue: ${input.venueName}`,
      input.requesterEmail ? `Requester: ${input.requesterEmail}` : null,
      "",
      input.requestedMessage,
      "",
      `Admin dashboard: ${absoluteUrl("/admin")}`,
      `Venue listing: ${absoluteUrl(`/venues/${input.venueSlug}`)}`
    ].filter((line): line is string => line !== null).join("\n"),
    idempotencyKey: `vendor-update-${input.requestId}`
  });
}

export async function notifyVenueImagesSubmitted(input: VenueImagesSubmittedNotification) {
  const { adminTo } = emailConfig();
  if (adminTo.length === 0) return;

  const imageLabel = input.imageCount === 1 ? "photo" : "photos";
  await sendEmail({
    to: adminTo,
    replyTo: input.requesterEmail ?? undefined,
    subject: `New venue ${imageLabel} for ${input.venueName}`,
    text: [
      `Venue: ${input.venueName}`,
      `Submitted: ${input.imageCount} ${imageLabel}`,
      input.requesterEmail ? `Submitted by: ${input.requesterEmail}` : null,
      "",
      `Review photos: ${absoluteUrl("/admin/images")}`,
      `Venue listing: ${absoluteUrl(`/venues/${input.venueSlug}`)}`
    ].filter((line): line is string => line !== null).join("\n"),
    idempotencyKey: `venue-images-submitted-${input.submissionId}`
  });
}

export async function notifyVenueImageReviewed(input: VenueImageReviewedNotification) {
  if (!input.vendorEmail) return;

  const approved = input.status === "approved";
  await sendEmail({
    to: input.vendorEmail,
    subject: approved
      ? `Your photo for ${input.venueName} is now live`
      : `Your photo for ${input.venueName} has been reviewed`,
    text: [
      "Hello,",
      "",
      approved
        ? `Your photo submission for ${input.venueName} has been approved and published on EverAft.`
        : `Your photo submission for ${input.venueName} was not approved for publication at this stage. You can review the note below and submit a replacement from your vendor dashboard.`,
      input.adminNotes ? `Admin note: ${input.adminNotes}` : null,
      "",
      `Vendor dashboard: ${absoluteUrl("/vendor")}`,
      approved ? `Venue listing: ${absoluteUrl(`/venues/${input.venueSlug}`)}` : null
    ].filter((line): line is string => line !== null).join("\n"),
    idempotencyKey: `venue-image-${input.status}-${input.submissionId}`
  });
}

export async function notifyNewsletterConfirmation(input: NewsletterConfirmation) {
  await sendEmail({
    to: input.email,
    subject: "Confirm your EverAft subscription",
    text: [
      "Hello,",
      "",
      "Please confirm that you would like to receive occasional EverAft planning inspiration and supplier finds.",
      "",
      `Confirm subscription: ${input.confirmationUrl}`,
      "",
      "If you did not request this, you can safely ignore this email.",
      `Unsubscribe: ${input.unsubscribeUrl}`
    ].join("\n"),
    idempotencyKey: input.idempotencyKey
  });
}

export async function notifySupplierApplication(input: SupplierApplicationNotification) {
  const { adminTo } = emailConfig();
  if (adminTo.length === 0) return;

  await sendEmail({
    to: adminTo,
    replyTo: input.email,
    subject: `New supplier application: ${input.businessName}`,
    text: [
      `Business: ${input.businessName}`,
      `Contact: ${input.ownerName}`,
      `Email: ${input.email}`,
      `Category: ${input.category}`,
      `Location: ${input.location}`,
      "",
      `Review application: ${absoluteUrl(`/admin/applications?application=${input.applicationId}`)}`
    ].join("\n"),
    idempotencyKey: `supplier-application-${input.applicationId}`
  });
}

export async function notifyContactMessage(input: ContactMessageNotification) {
  const { adminTo } = emailConfig();
  if (adminTo.length === 0) return;

  await sendEmail({
    to: adminTo,
    replyTo: input.email,
    subject: `EverAft contact: ${input.subject}`,
    text: [`From: ${input.name}`, `Email: ${input.email}`, "", input.message].join("\n"),
    idempotencyKey: `contact-${input.email}-${createContactKey(input.subject, input.message)}`
  });
}

function createContactKey(subject: string, message: string) {
  return Buffer.from(`${subject}:${message}`).toString("base64url").slice(0, 80);
}
