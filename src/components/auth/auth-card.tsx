import Link from "next/link";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function AuthCard({
  action,
  cta,
  message,
  mode,
  redirectTo
}: {
  action: (formData: FormData) => Promise<void>;
  cta: string;
  message?: string;
  mode: "login" | "signup";
  redirectTo?: string;
}) {
  return (
    <div className="mx-auto grid min-h-[calc(100vh-9rem)] max-w-md place-items-center px-4 py-12">
      <form action={action} className="soft-shadow w-full rounded-[2rem] border border-[var(--line)] bg-white p-6">
        {redirectTo ? <input name="redirectTo" type="hidden" value={redirectTo} /> : null}
        <div className="mb-6 grid justify-items-center gap-3 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-[var(--brand)] text-white">
            <Heart size={18} />
          </span>
          <div>
            <h1 className="font-display text-4xl font-semibold">{mode === "login" ? "Welcome back" : "Create account"}</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {mode === "login" ? "Sign in to save venues and manage enquiries." : "Start saving venues for your shortlist."}
            </p>
          </div>
        </div>
        <div className="grid gap-4">
          {mode === "signup" ? (
            <Field label="Full name">
              <Input name="fullName" required placeholder="Your name" />
            </Field>
          ) : null}
          <Field label="Email">
            <Input name="email" required type="email" placeholder="you@example.com" />
          </Field>
          <Field label="Password">
            <Input name="password" required type="password" minLength={8} placeholder="At least 8 characters" />
          </Field>
          {message ? <p className="rounded-2xl bg-[#f4efe7] px-4 py-3 text-sm text-[#5f594f]">{message}</p> : null}
          <Button type="submit">{cta}</Button>
        </div>
        <p className="mt-5 text-center text-sm text-[var(--muted)]">
          {mode === "login" ? (
            <>
              New to Ever After? <Link className="font-semibold text-[#5c6b52]" href={redirectTo ? `/signup?redirectTo=${encodeURIComponent(redirectTo)}` : "/signup"}>Create an account</Link>
            </>
          ) : (
            <>
              Already have an account? <Link className="font-semibold text-[#5c6b52]" href={redirectTo ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : "/login"}>Sign in</Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
