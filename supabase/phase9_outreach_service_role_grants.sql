-- Phase 9: allow the trusted server-side outreach client to access its tables.
-- The service_role key stays server-only and bypasses RLS by design.

grant usage on schema public to service_role;

grant select, insert, update, delete
on table
  public.venues,
  public.outreach_campaigns,
  public.outreach_campaign_recipients,
  public.outreach_suppressions,
  public.outreach_email_events
to service_role;

notify pgrst, 'reload schema';
