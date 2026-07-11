import "server-only";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { OutreachAudienceFilter, OutreachCandidate } from "@/lib/outreach-types";
import type { OutreachCampaignKind, OutreachCopy } from "@/lib/outreach-email";

export type OutreachApprovalPayload = {
  version: 2;
  nonce: string;
  adminUserId: string;
  campaignName: string;
  kind: OutreachCampaignKind;
  venueIds: string[];
  recipients: OutreachCandidate[];
  expectedRecipientCount: number;
  filter: OutreachAudienceFilter;
  copy: OutreachCopy;
  issuedAt: number;
  expiresAt: number;
};

const approvalLifetimeSeconds = 30 * 60;

export function createOutreachApprovalToken(
  input: Omit<OutreachApprovalPayload, "version" | "nonce" | "issuedAt" | "expiresAt">
) {
  const secret = approvalSecret();
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: OutreachApprovalPayload = {
    ...input,
    version: 2,
    nonce: randomUUID(),
    issuedAt,
    expiresAt: issuedAt + approvalLifetimeSeconds
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encoded, secret);
  return { token: `${encoded}.${signature}`, payload };
}

export function verifyOutreachApprovalToken(token: string, adminUserId: string) {
  if (token.length > 100_000) throw new Error("The campaign approval token is invalid.");
  const [encoded, signature, ...extra] = token.split(".");
  if (!encoded || !signature || extra.length > 0) throw new Error("The campaign approval token is invalid.");

  const expected = sign(encoded, approvalSecret());
  const suppliedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    throw new Error("The campaign approval token is invalid.");
  }

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OutreachApprovalPayload;
  if (payload.version !== 2 || payload.adminUserId !== adminUserId) throw new Error("The campaign approval token is not valid for this admin.");
  if (!Array.isArray(payload.venueIds) || payload.venueIds.length < 1 || payload.venueIds.length > 100) throw new Error("The approved audience is invalid.");
  if (payload.expectedRecipientCount !== payload.venueIds.length) throw new Error("The approved recipient count is invalid.");
  if (!Array.isArray(payload.recipients) || payload.recipients.length !== payload.expectedRecipientCount) throw new Error("The approved recipients are invalid.");
  const venueIds = new Set(payload.venueIds);
  const recipientIds = new Set(payload.recipients.map((recipient) => recipient.id));
  const recipientEmails = new Set(payload.recipients.map((recipient) => recipient.email?.trim().toLowerCase()));
  if (venueIds.size !== payload.venueIds.length || recipientIds.size !== payload.recipients.length || recipientEmails.size !== payload.recipients.length) {
    throw new Error("The approved recipients contain duplicates.");
  }
  if (payload.recipients.some((recipient) => !venueIds.has(recipient.id) || !recipient.email || !recipient.slug || !recipient.name)) {
    throw new Error("The approved recipient snapshot is invalid.");
  }
  if (payload.expiresAt <= Math.floor(Date.now() / 1000)) throw new Error("The campaign preview has expired. Generate a new preview before sending.");
  return payload;
}

export function approvalFingerprint(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function approvalSecret() {
  const secret = process.env.OUTREACH_APPROVAL_SECRET;
  if (!secret || secret.length < 32 || secret === "generate-a-random-secret-of-at-least-32-characters") {
    throw new Error("Set OUTREACH_APPROVAL_SECRET to a random value of at least 32 characters.");
  }
  return secret;
}
