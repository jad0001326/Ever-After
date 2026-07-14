import { isValidOutreachEmail } from "../outreach-validation";

type ReviewRow = Record<string, unknown>;

const emailStatusPriority: Record<string, number> = {
  opted_out: 90,
  suppressed: 85,
  hard_bounce: 80,
  verified: 70,
  likely_valid: 60,
  unverified: 40,
  invalid: 20,
  not_found: 0
};

export function enrichmentBusinessName(snapshot: ReviewRow, profile?: ReviewRow | null) {
  return firstText(
    snapshot.businessName,
    snapshot.name,
    snapshot.business_name,
    profile?.trading_name,
    profile?.legal_name
  );
}

export function selectPrimaryEmailCheck(checks: ReviewRow[], preferredEmails: unknown[]) {
  const preferred = new Map<string, number>();
  for (const value of preferredEmails) {
    const email = normalizeEmail(value);
    if (email && !preferred.has(email)) preferred.set(email, preferred.size);
  }

  const candidates = checks.filter((check) => {
    const email = normalizeEmail(check.email);
    if (!email) return false;
    if (!isValidOutreachEmail(email)) return false;
    return check.is_current_candidate === true || check.candidate_role === "venue_contact" || preferred.has(email) || (check.syntax_valid === true && check.domain_associated === true);
  });

  let best: ReviewRow | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const check of candidates) {
    const email = normalizeEmail(check.email);
    const preferredIndex = preferred.get(email);
    const score = (check.is_current_candidate === true ? 10_000 : 0)
      + (check.candidate_role === "venue_contact" ? 5_000 : 0)
      + (preferredIndex == null ? 0 : 1_000 - preferredIndex * 10)
      + (check.syntax_valid === true ? 100 : 0)
      + (check.domain_associated === true ? 50 : 0)
      + (emailStatusPriority[firstText(check.status)] ?? 0);
    if (score > bestScore) {
      best = check;
      bestScore = score;
    }
  }
  return best;
}

export function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function firstValidBusinessEmail(...values: unknown[]) {
  for (const value of values) {
    const email = normalizeEmail(value);
    if (isValidOutreachEmail(email)) return email;
  }
  return "";
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
