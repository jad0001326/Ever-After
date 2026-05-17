"use client";

import { useActionState } from "react";
import { ShieldCheck } from "lucide-react";
import { submitVenueClaim } from "@/app/actions/claims";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";

export function ClaimListingForm({ venueId, venueSlug }: { venueId: string; venueSlug: string }) {
  const [state, formAction, pending] = useActionState(submitVenueClaim, null);

  return (
    <form action={formAction} className="rounded-3xl border border-[var(--line)] bg-white p-6">
      <input name="venueId" type="hidden" value={venueId} />
      <input name="slug" type="hidden" value={venueSlug} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Claimant name">
          <Input name="claimantName" required placeholder="Your name" />
        </Field>
        <Field label="Business email">
          <Input name="businessEmail" required type="email" placeholder="events@venue.com" />
        </Field>
        <Field label="Role or job title">
          <Input name="claimantRole" required placeholder="Owner, manager, events lead" />
        </Field>
        <Field label="Phone number">
          <Input name="businessPhone" required placeholder="+44..." />
        </Field>
      </div>
      <div className="mt-4 grid gap-4">
        <Field label="Evidence URL">
          <Input name="evidenceUrl" type="url" placeholder="Official staff page, LinkedIn, or venue contact page" />
        </Field>
        <Field label="Message">
          <Textarea name="message" required placeholder="Tell us how you are connected to this venue and what you would like to update." />
        </Field>
      </div>

      <div className="mt-5 grid gap-3 rounded-2xl bg-[#fbf8f3] p-4 text-sm text-[#4a443c]">
        <label className="flex gap-3">
          <input className="mt-1 size-4 accent-[#334235]" name="authorised" required type="checkbox" />
          <span>I confirm I am authorised to represent this venue.</span>
        </label>
        <label className="flex gap-3">
          <input className="mt-1 size-4 accent-[#334235]" name="permissionConfirmed" required type="checkbox" />
          <span>I confirm I have the rights or permission to provide any submitted content.</span>
        </label>
        <label className="flex gap-3">
          <input className="mt-1 size-4 accent-[#334235]" name="termsAccepted" required type="checkbox" />
          <span>I agree that EverAft may display approved content on this listing.</span>
        </label>
      </div>

      {state?.message ? (
        <p className={state.ok ? "mt-5 rounded-2xl bg-[#eef4ea] px-4 py-3 text-sm text-[#3f5c35]" : "mt-5 rounded-2xl bg-[#fff4ed] px-4 py-3 text-sm text-[#8a3c19]"}>
          {state.message}
        </p>
      ) : null}

      <Button className="mt-5 w-full" disabled={pending || state?.ok} type="submit">
        <ShieldCheck size={16} />
        {pending ? "Submitting..." : "Submit claim for review"}
      </Button>
    </form>
  );
}
