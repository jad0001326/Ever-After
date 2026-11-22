import { signUp } from "@/app/actions/auth";
import { AuthCard } from "@/components/auth/auth-card";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata({
  title: "Create account",
  description: "Create an EverAft account to save Scottish wedding venues and keep a shortlist in one place.",
  path: "/signup"
});

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ message?: string; redirectTo?: string }> }) {
  const { message, redirectTo } = await searchParams;
  return <AuthCard action={signUp} cta="Create account" message={message} mode="signup" redirectTo={redirectTo} />;
}
