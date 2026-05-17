import type { Metadata } from "next";
import { signUp } from "@/app/actions/auth";
import { AuthCard } from "@/components/auth/auth-card";

export const metadata: Metadata = {
  title: "Create account"
};

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ message?: string; redirectTo?: string }> }) {
  const { message, redirectTo } = await searchParams;
  return <AuthCard action={signUp} cta="Create account" message={message} mode="signup" redirectTo={redirectTo} />;
}
