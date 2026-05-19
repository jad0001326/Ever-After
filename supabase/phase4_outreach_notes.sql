-- Phase 4 vendor outreach workflow patch.
-- Adds lightweight admin notes for manual venue outreach tracking.

alter table public.venues
  add column if not exists outreach_notes text;

notify pgrst, 'reload schema';
