"use client";

import { useActionState } from "react";
import { sendContactMessage } from "@/app/actions/contact";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";

export function ContactForm() {
  const [state, action, pending] = useActionState(sendContactMessage, null);

  return (
    <form action={action} className="rounded-[2rem] border border-[var(--line)] bg-white p-6 shadow-[0_24px_70px_rgba(25,23,19,0.07)] sm:p-7">
      <input aria-hidden="true" autoComplete="off" className="hidden" name="website" tabIndex={-1} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name"><Input name="name" required placeholder="Your name" /></Field>
        <Field label="Email"><Input name="email" required type="email" placeholder="you@example.com" /></Field>
      </div>
      <div className="mt-5 grid gap-5">
        <Field label="Subject"><Input name="subject" required placeholder="What can we help with?" /></Field>
        <Field label="Message"><Textarea minLength={10} name="message" required placeholder="Tell us a little more…" /></Field>
      </div>
      {state?.message ? <p aria-live="polite" className={state.ok ? "mt-5 text-sm text-[#285237]" : "mt-5 text-sm text-[#9e341f]"}>{state.message}</p> : null}
      <Button className="mt-6" disabled={pending} type="submit">{pending ? "Sending…" : "Send message"}</Button>
    </form>
  );
}
