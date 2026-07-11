import { absoluteUrl } from "@/lib/utils";

export type OutreachCampaignKind = "initial_invite" | "follow_up";

export type OutreachCopy = {
  subject: string;
  preheader: string;
  introText: string;
  offerText: string;
};

export type OutreachEmailRecipient = {
  businessName: string;
  town: string;
  venueSlug: string;
  unsubscribeUrl: string;
};

export const defaultOutreachCopy: Record<OutreachCampaignKind, OutreachCopy> = {
  initial_invite: {
    subject: "An invitation for {business_name} from EverAft",
    preheader: "Review and claim your complimentary EverAft venue listing.",
    introText:
      "We’re building EverAft to help couples discover exceptional wedding venues across Scotland. We’ve created a complimentary launch listing for {business_name}, giving couples a clear way to discover your venue and visit your official channels.",
    offerText:
      "During launch, selected venues can join as founding partners and receive a lifetime discount from our standard listing price. There is no obligation to claim the complimentary listing."
  },
  follow_up: {
    subject: "A quick follow-up about {business_name} on EverAft",
    preheader: "Your EverAft venue listing is ready to review.",
    introText:
      "I wanted to follow up on the invitation to review {business_name} on EverAft. Your complimentary launch listing is ready, and claiming it lets your team check the details, add approved photography and keep the enquiry route accurate.",
    offerText:
      "Our founding partner offer remains available during launch, including a lifetime discount from the standard listing price. There is no obligation to take part."
  }
};

export function renderOutreachTemplate(value: string, recipient: Pick<OutreachEmailRecipient, "businessName" | "town">) {
  return value
    .replaceAll("{business_name}", recipient.businessName)
    .replaceAll("{town}", recipient.town);
}

export function buildOutreachEmail({
  copy,
  kind,
  recipient
}: {
  copy: OutreachCopy;
  kind: OutreachCampaignKind;
  recipient: OutreachEmailRecipient;
}) {
  const subject = renderOutreachTemplate(copy.subject, recipient).replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 200);
  const preheader = renderOutreachTemplate(copy.preheader, recipient);
  const introText = renderOutreachTemplate(copy.introText, recipient);
  const offerText = renderOutreachTemplate(copy.offerText, recipient);
  const claimUrl = absoluteUrl(`/venues/${recipient.venueSlug}/claim`);
  const listingUrl = absoluteUrl(`/venues/${recipient.venueSlug}`);
  const heroUrl = absoluteUrl("/images/everaft-wedding-reception.png");
  const privacyUrl = absoluteUrl("/privacy");
  const headline = kind === "follow_up" ? "Your invitation is still open." : "A thoughtful introduction for your venue.";

  const text = [
    `Hi ${recipient.businessName} team,`,
    "",
    introText,
    "",
    `Review and claim your listing: ${claimUrl}`,
    `View the current listing: ${listingUrl}`,
    "",
    offerText,
    "",
    "Best,",
    "James",
    "EverAft",
    "james@everaft.co.uk",
    "",
    `Privacy: ${privacyUrl}`,
    `Unsubscribe from venue invitations: ${recipient.unsubscribeUrl}`
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
                <div style="color:#9c542d;font-size:12px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">For ${escapeHtml(recipient.businessName)}</div>
                <h1 style="margin:14px 0 20px;color:#152017;font-family:Georgia,'Times New Roman',serif;font-size:39px;line-height:1.08;font-weight:600;letter-spacing:-.5px;">${escapeHtml(headline)}</h1>
                <p style="margin:0 0 18px;color:#4d483f;font-size:16px;line-height:1.75;">Hi ${escapeHtml(recipient.businessName)} team,</p>
                ${paragraphs(introText)}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 42px 33px;">
                <a href="${escapeAttribute(claimUrl)}" style="display:inline-block;padding:15px 26px;border-radius:999px;background:#24432f;color:#fff;font-size:15px;font-weight:700;text-decoration:none;">Review and claim your listing</a>
                <div style="margin-top:16px;font-size:13px;line-height:1.6;color:#625f57;">
                  <a href="${escapeAttribute(listingUrl)}" style="color:#35533e;font-weight:700;text-decoration:underline;text-underline-offset:3px;">View the current listing</a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 42px 34px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f4efe7;border:1px solid #e3d8c9;border-radius:18px;">
                  <tr>
                    <td style="padding:23px 24px;">
                      <div style="color:#95502b;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Founding partner invitation</div>
                      <div style="margin-top:10px;color:#4d483f;font-size:14px;line-height:1.7;">${escapeHtml(offerText)}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 42px 42px;color:#4d483f;font-size:15px;line-height:1.7;">
                <p style="margin:0;">Best,<br><strong style="color:#152017;">James</strong><br>EverAft</p>
              </td>
            </tr>
            <tr>
              <td style="padding:25px 34px;background:#ebe3d8;color:#625f57;font-size:11px;line-height:1.7;text-align:center;">
                <strong style="color:#24432f;">EverAft</strong> · Curated wedding venue discovery<br>
                Sent by EverAft because this address is published for ${escapeHtml(recipient.businessName)} or was supplied for venue contact.<br>
                Reply to <a href="mailto:james@everaft.co.uk" style="color:#35533e;">james@everaft.co.uk</a> ·
                <a href="${escapeAttribute(privacyUrl)}" style="color:#35533e;">Privacy</a> ·
                <a href="${escapeAttribute(recipient.unsubscribeUrl)}" style="color:#35533e;">Unsubscribe</a>
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

function paragraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 18px;color:#4d483f;font-size:16px;line-height:1.75;">${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
    .join("");
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}
