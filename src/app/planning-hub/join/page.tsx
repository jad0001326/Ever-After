import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft, HeartHandshake, LockKeyhole, ShieldCheck } from "lucide-react";
import { PlanningInviteAcceptance } from "@/components/planning-hub/planning-invite-acceptance";
import { ButtonLink } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { PLANNING_INVITE_COOKIE } from "@/lib/planning-workspace/invite";

export const metadata: Metadata = {
  title: "Partner invitation | My EverAft",
  description: "Accept secure partner access to a shared EverAft wedding plan.",
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
    noimageindex: true
  }
};

export const dynamic = "force-dynamic";

export default async function PlanningHubJoinPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const [cookieStore, supabase, params] = await Promise.all([
    cookies(),
    createClient(),
    searchParams
  ]);
  const invitationAvailable = Boolean(cookieStore.get(PLANNING_INVITE_COOKIE)?.value);
  const {
    data: { user }
  } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };
  const cloudEnabled = process.env.PLANNING_WORKSPACE_CLOUD_ENABLED === "true";

  return (
    <>
      <header className="border-b border-[#d9d0c3] bg-[#fbf8f2]">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full text-sm font-semibold text-[#24432f]"
            href="/planning-hub/organise"
            prefetch={false}
          >
            <ArrowLeft aria-hidden="true" size={17} /> My EverAft
          </Link>
          <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#e8efe8] px-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#24432f]">
            <ShieldCheck aria-hidden="true" size={14} /> Secure invitation
          </span>
        </div>
      </header>
      <div className="mx-auto grid min-h-[32rem] max-w-3xl place-items-center px-4 py-8 sm:px-6 sm:py-10">
        <section
          aria-labelledby="partner-invitation-title"
          className="soft-shadow w-full rounded-[2rem] border border-[var(--line)] bg-white p-6 sm:p-8"
        >
          <div className="grid size-12 place-items-center rounded-full bg-[#e8efe8] text-[#24432f]">
            <HeartHandshake aria-hidden="true" size={22} />
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#9c542d]">
            Private partner invitation
          </p>
          <h1
            className="mt-2 font-display text-4xl font-semibold leading-tight text-[#173526] sm:text-5xl"
            id="partner-invitation-title"
          >
            Plan your wedding together.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#625f57] sm:text-base">
            Join one private My EverAft workspace so both partners can keep the
            budget, bookings, tasks, guests and tables aligned.
          </p>

          <div className="mt-7 border-t border-[#e4ddd2] pt-6">
            {params.message ? (
              <p className="rounded-2xl border border-[#e1b8ae] bg-[#fff3f0] px-4 py-3 text-sm text-[#7a3026]" role="alert">
                {params.message}
              </p>
            ) : null}

            {!invitationAvailable ? (
              <InvitationUnavailable />
            ) : !user ? (
              <SignedOutInvitation />
            ) : !user.email_confirmed_at ? (
              <InvitationNotice
                title="Confirm your email first"
                message="For privacy, this invitation can only be matched to a confirmed account email. Confirm your email, then open the original invitation link again."
              />
            ) : !cloudEnabled ? (
              <InvitationNotice
                title="Partner access is in private testing"
                message="Your invitation is protected, but connected partner access has not been enabled yet. No planning data has been shared or changed."
              />
            ) : (
              <PlanningInviteAcceptance />
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function InvitationUnavailable() {
  return (
    <InvitationNotice
      title="Open your invitation link"
      message="This page does not contain an active invitation. Ask your partner to resend the original secure link."
    >
      <ButtonLink className="mt-5" href="/planning-hub/organise" prefetch={false} variant="secondary">
        Return to Organise
      </ButtonLink>
    </InvitationNotice>
  );
}

function SignedOutInvitation() {
  const redirectTo = "/planning-hub/join";
  return (
    <div>
      <div className="flex items-start gap-3 rounded-2xl bg-[#f4efe7] p-4">
        <LockKeyhole aria-hidden="true" className="mt-0.5 shrink-0 text-[#35533e]" size={20} />
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#173526]">Sign in securely</h2>
          <p className="mt-1 text-sm leading-6 text-[#5f594f]">
            We&apos;ll match the invitation to your confirmed account email before
            showing any shared planning information.
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href={`/login?redirectTo=${encodeURIComponent(redirectTo)}`}>
          Sign in to continue
        </ButtonLink>
        <ButtonLink
          href={`/signup?redirectTo=${encodeURIComponent(redirectTo)}`}
          variant="secondary"
        >
          Create an account
        </ButtonLink>
      </div>
    </div>
  );
}

function InvitationNotice({
  children,
  message,
  title
}: {
  children?: React.ReactNode;
  message: string;
  title: string;
}) {
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold text-[#173526]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#625f57]">{message}</p>
      {children}
    </div>
  );
}
