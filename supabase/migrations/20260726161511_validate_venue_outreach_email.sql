-- Reject malformed venue outreach addresses before they can be promoted or
-- submitted to a provider batch. The trigger is intentionally scoped to
-- inserts and changes to vendor_contact_email so legacy rows do not block
-- unrelated venue updates.

create or replace function public.validate_venue_outreach_email()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(new.vendor_contact_email, '')));
begin
  if v_email = '' then
    new.vendor_contact_email := null;
    return new;
  end if;

  if char_length(v_email) > 254
     or v_email !~* '^[^[:space:]@]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$' then
    raise exception 'Enter a valid business email address' using errcode = '22023';
  end if;

  new.vendor_contact_email := v_email;
  return new;
end;
$$;

revoke all on function public.validate_venue_outreach_email() from public, anon, authenticated;

drop trigger if exists venues_validate_outreach_email on public.venues;
create trigger venues_validate_outreach_email
before insert or update of vendor_contact_email on public.venues
for each row
execute function public.validate_venue_outreach_email();

notify pgrst, 'reload schema';
