"use server";
import { createClient } from "@/lib/supabase/server";
import { budgetPlanSchema } from "@/lib/budget/validation";
import type { BudgetPlan } from "@/lib/budget/types";
import type { Json } from "@/types/database";

export async function saveBudgetPlan(input: BudgetPlan) {
  const parsed = budgetPlanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "The budget contains invalid data and was saved on this device only." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Cloud saving is unavailable. Your plan is still saved on this device." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in to save this plan to your account." };
  const plan = { ...parsed.data, userId: user.id, updatedAt: new Date().toISOString() };
  const { error } = await supabase.from("budget_plans").upsert({ id: plan.id, user_id: user.id, name: plan.name, scenario_name: plan.scenarioName, currency: plan.currency, total_budget_pence: plan.totalBudgetPence, plan_json: plan as unknown as Json, updated_at: plan.updatedAt }, { onConflict: "id" });
  if (error) return { ok: false, message: "Cloud save failed. Your latest changes remain saved on this device." };
  return { ok: true, savedAt: plan.updatedAt };
}

export async function loadLatestBudgetPlan(): Promise<BudgetPlan | null> {
  const supabase = await createClient(); if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser(); if (!user) return null;
  const { data } = await supabase.from("budget_plans").select("plan_json").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  const parsed = budgetPlanSchema.safeParse(data?.plan_json);
  return parsed.success ? { ...parsed.data, userId: user.id } : null;
}

