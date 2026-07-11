import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Bot, Check, LockKeyhole, Mail, ShieldCheck, X } from "lucide-react";
import { decideOAuthAuthorization } from "@/app/actions/oauth";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Connect EverAft to ChatGPT",
  robots: { index: false, follow: false }
};

export default async function OAuthConsentPage({
  searchParams
}: {
  searchParams: Promise<{ authorization_id?: string; message?: string }>;
}) {
  const { authorization_id: authorizationId, message } = await searchParams;
  if (!authorizationId) return <ConsentError message={message ?? "The authorization request is missing or invalid."} />;

  const redirectTo = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
  const { user, supabase } = await requireUser(redirectTo, "Sign in as an EverAft administrator to connect ChatGPT");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return <ConsentError message="Only an EverAft administrator can approve this connection." />;

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !data) return <ConsentError message={error?.message ?? "The authorization request could not be loaded."} />;
  if ("redirect_url" in data) redirect(data.redirect_url);
  const scopes = data.scope.split(" ").filter(Boolean);

  return (
    <div className="mx-auto grid min-h-[calc(100vh-9rem)] max-w-2xl place-items-center px-4 py-14">
      <section className="soft-shadow w-full rounded-[2rem] border border-[var(--line)] bg-white p-6 sm:p-9">
        <div className="flex items-start gap-4">
          <span className="grid size-13 shrink-0 place-items-center rounded-full bg-[var(--brand)] text-white"><Bot size={23} /></span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#95502b]">Secure connection</p>
            <h1 className="mt-2 font-display text-5xl font-semibold tracking-[-0.04em]">Connect {data.client.name || "ChatGPT"} to EverAft?</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Signed in as {data.user.email}. The connection will use your existing EverAft administrator permissions.</p>
          </div>
        </div>

        {message ? <p className="mt-6 rounded-2xl bg-[#fff4ed] px-4 py-3 text-sm text-[#8a3c19]">{message}</p> : null}

        <div className="mt-7 rounded-3xl border border-[var(--line)] bg-[#fbf8f3] p-5">
          <p className="font-semibold text-[#29251f]">This connection can:</p>
          <ul className="mt-4 grid gap-3 text-sm leading-6 text-[#4d483f]">
            <Permission icon={<Mail size={17} />} text="Read eligible venue names and business contact addresses for outreach." />
            <Permission icon={<Mail size={17} />} text="Record newly researched contacts only when the exact public source page is supplied." />
            <Permission icon={<Check size={17} />} text="Prepare personalised campaign previews and exact recipient summaries." />
            <Permission icon={<ShieldCheck size={17} />} text="Ask for your explicit ChatGPT confirmation before sending any campaign." />
            <Permission icon={<LockKeyhole size={17} />} text="Record sends, delivery outcomes, opt-outs and suppression decisions." />
          </ul>
        </div>

        <div className="mt-5 rounded-2xl bg-[#f4efe7] px-4 py-3 text-xs leading-6 text-[#625f57]">
          Requested OAuth scopes: {scopes.join(", ") || "authenticated access"}. Sending email is registered as an external write action and remains approval-gated in ChatGPT.
        </div>

        <form action={decideOAuthAuthorization} className="mt-7 grid gap-3 sm:grid-cols-2">
          <input name="authorizationId" type="hidden" value={data.authorization_id} />
          <Button name="decision" type="submit" value="approve"><Check size={17} /> Allow connection</Button>
          <Button name="decision" type="submit" value="deny" variant="secondary"><X size={17} /> Deny</Button>
        </form>
      </section>
    </div>
  );
}

function Permission({ icon, text }: { icon: ReactNode; text: string }) {
  return <li className="flex gap-3"><span className="mt-1 text-[#95502b]">{icon}</span><span>{text}</span></li>;
}

function ConsentError({ message }: { message: string }) {
  return (
    <div className="mx-auto grid min-h-[calc(100vh-9rem)] max-w-xl place-items-center px-4 py-14">
      <section className="w-full rounded-[2rem] border border-[var(--line)] bg-white p-8 text-center">
        <LockKeyhole className="mx-auto text-[#95502b]" size={26} />
        <h1 className="mt-5 font-display text-5xl font-semibold">Connection unavailable</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{message}</p>
      </section>
    </div>
  );
}
