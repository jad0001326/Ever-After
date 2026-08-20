alter policy "Members read planning workspaces"
  on public.planning_workspaces
  using ((select private.can_access_planning_workspace(id)));
