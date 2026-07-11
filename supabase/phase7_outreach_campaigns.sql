-- Phase 7: approval-gated venue outreach campaigns.
-- Run after supabase/schema.sql. These tables are deliberately server-only:
-- authenticated admins use trusted server actions, while the ChatGPT MCP
-- connection is authenticated with Supabase OAuth and re-checks the admin role.

alter table public.venues
  add column if not exists vendor_contact_source_url text,
  add column if not exists vendor_contact_verified_at timestamptz,
  add column if not exists vendor_contact_verified_by uuid references public.profiles(id) on delete set null;

create table if not exists public.outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  kind text not null default 'initial_invite' check (kind in ('initial_invite', 'follow_up')),
  source text not null default 'admin' check (source in ('admin', 'chatgpt')),
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'partially_sent', 'failed', 'cancelled')),
  subject text not null check (char_length(subject) between 1 and 160),
  preheader text not null check (char_length(preheader) between 1 and 220),
  intro_text text not null check (char_length(intro_text) between 20 and 2000),
  offer_text text not null check (char_length(offer_text) between 10 and 1000),
  audience_filter jsonb not null default '{}'::jsonb,
  approval_fingerprint text unique,
  recipient_count integer not null default 0 check (recipient_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  send_attempts integer not null default 0 check (send_attempts >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outreach_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.outreach_campaigns(id) on delete cascade,
  venue_id uuid references public.venues(id) on delete set null,
  venue_slug text not null,
  business_name text not null,
  town text not null,
  region text not null,
  email text not null check (char_length(email) <= 254),
  normalized_email text generated always as (lower(btrim(email))) stored,
  contact_source_url text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'delivered', 'failed', 'bounced', 'complained', 'replied', 'unsubscribed', 'suppressed')),
  resend_email_id text,
  unsubscribe_token_hash text unique,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, normalized_email)
);

alter table public.outreach_campaign_recipients
  add column if not exists contact_source_url text;

create table if not exists public.outreach_suppressions (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) <= 254),
  normalized_email text generated always as (lower(btrim(email))) stored,
  reason text not null check (reason in ('unsubscribed', 'bounced', 'complained', 'provider_suppressed', 'manual')),
  source text not null default 'recipient',
  created_at timestamptz not null default now(),
  unique (normalized_email)
);

create table if not exists public.outreach_email_events (
  id text primary key,
  resend_email_id text not null,
  event_type text not null,
  event_created_at timestamptz,
  received_at timestamptz not null default now()
);

create index if not exists outreach_campaigns_status_created_idx
  on public.outreach_campaigns (status, created_at desc);
create index if not exists outreach_campaign_recipients_campaign_status_idx
  on public.outreach_campaign_recipients (campaign_id, status);
create index if not exists outreach_campaign_recipients_venue_idx
  on public.outreach_campaign_recipients (venue_id, created_at desc);
create unique index if not exists outreach_campaign_recipients_resend_id_idx
  on public.outreach_campaign_recipients (resend_email_id)
  where resend_email_id is not null;
create index if not exists outreach_email_events_resend_idx
  on public.outreach_email_events (resend_email_id, received_at desc);

drop trigger if exists outreach_campaigns_set_updated_at on public.outreach_campaigns;
create trigger outreach_campaigns_set_updated_at
before update on public.outreach_campaigns
for each row execute function public.set_updated_at();

drop trigger if exists outreach_campaign_recipients_set_updated_at on public.outreach_campaign_recipients;
create trigger outreach_campaign_recipients_set_updated_at
before update on public.outreach_campaign_recipients
for each row execute function public.set_updated_at();

alter table public.outreach_campaigns enable row level security;
alter table public.outreach_campaign_recipients enable row level security;
alter table public.outreach_suppressions enable row level security;
alter table public.outreach_email_events enable row level security;

revoke all on public.outreach_campaigns from anon, authenticated;
revoke all on public.outreach_campaign_recipients from anon, authenticated;
revoke all on public.outreach_suppressions from anon, authenticated;
revoke all on public.outreach_email_events from anon, authenticated;

-- Select this function under Authentication > Hooks > Custom Access Token.
-- It binds OAuth access tokens to the production EverAft MCP resource. Direct
-- website sessions do not contain client_id and keep their normal audience.
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
