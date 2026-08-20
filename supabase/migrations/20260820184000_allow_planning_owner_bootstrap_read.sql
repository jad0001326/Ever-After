-- PostgreSQL checks SELECT visibility for INSERT ... RETURNING before the
-- AFTER INSERT owner-membership trigger has populated planning_workspace_members.
-- The owner_id column is already protected by the INSERT policy and immutable
-- to non-owners, so recognizing the owner directly is equivalent to the
-- membership created later in the same statement.

alter policy "Members read planning workspaces"
  on public.planning_workspaces
  using (
    owner_id = (select auth.uid())
    or (select private.can_access_planning_workspace(id))
  );
