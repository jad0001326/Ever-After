-- Phase 1 launch-readiness patch.
-- Allows venues to have unknown pricing without storing or displaying fake zero values.

alter table public.venues
  alter column price_from drop not null,
  alter column price_to drop not null;

notify pgrst, 'reload schema';
