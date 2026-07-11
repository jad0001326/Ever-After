-- Phase 8: align the OAuth MCP audience with the canonical www domain.
-- Run this once when upgrading an existing project that previously ran phase 7.

create or replace function public.everaft_mcp_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  oauth_client_id text;
begin
  claims := event -> 'claims';
  oauth_client_id := coalesce(event ->> 'client_id', claims ->> 'client_id');
  if oauth_client_id is not null then
    claims := jsonb_set(claims, '{aud}', to_jsonb('https://www.everaft.co.uk/api/mcp'::text));
    claims := jsonb_set(claims, '{everaft_mcp}', 'true'::jsonb);
  end if;
  return jsonb_build_object('claims', claims);
end;
$$;

grant execute on function public.everaft_mcp_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.everaft_mcp_access_token_hook(jsonb) from anon, authenticated, public;

notify pgrst, 'reload schema';
