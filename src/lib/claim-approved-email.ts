import { escapeHtml } from "@/lib/outreach-email";
import { absoluteUrl } from "@/lib/utils";
import { MAX_IMAGE_FILES_PER_BATCH, MAX_ORIGINAL_IMAGE_BYTES } from "@/lib/venue-image-submissions";

export type ClaimApprovedEmailInput = {
  venueName: string;
  venueSlug: string;
  claimantName: string;
  claimantEmail: string;
  adminNotes: string | null;
};

export function buildClaimApprovedEmail(input: ClaimApprovedEmailInput) {
  const venueName = cleanDisplayText(input.venueName);
  const claimantName = cleanDisplayText(input.claimantName);
  const accountEmail = input.claimantEmail.trim();
  const maxOriginalImageMegabytes = MAX_ORIGINAL_IMAGE_BYTES / (1024 * 1024);
  const subject = cleanSubject(`Welcome to EverAft — ${venueName} is now claimed`);
  const preheader = `Your EverAft vendor dashboard for ${venueName} is ready.`;
  const dashboardUrl = absoluteUrl("/vendor");
  const listingUrl = absoluteUrl(`/venues/${input.venueSlug}`);
  const heroUrl = absoluteUrl("/images/everaft-wedding-reception.png");
  const privacyUrl = absoluteUrl("/privacy");
  const greeting = claimantName ? `Hi ${claimantName},` : `Hi ${venueName} team,`;
  const adminNote = input.adminNotes?.trim() || null;

  const text = [
    greeting,
    "",
    `Welcome to EverAft. Your claim for ${venueName} has been approved, and the listing is now marked “Managed by venue”.`,
    "",
    "YOUR ACCESS",
    `Management access is linked to ${accountEmail}. Sign in with the same EverAft account used to submit the claim.`,
    `Open your vendor dashboard: ${dashboardUrl}`,
    `View your live listing: ${listingUrl}`,
    "",
    "GET STARTED",
    "1. Open the vendor dashboard and review the listing-health suggestions.",
    "2. Open your live listing and check every public detail.",
    "3. To request a change, edit the venue name, official website, gallery link, summary or description; add a review note; then select “Request review”.",
    `4. To add photography, choose “Add venue photography”. You can submit up to ${MAX_IMAGE_FILES_PER_BATCH} JPEG, PNG or WebP images at a time, up to ${maxOriginalImageMegabytes} MB each. Add a visual description and optional credit, choose a preferred main image, confirm you have display permission, then select “Submit [number] for review”.`,
    "5. EverAft will review requested changes and photography before publishing them. Their status will remain visible in your dashboard.",
    "",
    "COUPLE ENQUIRIES",
    "New enquiries sent through your listing will appear in the dashboard. Open each lead, follow up directly, and update its status to New, Contacted, Converted or Closed.",
    ...(adminNote ? ["", "A NOTE FROM THE EVERAFT TEAM", adminNote] : []),
    "",
    "FOUNDING VENUE PARTNER",
    `We’re delighted to welcome ${venueName} to EverAft’s founding venue collection. The launch-period founding partner offer shown in your dashboard remains available.`,
    "",
    "MAY WE SHARE THE NEWS?",
    "If you are happy for EverAft to announce your claimed listing and tag your official social account, reply “yes” with your preferred Instagram or Facebook handle. We will not announce it unless you confirm.",
    "",
    "If you need help or want us to review something not covered by the form, reply to this email.",
    "",
    "Best,",
    "James",
    "EverAft",
    "james@everaft.co.uk",
    "",
    `Privacy: ${privacyUrl}`
  ].join("\n");

  const adminNoteHtml = adminNote
    ? `<tr>
              <td style="padding:0 42px 34px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#fff9ef;border:1px solid #e5d5b7;border-radius:18px;">
                  <tr>
                    <td style="padding:23px 24px;">
                      <div style="color:#95502b;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">A note from the EverAft team</div>
                      <div style="margin-top:10px;color:#4d483f;font-size:14px;line-height:1.7;">${formatMultiline(adminNote)}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`
    : "";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f2ede4;color:#1a2019;font-family:Inter,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f2ede4;">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#fbfaf7;border:1px solid #ddd6cb;border-radius:24px;overflow:hidden;">
            <tr>
              <td align="center" style="padding:27px 28px 23px;background:#24432f;">
                <div style="width:118px;height:13px;border-top:1px solid #bc845f;border-radius:50%;opacity:.9;"></div>
                <div style="margin-top:-4px;color:#fff;font-family:Georgia,'Times New Roman',serif;font-size:35px;font-weight:600;letter-spacing:2px;line-height:1;">EverAft</div>
                <div style="margin-top:8px;color:#e8d4c0;font-size:11px;font-weight:700;letter-spacing:2.2px;text-transform:uppercase;">Wedding venue discovery</div>
              </td>
            </tr>
            <tr>
              <td style="padding:0;">
                <img src="${escapeAttribute(heroUrl)}" width="620" alt="An elegant wedding reception" style="display:block;width:100%;height:auto;max-height:300px;object-fit:cover;border:0;">
              </td>
            </tr>
            <tr>
              <td style="padding:42px 42px 20px;">
                <div style="color:#9c542d;font-size:12px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">Claim approved · ${escapeHtml(venueName)}</div>
                <h1 style="margin:14px 0 20px;color:#152017;font-family:Georgia,'Times New Roman',serif;font-size:39px;line-height:1.08;font-weight:600;letter-spacing:-.5px;">Welcome to EverAft.</h1>
                <p style="margin:0 0 18px;color:#4d483f;font-size:16px;line-height:1.75;">${escapeHtml(greeting)}</p>
                <p style="margin:0 0 18px;color:#4d483f;font-size:16px;line-height:1.75;">Your claim for <strong style="color:#152017;">${escapeHtml(venueName)}</strong> has been approved, and the listing is now marked <strong style="color:#152017;">Managed by venue</strong>.</p>
                <p style="margin:0;color:#4d483f;font-size:16px;line-height:1.75;">Your dashboard is ready for you to review the listing, send changes for approval, add permitted photography and manage couple enquiries.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 42px 33px;">
                <a href="${escapeAttribute(dashboardUrl)}" style="display:inline-block;padding:15px 26px;border-radius:999px;background:#24432f;color:#fff;font-size:15px;font-weight:700;text-decoration:none;">Open your vendor dashboard</a>
                <div style="margin-top:16px;font-size:13px;line-height:1.6;color:#625f57;">
                  <a href="${escapeAttribute(listingUrl)}" style="color:#35533e;font-weight:700;text-decoration:underline;text-underline-offset:3px;">View your live listing</a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 42px 34px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f4efe7;border:1px solid #e3d8c9;border-radius:18px;">
                  <tr>
                    <td style="padding:23px 24px;">
                      <div style="color:#95502b;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Your account access</div>
                      <div style="margin-top:10px;color:#4d483f;font-size:14px;line-height:1.7;">Management access is linked to <strong style="color:#152017;">${escapeHtml(accountEmail)}</strong>. Sign in with the same EverAft account used to submit the claim.</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 42px 34px;">
                <div style="color:#9c542d;font-size:12px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">Get started</div>
                <h2 style="margin:10px 0 19px;color:#152017;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;font-weight:600;">Your first five steps</h2>
                ${stepRow("1", "Open your dashboard", "Review the listing-health suggestions for your venue.")}
                ${stepRow("2", "Check the live listing", "Open the public page and read through every detail as a couple would.")}
                ${stepRow("3", "Request any changes", "Edit the venue name, official website, gallery link, summary or description. Add a review note, then select “Request review”.")}
                ${stepRow("4", "Add venue photography", `Choose up to ${MAX_IMAGE_FILES_PER_BATCH} JPEG, PNG or WebP images of up to ${maxOriginalImageMegabytes} MB each, add a visual description and optional credit, pick a preferred main image, confirm display permission, then select “Submit [number] for review”.`)}
                ${stepRow("5", "Follow the review status", "Changes and photos stay in review until EverAft approves them. You can see their status in the dashboard.")}
              </td>
            </tr>
            <tr>
              <td style="padding:0 42px 34px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f4efe7;border:1px solid #e3d8c9;border-radius:18px;">
                  <tr>
                    <td style="padding:23px 24px;">
                      <div style="color:#95502b;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Couple enquiries</div>
                      <div style="margin-top:10px;color:#4d483f;font-size:14px;line-height:1.7;">New enquiries sent through your listing appear automatically in the dashboard. Open each lead, follow up directly, and update its status to <strong style="color:#152017;">New, Contacted, Converted</strong> or <strong style="color:#152017;">Closed</strong>.</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${adminNoteHtml}
            <tr>
              <td style="padding:0 42px 34px;">
                <div style="color:#9c542d;font-size:12px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">Founding venue partner</div>
                <h2 style="margin:10px 0 13px;color:#152017;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;font-weight:600;">We’re delighted to have you with us.</h2>
                <p style="margin:0;color:#4d483f;font-size:15px;line-height:1.75;">Welcome to EverAft’s founding venue collection. The launch-period founding partner offer shown in your dashboard remains available.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 42px 34px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#fff9ef;border:1px solid #e5d5b7;border-radius:18px;">
                  <tr>
                    <td style="padding:23px 24px;">
                      <div style="color:#95502b;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">May we share the news?</div>
                      <div style="margin-top:10px;color:#4d483f;font-size:14px;line-height:1.7;">If you are happy for EverAft to announce your claimed listing and tag your official social account, reply “yes” with your preferred Instagram or Facebook handle. We will not announce it unless you confirm.</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 42px 42px;color:#4d483f;font-size:15px;line-height:1.7;">
                <p style="margin:0 0 18px;">If you need help or want us to review something not covered by the form, just reply to this email.</p>
                <p style="margin:0;">Best,<br><strong style="color:#152017;">James</strong><br>EverAft</p>
              </td>
            </tr>
            <tr>
              <td style="padding:25px 34px;background:#ebe3d8;color:#625f57;font-size:11px;line-height:1.7;text-align:center;">
                <strong style="color:#24432f;">EverAft</strong> · Curated wedding planning<br>
                You received this service email because the EverAft claim for ${escapeHtml(venueName)} was approved.<br>
                Reply to <a href="mailto:james@everaft.co.uk" style="color:#35533e;">james@everaft.co.uk</a> ·
                <a href="${escapeAttribute(privacyUrl)}" style="color:#35533e;">Privacy</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, preheader, text, html };
}

function cleanSubject(value: string) {
  return value.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 200);
}

function cleanDisplayText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function formatMultiline(value: string) {
  return escapeHtml(value).replaceAll("\n", "<br>");
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}

function stepRow(number: string, title: string, copy: string) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin-bottom:14px;">
                  <tr>
                    <td valign="top" width="38" style="width:38px;padding-top:1px;">
                      <div style="width:28px;height:28px;border-radius:50%;background:#24432f;color:#fff;font-size:13px;font-weight:700;line-height:28px;text-align:center;">${escapeHtml(number)}</div>
                    </td>
                    <td valign="top" style="color:#4d483f;font-size:14px;line-height:1.65;">
                      <strong style="display:block;color:#152017;font-size:15px;">${escapeHtml(title)}</strong>
                      ${escapeHtml(copy)}
                    </td>
                  </tr>
                </table>`;
}
