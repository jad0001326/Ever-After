-- Extend the approval-gated venue outreach foundation to photographers while
-- keeping contact details and legal-basis evidence out of public listings.

alter table public.outreach_campaigns
  add column if not exists audience_type text not null default 'venue';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'outreach_campaigns_audience_type_check') then
    alter table public.outreach_campaigns
      add constraint outreach_campaigns_audience_type_check
      check (audience_type in ('venue', 'photographer'));
  end if;
end
$$;

alter table public.outreach_campaign_recipients
  add column if not exists supplier_id uuid references public.supplier_listings(id) on delete set null,
  add column if not exists subject_type text not null default 'venue',
  add column if not exists listing_slug text;

update public.outreach_campaign_recipients
set listing_slug = venue_slug
where listing_slug is null;

alter table public.outreach_campaign_recipients
  alter column listing_slug set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'outreach_recipients_subject_type_check') then
    alter table public.outreach_campaign_recipients
      add constraint outreach_recipients_subject_type_check
      check (subject_type in ('venue', 'photographer'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'outreach_recipients_subject_reference_check') then
    alter table public.outreach_campaign_recipients
      add constraint outreach_recipients_subject_reference_check
      check (
        (subject_type = 'venue' and supplier_id is null)
        or
        (subject_type = 'photographer' and supplier_id is not null and venue_id is null)
      );
  end if;
end
$$;

create index if not exists outreach_campaigns_audience_created_idx
  on public.outreach_campaigns (audience_type, created_at desc);
create index if not exists outreach_campaign_recipients_supplier_idx
  on public.outreach_campaign_recipients (supplier_id, created_at desc)
  where supplier_id is not null;

create table if not exists public.supplier_outreach_contacts (
  supplier_id uuid primary key references public.supplier_listings(id) on delete cascade,
  email text check (email is null or char_length(email) <= 254),
  normalized_email text generated always as (case when email is null then null else lower(btrim(email)) end) stored,
  contact_source_url text,
  business_structure text not null default 'unknown' check (
    business_structure in (
      'unknown',
      'limited_company',
      'limited_liability_partnership',
      'scottish_partnership',
      'other_corporate',
      'sole_trader',
      'unincorporated_partnership'
    )
  ),
  company_number text check (company_number is null or char_length(company_number) <= 32),
  legal_basis text not null default 'unreviewed' check (
    legal_basis in ('unreviewed', 'corporate_subscriber', 'consent', 'soft_opt_in', 'not_eligible')
  ),
  consent_evidence_url text,
  eligibility_notes text check (eligibility_notes is null or char_length(eligibility_notes) <= 2000),
  invite_status text not null default 'not_sent' check (
    invite_status in ('not_sent', 'sent', 'bounced', 'replied', 'claimed', 'suppressed')
  ),
  invite_sent_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_outreach_contact_basis_check check (
    legal_basis in ('unreviewed', 'not_eligible')
    or (
      email is not null
      and contact_source_url is not null
      and verified_at is not null
      and (
        (
          legal_basis = 'corporate_subscriber'
          and business_structure in ('limited_company', 'limited_liability_partnership', 'scottish_partnership', 'other_corporate')
        )
        or (
          legal_basis in ('consent', 'soft_opt_in')
          and consent_evidence_url is not null
        )
      )
    )
  )
);

comment on table public.supplier_outreach_contacts is
  'Protected supplier invitation contacts, business status and PECR/UK GDPR eligibility evidence. Never expose through public listing queries.';

create unique index if not exists supplier_outreach_contacts_email_idx
  on public.supplier_outreach_contacts (normalized_email)
  where normalized_email is not null;
create index if not exists supplier_outreach_contacts_queue_idx
  on public.supplier_outreach_contacts (legal_basis, invite_status, updated_at desc);
create index if not exists supplier_outreach_contacts_reviewer_idx
  on public.supplier_outreach_contacts (verified_by)
  where verified_by is not null;

drop trigger if exists supplier_outreach_contacts_set_updated_at on public.supplier_outreach_contacts;
create trigger supplier_outreach_contacts_set_updated_at
before update on public.supplier_outreach_contacts
for each row execute function public.set_updated_at();

create table if not exists public.supplier_claims (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.supplier_listings(id) on delete cascade,
  claimant_user_id uuid not null references public.profiles(id) on delete cascade,
  claimant_name text not null check (char_length(btrim(claimant_name)) between 1 and 160),
  claimant_email text not null check (char_length(claimant_email) <= 254),
  claimant_role text not null check (char_length(btrim(claimant_role)) between 1 and 120),
  business_email text not null check (char_length(business_email) <= 254),
  business_phone text not null check (char_length(btrim(business_phone)) between 3 and 80),
  message text not null check (char_length(btrim(message)) between 10 and 3000),
  evidence_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  permission_confirmed boolean not null default false,
  terms_accepted boolean not null default false,
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 3000),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists supplier_claims_open_claim_idx
  on public.supplier_claims (supplier_id, claimant_user_id)
  where status in ('pending', 'approved');
create index if not exists supplier_claims_status_created_idx
  on public.supplier_claims (status, created_at desc);
create index if not exists supplier_claims_reviewer_idx
  on public.supplier_claims (reviewed_by)
  where reviewed_by is not null;

drop trigger if exists supplier_claims_set_updated_at on public.supplier_claims;
create trigger supplier_claims_set_updated_at
before update on public.supplier_claims
for each row execute function public.set_updated_at();

create table if not exists public.supplier_claim_audit_log (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.supplier_claims(id) on delete cascade,
  supplier_id uuid not null references public.supplier_listings(id) on delete cascade,
  admin_user_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('approved', 'rejected', 'reopened')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists supplier_claim_audit_log_claim_idx
  on public.supplier_claim_audit_log (claim_id, created_at desc);
create index if not exists supplier_claim_audit_log_supplier_idx
  on public.supplier_claim_audit_log (supplier_id, created_at desc);

alter table public.supplier_outreach_contacts enable row level security;
alter table public.supplier_claims enable row level security;
alter table public.supplier_claim_audit_log enable row level security;

revoke all on public.supplier_outreach_contacts from anon, authenticated;
revoke all on public.supplier_claim_audit_log from anon, authenticated;
revoke all on public.supplier_claims from anon;
grant select, insert on public.supplier_claims to authenticated;

drop policy if exists "Users read own supplier claims" on public.supplier_claims;
create policy "Users read own supplier claims"
  on public.supplier_claims for select to authenticated
  using ((select auth.uid()) = claimant_user_id or (select public.is_admin()));

drop policy if exists "Users submit own supplier claims" on public.supplier_claims;
create policy "Users submit own supplier claims"
  on public.supplier_claims for insert to authenticated
  with check (
    (select auth.uid()) = claimant_user_id
    and status = 'pending'
    and permission_confirmed
    and terms_accepted
  );

grant select, insert, update, delete on table
  public.supplier_outreach_contacts,
  public.supplier_claims,
  public.supplier_claim_audit_log
to service_role;

create or replace function public.sync_supplier_invite_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status text;
begin
  if new.supplier_id is null then
    return new;
  end if;

  next_status := case
    when new.status in ('sent', 'delivered') then 'sent'
    when new.status = 'replied' then 'replied'
    when new.status = 'bounced' then 'bounced'
    when new.status in ('unsubscribed', 'suppressed', 'complained') then 'suppressed'
    else null
  end;

  if next_status is not null then
    update public.supplier_outreach_contacts
    set
      invite_status = next_status,
      invite_sent_at = case
        when next_status in ('sent', 'replied') then coalesce(invite_sent_at, new.sent_at, now())
        else invite_sent_at
      end
    where supplier_id = new.supplier_id
      and invite_status <> 'claimed';
  end if;

  return new;
end;
$$;

revoke all on function public.sync_supplier_invite_status() from public, anon, authenticated;

drop trigger if exists outreach_recipient_sync_supplier_status on public.outreach_campaign_recipients;
create trigger outreach_recipient_sync_supplier_status
after insert or update of status on public.outreach_campaign_recipients
for each row execute function public.sync_supplier_invite_status();

notify pgrst, 'reload schema';
