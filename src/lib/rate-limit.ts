import "server-only";
import { headers } from "next/headers";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * A small best-effort guard for unauthenticated forms. Deployments with more
 * than one server should also enforce a durable edge/WAF limit.
 */
export async function allowPublicFormSubmission(scope: string, limit = 5, windowMs = 15 * 60_000) {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = `${scope}:${forwardedFor ?? requestHeaders.get("x-real-ip") ?? "unknown"}`;
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}
