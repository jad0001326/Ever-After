export function withPlanningWorkspace(href: string, workspaceId?: string | null) {
  if (!workspaceId) return href;
  const url = new URL(href, "https://planning-hub.local");
  url.searchParams.set("workspace", workspaceId);
  return `${url.pathname}${url.search}${url.hash}`;
}
