export const publicHomePositioning = {
  heroDescription: "Discover Scottish venues and photographers, then use free budget and table tools to make the next decision with confidence.",
  primary: { href: "/venues", label: "Explore venues" },
  secondary: { href: "/wedding-budget-planner", label: "Build your budget" },
  sectionDescription: "Useful discovery, budget and table tools for the decisions you can make today.",
  steps: [
    ["Discover", "Browse businesses that suit your setting, style and priorities."],
    ["Budget", "Put venue and supplier estimates beside the money you actually have."],
    ["Arrange", "Move from costs into guests and tables with free practical tools."],
  ],
} as const;

export const connectedHomePositioning = {
  heroDescription: "Discover Scottish venues and photographers, compare what fits, then carry your choices into budgets, bookings, payments, guests and tables.",
  primary: { href: "/planning-hub", label: "Start your Planning Hub beta" },
  secondary: { href: "/venues", label: "Explore venues" },
  sectionDescription: "One connected journey from first search to the next real commitment.",
  steps: [
    ["Discover", "Search Scottish venues and photographers around your date, place and priorities."],
    ["Decide", "Compare the options, preserve your shortlist and see what each choice does to the budget."],
    ["Organise", "Carry booked costs into payments, tasks, guests, tables and the next useful action."],
  ],
} as const;

export function homePositioningFor(planningHubEnabled: boolean) {
  return planningHubEnabled ? connectedHomePositioning : publicHomePositioning;
}
