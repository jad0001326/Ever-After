import { signIn } from "@/app/actions/auth";
import { AuthCard } from "@/components/auth/auth-card";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata({
  title: "Sign in",
  description: "Sign in to EverAft to save Scottish wedding venues and manage your enquiries.",
  path: "/login"
});

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ message?: string; redirectTo?: string }> }) {
  const { message, redirectTo } = await searchParams;
  return <AuthCard action={signIn} cta="Sign in" message={message} mode="login" redirectTo={redirectTo} />;
}
