-- Run only after disabling PLANNING_WORKSPACE_CLOUD_ENABLED.
-- Profile rows are intentionally preserved for recovery. This rollback removes
-- the app-facing import function and automatic workspace timestamp updates.

revoke execute on function public.import_planning_workspace_snapshot_v2(
  jsonb,
  uuid,
  timestamptz
) from authenticated;

drop function if exists public.import_planning_workspace_snapshot_v2(
  jsonb,
  uuid,
  timestamptz
);

drop trigger if exists planning_workspace_profiles_touch_workspace
  on public.planning_workspace_profiles;

revoke all on table public.planning_workspace_profiles from anon, authenticated;
