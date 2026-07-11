import { NextResponse, type NextRequest } from "next/server";
import { unsubscribeOutreachRecipient } from "@/lib/outreach";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const recipientId = request.nextUrl.searchParams.get("id") ?? "";
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const result = await unsubscribeOutreachRecipient(recipientId, token);
  return new NextResponse(result.ok ? "Unsubscribed" : "Invalid unsubscribe link", {
    status: result.ok ? 200 : 400,
    headers: { "Cache-Control": "no-store" }
  });
}
