export function planningHubPublicEntryEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  return env.PLANNING_HUB_PUBLIC_ENTRY_ENABLED === "true";
}
