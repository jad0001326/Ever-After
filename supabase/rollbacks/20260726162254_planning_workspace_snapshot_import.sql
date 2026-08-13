-- Run only after disabling PLANNING_WORKSPACE_CLOUD_ENABLED.
-- This removes the snapshot-import API and child timestamp triggers. It does
-- not delete planning data or reverse harmless updated_at timestamp advances.

revoke execute on function public.import_planning_workspace_snapshot(
  jsonb,
  uuid,
  timestamptz
) from authenticated;

drop function if exists public.import_planning_workspace_snapshot(
  jsonb,
  uuid,
  timestamptz
);

drop trigger if exists planning_tasks_touch_workspace on public.planning_tasks;
drop trigger if exists planning_guests_touch_workspace on public.planning_guests;
drop trigger if exists planning_tables_touch_workspace on public.planning_tables;
drop trigger if exists planning_seats_touch_workspace on public.planning_seats;
drop trigger if exists planning_seating_rules_touch_workspace on public.planning_seating_rules;

drop function if exists private.touch_planning_workspace_from_child();
