export function buildPlanningTableHandoffUrl(
  baseUrl: string,
  workspaceId: string | null,
) {
  const url = new URL(
    workspaceId ? "/planning-hub/organise" : "/wedding-table-planner",
    baseUrl,
  );
  if (workspaceId) {
    url.searchParams.set("workspace", workspaceId);
    url.hash = "guest-readiness-title";
  }
  return url.toString();
}
