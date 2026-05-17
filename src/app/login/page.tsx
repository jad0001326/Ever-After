import type { Metadata } from "next";
import { signIn } from "@/app/actions/auth";
import { AuthCard } from "@/components/auth/auth-card";

export const metadata: Metadata = {
  title: "Sign in"
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ message?: string; redirectTo?: string }> }) {
  const { message, redirectTo } = await searchParams;
  return <AuthCard action={signIn} cta="Sign in" message={message} mode="login" redirectTo={redirectTo} />;
}
