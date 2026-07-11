import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, MailX, ShieldCheck } from "lucide-react";
import { unsubscribeOutreachAction } from "@/app/actions/outreach";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Unsubscribe from venue invitations",
  robots: { index: false, follow: false }
};

export default async function OutreachUnsubscribePage({
  searchParams
}: {
  searchParams: Promise<{ id?: string; token?: string; status?: string; preview?: string }>;
}) {
  const { id, token, status, preview } = await searchParams;
  const success = status === "success";
  const invalid = status === "invalid" || (!preview && (!id || !token));

  return (
    <div className="mx-auto grid min-h-[calc(100vh-9rem)] max-w-xl place-items-center px-4 py-16">
      <section className="soft-shadow w-full rounded-[2rem] border border-[var(--line)] bg-white p-7 text-center sm:p-9">
        <span className="mx-auto grid size-13 place-items-center rounded-full bg-[#f4efe7] text-[#95502b]">
          {success ? <CheckCircle2 size={22} /> : invalid ? <ShieldCheck size={22} /> : <MailX size={22} />}
        </span>
        <h1 className="mt-5 font-display text-5xl font-semibold tracking-[-0.03em]">
          {preview ? "Unsubscribe link preview" : success ? "You’re unsubscribed." : invalid ? "This link is no longer active." : "Stop venue invitations?"}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[var(--muted)]">
          {preview
            ? "Live campaign emails contain a unique, secure link here. Previewing an email never changes the suppression list."
            : success
              ? "EverAft will not send further venue invitation or follow-up emails to this business address."
              : invalid
                ? "The request may already have been completed or the secure link is invalid. You can also reply to any EverAft invitation to opt out."
                : "Confirm below and EverAft will add this business email address to its permanent outreach suppression list."}
        </p>
        {!preview && !success && !invalid ? (
          <form action={unsubscribeOutreachAction} className="mt-7">
            <input name="recipientId" type="hidden" value={id} />
            <input name="token" type="hidden" value={token} />
            <Button className="w-full" type="submit">Confirm unsubscribe</Button>
          </form>
        ) : null}
        <Link className="mt-7 inline-flex text-sm font-semibold text-[#35533e] underline underline-offset-4" href="/">Return to EverAft</Link>
      </section>
    </div>
  );
}
