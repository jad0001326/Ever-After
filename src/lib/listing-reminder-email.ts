import { escapeHtml } from "@/lib/outreach-email";
import { absoluteUrl } from "@/lib/utils";

export type ListingReminderEmailInput = {
  venueName: string;
  venueSlug: string;
  recipientName: string;
  score: number;
  total: number;
  missing: string[];
};

export function buildListingReminderEmail(input: ListingReminderEmailInput) {
  const venueName = cleanDisplayText(input.venueName);
  const recipientName = cleanDisplayText(input.recipientName);
  const total = Math.max(1, Math.floor(input.total));
  const score = Math.min(total, Math.max(0, Math.floor(input.score)));
  const missing = input.missing.map(cleanDisplayText).filter(Boolean).slice(0, total);
  const subject = cleanSubject(`A quick reminder to finish ${venueName} on EverAft`);
  const preheader = `Your EverAft listing is ${score} of ${total} core details complete.`;
  const dashboardUrl = absoluteUrl("/vendor");
  const listingUrl = absoluteUrl(`/venues/${input.venueSlug}`);
  const heroUrl = absoluteUrl("/images/everaft-wedding-reception.png");
  const privacyUrl = absoluteUrl("/privacy");
  const greeting = recipientName ? `Hi ${recipientName},` : `Hi ${venueName} team,`;
  const nextStepLabel = missing.length === 1 ? "suggested next step" : "suggested next steps";

  const text = [
    greeting,
    "",
    `Your EverAft listing for ${venueName} still has ${missing.length} ${nextStepLabel}.`,
    `Listing health: ${score}/${total}`,
    "",
    ...missing.map((item) => `- ${sentenceCase(item)}`),
    "",
    `Complete your listing: ${dashboardUrl}`,
    `View your live listing: ${listingUrl}`,
    "",
    "Use the vendor dashboard to request listing changes or submit approved photography. EverAft reviews changes before they are published.",
    "If you have submitted updates recently, they may still be awaiting review and you do not need to send them again.",
    "",
    "If you need help, reply to this email.",
    "",
    "Best,",
    "James",
    "EverAft",
    "james@everaft.co.uk",
    "",
    `Privacy: ${privacyUrl}`
  ].join("\n");

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
                <div style="color:#9c542d;font-size:12px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">Listing reminder · ${escapeHtml(venueName)}</div>
                <h1 style="margin:14px 0 20px;color:#152017;font-family:Georgia,'Times New Roman',serif;font-size:39px;line-height:1.08;font-weight:600;letter-spacing:-.5px;">A few details left to finish.</h1>
                <p style="margin:0 0 18px;color:#4d483f;font-size:16px;line-height:1.75;">${escapeHtml(greeting)}</p>
                <p style="margin:0;color:#4d483f;font-size:16px;line-height:1.75;">Your EverAft listing for <strong style="color:#152017;">${escapeHtml(venueName)}</strong> has ${escapeHtml(String(missing.length))} ${escapeHtml(nextStepLabel)} remaining. Completing them helps couples see accurate, approved information from your team.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 42px 33px;">
                <a href="${escapeAttribute(dashboardUrl)}" style="display:inline-block;padding:15px 26px;border-radius:999px;background:#24432f;color:#fff;font-size:15px;font-weight:700;text-decoration:none;">Complete your listing</a>
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
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="color:#95502b;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Listing health</td>
                          <td align="right" style="color:#24432f;font-size:24px;font-weight:700;">${score}/${total}</td>
                        </tr>
                      </table>
                      <div style="height:8px;margin-top:13px;border-radius:999px;background:#ded5c8;overflow:hidden;">
                        <div style="width:${Math.round((score / total) * 100)}%;height:8px;border-radius:999px;background:#24432f;"></div>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 42px 34px;">
                <div style="color:#9c542d;font-size:12px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">Suggested next steps</div>
                <h2 style="margin:10px 0 19px;color:#152017;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;font-weight:600;">Finish the core details</h2>
                ${missing.map((item, index) => todoRow(String(index + 1), sentenceCase(item))).join("")}
              </td>
            </tr>
            <tr>
              <td style="padding:0 42px 34px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#fff9ef;border:1px solid #e5d5b7;border-radius:18px;">
                  <tr>
                    <td style="padding:23px 24px;">
                      <div style="color:#95502b;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">How updates work</div>
                      <div style="margin-top:10px;color:#4d483f;font-size:14px;line-height:1.7;">Use the vendor dashboard to request listing changes or submit approved photography. EverAft reviews changes before publishing them. If you have sent something recently, it may still be awaiting review and you do not need to submit it again.</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 42px 42px;color:#4d483f;font-size:15px;line-height:1.7;">
                <p style="margin:0 0 18px;">If you need help completing the listing, just reply to this email.</p>
                <p style="margin:0;">Best,<br><strong style="color:#152017;">James</strong><br>EverAft</p>
              </td>
            </tr>
            <tr>
              <td style="padding:25px 34px;background:#ebe3d8;color:#625f57;font-size:11px;line-height:1.7;text-align:center;">
                <strong style="color:#24432f;">EverAft</strong> · Curated wedding planning<br>
                You received this service email because your registered EverAft account manages ${escapeHtml(venueName)}.<br>
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

function todoRow(number: string, label: string) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin-bottom:14px;">
                  <tr>
                    <td valign="top" width="38" style="width:38px;padding-top:1px;">
                      <div style="width:28px;height:28px;border-radius:50%;background:#24432f;color:#fff;font-size:13px;font-weight:700;line-height:28px;text-align:center;">${escapeHtml(number)}</div>
                    </td>
                    <td valign="middle" style="color:#152017;font-size:15px;font-weight:700;line-height:1.65;">${escapeHtml(label)}</td>
                  </tr>
                </table>`;
}

function sentenceCase(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function cleanSubject(value: string) {
  return value.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 200);
}

function cleanDisplayText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}
