import { absoluteUrl } from "@/lib/utils";

type EmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string | string[];
  idempotencyKey?: string;
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

export async function sendEmail({ html, idempotencyKey, replyTo, subject, text, to }: EmailInput) {
  const { apiKey, from, replyTo: defaultReplyTo } = emailConfig();
  const recipients = Array.isArray(to) ? to : [to];

  if (!apiKey || !from || recipients.length === 0) {
    console.info(`Email skipped: ${subject}`);
    return { ok: false, skipped: true };
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
        reply_to: replyTo ?? defaultReplyTo
      })
    });

    if (!response.ok) {
      console.error(`Email failed: ${subject} (${response.status})`);
      return { ok: false, skipped: false };
    }

    return { ok: true, skipped: false };
  } catch (error) {
    console.error(`Email failed: ${subject}`, error);
    return { ok: false, skipped: false };
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
