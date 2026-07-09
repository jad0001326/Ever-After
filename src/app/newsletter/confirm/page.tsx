import { createHash } from "node:crypto";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

type ConfirmParams = { email?: string; token?: string };

export default async function NewsletterConfirmationPage({ searchParams }: { searchParams: Promise<ConfirmParams> }) {
  const { email, token } = await searchParams;
  const normalizedEmail = email?.trim().toLowerCase();

  let confirmed = false;
  if (normalizedEmail && token) {
    const supabase = createAdminClient();
    if (supabase) {
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const { data } = await supabase
        .from("newsletter_subscribers")
        .select("id")
        .eq("email", normalizedEmail)
        .eq("confirmation_token_hash", tokenHash)
        .eq("status", "pending")
        .maybeSingle();

      if (data) {
        const { error } = await supabase
          .from("newsletter_subscribers")
          .update({ status: "active", confirmed_at: new Date().toISOString(), confirmation_token_hash: null })
          .eq("id", data.id);
        confirmed = !error;
      }
    }
  }

  return (
    <section className="mx-auto grid min-h-[60svh] max-w-2xl place-items-center px-4 py-16 text-center sm:px-6">
      <div className="max-w-xl">
        <h1 className="font-display text-5xl font-semibold tracking-[-0.03em] sm:text-6xl">
          {confirmed ? "You’re on the list." : "This link is no longer active."}
        </h1>
        <p className="mt-5 text-base leading-7 text-[var(--muted)]">
          {confirmed
            ? "Thank you. We’ll send occasional planning inspiration and thoughtful supplier finds."
            : "Confirmation links can only be used once. You can subscribe again if you still need a fresh link."}
        </p>
        <Link className="focus-ring mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--brand)] px-5 text-sm font-semibold text-white transition hover:bg-[#183522]" href="/">
          Back to EverAft
        </Link>
      </div>
    </section>
  );
}
