import { NextRequest, NextResponse } from "next/server";
import {
  planningInviteCookieOptions,
  PLANNING_INVITE_COOKIE
} from "@/lib/planning-workspace/invite";
import { planningInviteTokenSchema } from "@/lib/planning-workspace/validation";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const parsed = planningInviteTokenSchema.safeParse(request.nextUrl.searchParams.get("token"));
  const destination = new URL("/planning-hub/join", request.nextUrl.origin);

  if (!parsed.success) {
    destination.searchParams.set("message", "This invitation link is not valid.");
  }

  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");

  if (parsed.success) {
    response.cookies.set(
      PLANNING_INVITE_COOKIE,
      parsed.data,
      planningInviteCookieOptions()
    );
  } else {
    response.cookies.set(PLANNING_INVITE_COOKIE, "", {
      ...planningInviteCookieOptions(),
      expires: new Date(0),
      maxAge: 0
    });
  }

  return response;
}
