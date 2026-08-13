export const PLANNING_INVITE_COOKIE = "everaft_planning_invite";
export const PLANNING_INVITE_COOKIE_MAX_AGE_SECONDS = 60 * 60;

export function planningInviteCookieOptions() {
  return {
    httpOnly: true,
    maxAge: PLANNING_INVITE_COOKIE_MAX_AGE_SECONDS,
    path: "/planning-hub/join",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };
}
