export type BudgetAnalyticsEvent = "budget_planner_opened" | "budget_entered" | "starter_budget_selected" | "expense_added_manually" | "website_listing_added" | "venue_imported" | "missing_price_completed" | "budget_exceeded" | "planner_saved" | "planner_restored" | "export_used" | "account_creation_prompt_clicked";
export function trackBudgetEvent(name: BudgetAnalyticsEvent, properties: Record<string, string | boolean> = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("everaft:analytics", { detail: { name, properties } }));
}
