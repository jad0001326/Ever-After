import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { processResendOutreachEvent } from "@/lib/outreach";

export const runtime = "nodejs";

const handledEvents = new Set([
  "email.delivered",
  "email.bounced",
  "email.complained",
  "email.suppressed",
  "email.failed"
]);

type ResendEvent = {
  type: string;
  created_at?: string;
  data: { email_id?: string; [key: string]: unknown };
};

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return new NextResponse("Webhook is not configured", { status: 503 });

  const eventId = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!eventId || !timestamp || !signature) return new NextResponse("Missing webhook signature", { status: 400 });

  const payload = await request.text();
  let event: ResendEvent;
  try {
    event = new Webhook(secret).verify(payload, {
      "svix-id": eventId,
      "svix-timestamp": timestamp,
      "svix-signature": signature
    }) as ResendEvent;
  } catch {
    return new NextResponse("Invalid webhook", { status: 400 });
  }

  try {
    const resendEmailId = event.data?.email_id;
    if (handledEvents.has(event.type) && resendEmailId) {
      await processResendOutreachEvent({
        eventId,
        eventType: event.type,
        eventCreatedAt: event.created_at,
        resendEmailId,
        eventData: deliveryEvidence(event.data)
      });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Could not process Resend webhook", error);
    return new NextResponse("Webhook processing failed", { status: 500 });
  }
}

function deliveryEvidence(data: Record<string, unknown>) {
  const bounce = object(data.bounce);
  const details = object(data.details);
  return {
    bounce_type: text(bounce.type ?? data.bounce_type ?? data.type),
    bounce_subtype: text(bounce.subtype ?? data.bounce_subtype ?? data.subtype),
    diagnostic_message: text(bounce.message ?? bounce.reason ?? details.message ?? data.reason ?? data.message)
  };
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.slice(0, 2_000) : "";
}
