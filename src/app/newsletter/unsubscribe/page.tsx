import { createHash } from "node:crypto";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

type UnsubscribeParams = { email?: string; token?: string };

export default async function NewsletterUnsubscribePage({ searchParams }: { searchParams: Promise<UnsubscribeParams> }) {
  const { email, token } = await searchParams;
  const normalizedEmail = email?.trim().toLowerCase();
  let unsubscribed = false;

  if (normalizedEmail && token) {
    const supabase = createAdminClient();
    if (supabase) {
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const { data } = await supabase
        .from("newsletter_subscribers")
        .select("id")
        .eq("email", normalizedEmail)
        .eq("unsubscribe_token_hash", tokenHash)
        .in("status", ["pending", "active"])
        .maybeSingle();
      if (data) {
        const { error } = await supabase.from("newsletter_subscribers").update({ status: "unsubscribed", confirmation_token_hash: null }).eq("id", data.id);
        unsubscribed = !error;
      }
    }
  }

  return (
    <section className="mx-auto grid min-h-[60svh] max-w-2xl place-items-center px-4 py-16 text-center sm:px-6">
      <div className="max-w-xl">
        <h1 className="font-display text-5xl font-semibold tracking-[-0.03em] sm:text-6xl">{unsubscribed ? "You’re unsubscribed." : "This link is no longer active."}</h1>
        <p className="mt-5 text-base leading-7 text-[var(--muted)]">{unsubscribed ? "You will not receive any further EverAft newsletter emails." : "You may already have been unsubscribed, or this link has expired."}</p>
        <Link className="focus-ring mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--brand)] px-5 text-sm font-semibold text-white transition hover:bg-[#183522]" href="/">Back to EverAft</Link>
      </div>
    </section>
  );
}
