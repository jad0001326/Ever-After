"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { createEnquiry } from "@/app/actions/enquiries";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";

export function EnquiryForm({ venueId }: { venueId: string }) {
  const [state, formAction, pending] = useActionState(createEnquiry, null);

  return (
    <form action={formAction} className="rounded-3xl border border-[var(--line)] bg-white p-5">
      <input name="venueId" type="hidden" value={venueId} />
      <h2 className="font-display text-3xl font-semibold">Enquire with the venue</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        Share your date, guest count, and what matters most. This is ready to persist to Supabase.
      </p>
      <div className="mt-5 grid gap-4">
        <Field label="Name">
          <Input name="name" required placeholder="Your name" />
        </Field>
        <Field label="Email">
          <Input name="email" required type="email" placeholder="you@example.com" />
        </Field>
        <Field label="Phone">
          <Input name="phone" placeholder="+44..." />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Wedding date">
            <Input name="weddingDate" type="date" />
          </Field>
          <Field label="Guests">
            <Input name="guestCount" type="number" min="1" placeholder="120" />
          </Field>
        </div>
        <Field label="Message">
          <Textarea name="message" required placeholder="Tell the venue what you are planning..." />
        </Field>
        {state?.message ? (
          <p className={state.ok ? "text-sm text-[var(--brand)]" : "text-sm text-red-700"}>{state.message}</p>
        ) : null}
        <Button disabled={pending} type="submit">
          <Send size={16} />
          {pending ? "Sending..." : "Send enquiry"}
        </Button>
      </div>
    </form>
  );
}
