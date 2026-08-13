"use client";

import Link from "next/link";
import { CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import { useActionState } from "react";
import {
  acceptPlanningWorkspaceInviteFromCookieAction,
  type PlanningInviteAcceptanceState
} from "@/app/actions/planning-workspace";
import { Button } from "@/components/ui/button";

const initialState: PlanningInviteAcceptanceState = {
  status: "idle",
  message: ""
};

export function PlanningInviteAcceptance() {
  const [state, formAction, pending] = useActionState(
    acceptPlanningWorkspaceInviteFromCookieAction,
    initialState
  );

  if (state.status === "success") {
    return (
      <div aria-live="polite" className="rounded-3xl border border-[#b9d2bd] bg-[#f2f8f2] p-5">
        <CheckCircle2 aria-hidden="true" className="text-[#2f6b3b]" size={28} />
        <h2 className="mt-3 font-display text-2xl font-semibold text-[#173526]">
          You&apos;re connected
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#536157]">{state.message}</p>
        <Link
          className="focus-ring mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-[#173526] px-5 text-sm font-semibold text-white"
          href={state.workspaceId
            ? `/planning-hub/organise?workspace=${encodeURIComponent(state.workspaceId)}`
            : "/planning-hub/organise"}
          prefetch={false}
        >
          Open the wedding plan
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <div className="flex items-start gap-3 rounded-2xl bg-[#f4efe7] p-4 text-sm leading-6 text-[#5f594f]">
        <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-[#35533e]" size={20} />
        <p>
          Accepting gives you partner access to the couple&apos;s tasks, guests,
          tables and connected planning details. Access is checked against your
          confirmed email address.
        </p>
      </div>
      {state.status === "error" ? (
        <p
          aria-live="polite"
          className="mt-4 rounded-2xl border border-[#e1b8ae] bg-[#fff3f0] px-4 py-3 text-sm text-[#7a3026]"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}
      <Button className="mt-5 w-full sm:w-auto" disabled={pending} type="submit">
        {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" size={18} /> : null}
        {pending ? "Checking invitation…" : "Accept partner invitation"}
      </Button>
    </form>
  );
}
