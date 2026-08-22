export const primaryTabs = [
  { name: "today", label: "Today", accessibilityLabel: "Today tab" },
  { name: "discover", label: "Discover", accessibilityLabel: "Discover tab" },
  { name: "plan", label: "Plan", accessibilityLabel: "Plan tab" },
  { name: "you", label: "You", accessibilityLabel: "You tab" },
] as const;

export type PrimaryTabName = (typeof primaryTabs)[number]["name"];
