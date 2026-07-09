"use client";

import { useActionState } from "react";
import { subscribeToNewsletter } from "@/app/actions/newsletter";

export function NewsletterForm() {
  const [state, action, pending] = useActionState(subscribeToNewsletter, null);

  return (
    <form action={action} className="mt-7 max-w-xl">
      <label className="sr-only" htmlFor="newsletter-email">Email address</label>
      <input aria-hidden="true" autoComplete="off" className="hidden" name="website" tabIndex={-1} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="focus-ring h-12 min-w-0 flex-1 rounded-full border border-[var(--line)] bg-white px-5 text-sm text-[var(--ink)] outline-none placeholder:text-[#837b70]"
          id="newsletter-email"
          name="email"
          placeholder="Your email address"
          required
          type="email"
        />
        <button className="focus-ring min-h-12 rounded-full bg-[var(--brand)] px-6 text-sm font-semibold text-white transition hover:bg-[#183522] disabled:cursor-not-allowed disabled:opacity-60" disabled={pending} type="submit">
          {pending ? "Adding you…" : "Subscribe"}
        </button>
      </div>
      <p aria-live="polite" className={state?.ok ? "mt-3 text-sm text-[#285237]" : "mt-3 text-sm text-[#9e341f]"}>
        {state?.message ?? "We only add you after you confirm by email."}
      </p>
    </form>
  );
}
