-- Serialize claim submission and review on the supplier row, then make each
-- review one transaction. Privileged write logic lives in the unexposed
-- private schema; the public review RPC remains a narrow security-invoker API.

begin;

-- Fresh stacks apply this migration before the later production hotfix that
-- removed self-service profile role changes. Harden the prerequisite here as
-- well so the review RPC is never exposed while a user can promote themself.
-- These statements are idempotent when production already has the hotfix.
revoke update on public.profiles from authenticated;
revoke update (id, email, full_name, role, created_at, updated_at)
  on public.profiles from authenticated;
drop policy if exists "Users can update own profile" on public.profiles;

do $verify_profile_role_boundary$
begin
  if has_table_privilege('authenticated', 'public.profiles', 'update') then
    raise exception 'Authenticated retains table-level profile UPDATE';
  end if;

  if exists (
    select 1
    from information_schema.column_privileges
    where table_schema = 'public'
      and table_name = 'profiles'
      and grantee = 'authenticated'
      and privilege_type = 'UPDATE'
  ) then
    raise exception 'Authenticated retains column-level profile UPDATE';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can update own profile'
  ) then
    raise exception 'Unsafe self-update profile policy remains';
  end if;
end
$verify_profile_role_boundary$;

-- Remove privileges/policies from any earlier local iteration of this
-- migration. Authenticated reviewers must use the complete transactional RPC.
revoke update (status, admin_notes, reviewed_at, reviewed_by)
  on public.supplier_claims from authenticated;
revoke insert (claim_id, supplier_id, admin_user_id, action, notes)
  on public.supplier_claim_audit_log from authenticated;
revoke select (supplier_id, invite_status), update (invite_status)
  on public.supplier_outreach_contacts from authenticated;

drop policy if exists "Admins update supplier claims" on public.supplier_claims;
drop policy if exists "Admins insert supplier claim audit" on public.supplier_claim_audit_log;
drop policy if exists "Admins read supplier outreach contacts" on public.supplier_outreach_contacts;
drop policy if exists "Admins update supplier outreach contacts" on public.supplier_outreach_contacts;

do $vendor_email_preflight$
begin
  if exists (
    select 1
    from public.vendors
    where contact_email is not null
    group by lower(btrim(contact_email))
    having count(*) > 1
  ) then
    raise exception 'Duplicate normalized vendor contact emails must be resolved before supplier claim review is enabled';
  end if;
end
$vendor_email_preflight$;

create unique index if not exists vendors_contact_email_normalized_idx
  on public.vendors (lower(btrim(contact_email)))
  where contact_email is not null;

create or replace function private.prepare_supplier_claim_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supplier public.supplier_listings%rowtype;
  v_profile_email text;
begin
  if (select auth.uid()) is null
    or new.claimant_user_id is distinct from (select auth.uid()) then
    raise exception 'Claims must belong to the authenticated user' using errcode = '42501';
  end if;
  if new.status <> 'pending'
    or new.admin_notes is not null
    or new.reviewed_at is not null
    or new.reviewed_by is not null then
    raise exception 'New supplier claims must be unreviewed and pending' using errcode = '23514';
  end if;
  if new.permission_confirmed is not true or new.terms_accepted is not true then
    raise exception 'Confirm the required permissions and terms before claiming this supplier' using errcode = '23514';
  end if;

  select suppliers.* into v_supplier
  from public.supplier_listings as suppliers
  where suppliers.id = new.supplier_id
  for update;
  if not found then
    raise exception 'Supplier profile not found' using errcode = 'P0002';
  end if;
  if v_supplier.listing_status <> 'published'
    or v_supplier.is_claimed is true
    or v_supplier.claim_status = 'approved' then
    raise exception 'This supplier profile is not available to claim' using errcode = '55000';
  end if;
  if not exists (
    select 1
    from public.supplier_categories as categories
    where categories.slug = v_supplier.category_slug
      and categories.is_live is true
  ) then
    raise exception 'This supplier category is not open for public claims' using errcode = '55000';
  end if;
  if exists (
    select 1
    from public.supplier_claims as claims
    where claims.supplier_id = new.supplier_id
      and claims.claimant_user_id = (select auth.uid())
      and claims.status in ('pending', 'approved')
  ) then
    raise exception 'You already have an active claim for this supplier' using errcode = '23505';
  end if;

  new.claimant_name := btrim(new.claimant_name);
  new.claimant_role := btrim(new.claimant_role);
  new.business_email := lower(btrim(new.business_email));
  new.business_phone := btrim(new.business_phone);
  new.message := btrim(new.message);
  new.evidence_url := nullif(btrim(coalesce(new.evidence_url, '')), '');
  if new.business_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Use a valid business email' using errcode = '23514';
  end if;

  select profiles.email into v_profile_email
  from public.profiles as profiles
  where profiles.id = (select auth.uid());
  new.claimant_email := coalesce(
    nullif(lower(btrim(coalesce(v_profile_email, ''))), ''),
    new.business_email
  );

  return new;
end;
$$;

revoke all on function private.prepare_supplier_claim_submission()
  from public, anon, authenticated, service_role;

drop trigger if exists supplier_claims_prepare_submission on public.supplier_claims;
create trigger supplier_claims_prepare_submission
before insert on public.supplier_claims
for each row execute function private.prepare_supplier_claim_submission();

-- Propagate state only after PostgreSQL has actually inserted the claim row.
-- A BEFORE-trigger side effect would survive ON CONFLICT DO NOTHING even when
-- the proposed claim itself is skipped.
create or replace function private.mark_supplier_claim_pending()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.supplier_listings as suppliers
  set claim_status = 'pending'
  where suppliers.id = new.supplier_id
    and suppliers.claim_status <> 'pending';

  return null;
end;
$$;

revoke all on function private.mark_supplier_claim_pending()
  from public, anon, authenticated, service_role;

drop trigger if exists supplier_claims_mark_supplier_pending on public.supplier_claims;
create trigger supplier_claims_mark_supplier_pending
after insert on public.supplier_claims
for each row execute function private.mark_supplier_claim_pending();

drop policy if exists "Users submit own supplier claims" on public.supplier_claims;
create policy "Users submit own supplier claims"
  on public.supplier_claims for insert to authenticated
  with check (
    (select auth.uid()) = claimant_user_id
    and status = 'pending'
    and admin_notes is null
    and reviewed_at is null
    and reviewed_by is null
    and permission_confirmed
    and terms_accepted
    and exists (
      select 1
      from public.supplier_listings as suppliers
      join public.supplier_categories as categories
        on categories.slug = suppliers.category_slug
      where suppliers.id = supplier_claims.supplier_id
        and suppliers.listing_status = 'published'
        and suppliers.is_claimed is false
        and suppliers.claim_status <> 'approved'
        and categories.is_live is true
    )
  );

create or replace function private.review_supplier_claim_internal(
  p_claim_id uuid,
  p_decision text,
  p_admin_notes text default null
)
returns table (
  reviewed_claim_id uuid,
  reviewed_supplier_id uuid,
  supplier_slug text,
  category_slug text,
  review_status text,
  claimant_user_id uuid,
  reviewed_vendor_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.supplier_claims%rowtype;
  v_supplier public.supplier_listings%rowtype;
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_notes text := nullif(btrim(left(coalesce(p_admin_notes, ''), 3000)), '');
  v_business_email text;
  v_vendor_id uuid;
  v_other_claim record;
  v_other_pending boolean := false;
  v_reviewed_at timestamptz := now();
begin
  if (select auth.uid()) is null or not (select private.is_admin()) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if v_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected' using errcode = '23514';
  end if;
  if v_decision = 'rejected' and v_notes is null then
    raise exception 'Add a short reason before rejecting this claim' using errcode = '23514';
  end if;

  select claims.* into v_claim
  from public.supplier_claims as claims
  where claims.id = p_claim_id;
  if not found then
    raise exception 'Supplier claim not found' using errcode = 'P0002';
  end if;

  select suppliers.* into v_supplier
  from public.supplier_listings as suppliers
  where suppliers.id = v_claim.supplier_id
  for update;
  if not found then
    raise exception 'Supplier linked to this claim was not found' using errcode = 'P0002';
  end if;

  -- Every review for one supplier takes locks in the same order. Re-read the
  -- claim after the supplier lock so simultaneous competing decisions cannot
  -- deadlock by each holding a different claim row first.
  select claims.* into v_claim
  from public.supplier_claims as claims
  where claims.id = p_claim_id
  for update;
  if not found then
    raise exception 'Supplier claim not found' using errcode = 'P0002';
  end if;
  if v_claim.supplier_id <> v_supplier.id then
    raise exception 'This supplier claim changed while it was being reviewed' using errcode = '40001';
  end if;
  if v_claim.status <> 'pending' then
    raise exception 'This supplier claim has already been reviewed' using errcode = '55000';
  end if;

  if v_decision = 'approved' then
    if v_supplier.listing_status <> 'published' then
      raise exception 'Only a published supplier profile can be claimed' using errcode = '55000';
    end if;
    if v_supplier.is_claimed is true or v_supplier.claim_status = 'approved' then
      raise exception 'This supplier profile has already been claimed' using errcode = '55000';
    end if;
    if v_claim.permission_confirmed is not true or v_claim.terms_accepted is not true then
      raise exception 'The claimant has not confirmed the required permissions and terms' using errcode = '23514';
    end if;

    v_business_email := lower(btrim(v_claim.business_email));
    if v_business_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'The claim does not contain a valid business email' using errcode = '23514';
    end if;

    select vendors.id into v_vendor_id
    from public.vendors as vendors
    where lower(btrim(vendors.contact_email)) = v_business_email
    for update;

    if v_vendor_id is null then
      insert into public.vendors (name, contact_email, contact_phone)
      values (v_supplier.name, v_business_email, btrim(v_claim.business_phone))
      on conflict do nothing
      returning id into v_vendor_id;

      if v_vendor_id is null then
        select vendors.id into v_vendor_id
        from public.vendors as vendors
        where lower(btrim(vendors.contact_email)) = v_business_email
        for update;
      end if;
    end if;

    if v_vendor_id is null then
      raise exception 'Supplier access could not be created' using errcode = '55000';
    end if;
    if v_supplier.vendor_id is not null and v_supplier.vendor_id <> v_vendor_id then
      raise exception 'This supplier profile is already linked to another vendor record' using errcode = '55000';
    end if;

    insert into public.vendor_users (vendor_id, user_id, role, status)
    values (
      v_vendor_id,
      v_claim.claimant_user_id,
      coalesce(nullif(btrim(v_claim.claimant_role), ''), 'owner'),
      'active'
    )
    on conflict (vendor_id, user_id) do update
    set role = excluded.role,
        status = 'active';

    update public.supplier_claims as claims
    set status = 'approved',
        admin_notes = v_notes,
        reviewed_at = v_reviewed_at,
        reviewed_by = (select auth.uid())
    where claims.id = v_claim.id;

    update public.supplier_listings as suppliers
    set vendor_id = v_vendor_id,
        is_claimed = true,
        claim_status = 'approved',
        reviewed_at = v_reviewed_at,
        reviewed_by = (select auth.uid())
    where suppliers.id = v_supplier.id
    returning suppliers.* into v_supplier;

    for v_other_claim in
      update public.supplier_claims as claims
      set status = 'rejected',
          admin_notes = 'Automatically rejected after another claim for this supplier was approved.',
          reviewed_at = v_reviewed_at,
          reviewed_by = (select auth.uid())
      where claims.supplier_id = v_supplier.id
        and claims.id <> v_claim.id
        and claims.status = 'pending'
      returning claims.id
    loop
      insert into public.supplier_claim_audit_log (
        claim_id,
        supplier_id,
        admin_user_id,
        action,
        notes
      ) values (
        v_other_claim.id,
        v_supplier.id,
        (select auth.uid()),
        'rejected',
        'Automatically rejected after another claim for this supplier was approved.'
      );
    end loop;

    update public.supplier_outreach_contacts as contacts
    set invite_status = 'claimed'
    where contacts.supplier_id = v_supplier.id
      and contacts.invite_status <> 'claimed';
  else
    update public.supplier_claims as claims
    set status = 'rejected',
        admin_notes = v_notes,
        reviewed_at = v_reviewed_at,
        reviewed_by = (select auth.uid())
    where claims.id = v_claim.id;

    if v_supplier.is_claimed is not true and v_supplier.claim_status <> 'approved' then
      select exists (
        select 1
        from public.supplier_claims as claims
        where claims.supplier_id = v_supplier.id
          and claims.id <> v_claim.id
          and claims.status = 'pending'
      ) into v_other_pending;

      update public.supplier_listings as suppliers
      set is_claimed = false,
          claim_status = case when v_other_pending then 'pending' else 'rejected' end
      where suppliers.id = v_supplier.id
      returning suppliers.* into v_supplier;
    end if;
  end if;

  insert into public.supplier_claim_audit_log (
    claim_id,
    supplier_id,
    admin_user_id,
    action,
    notes
  ) values (
    v_claim.id,
    v_supplier.id,
    (select auth.uid()),
    v_decision,
    v_notes
  );

  return query select
    v_claim.id,
    v_supplier.id,
    v_supplier.slug,
    v_supplier.category_slug,
    v_decision,
    v_claim.claimant_user_id,
    v_supplier.vendor_id;
end;
$$;

revoke all on function private.review_supplier_claim_internal(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function private.review_supplier_claim_internal(uuid, text, text)
  to authenticated;

create or replace function public.review_supplier_claim(
  p_claim_id uuid,
  p_decision text,
  p_admin_notes text default null
)
returns table (
  reviewed_claim_id uuid,
  reviewed_supplier_id uuid,
  supplier_slug text,
  category_slug text,
  review_status text,
  claimant_user_id uuid,
  reviewed_vendor_id uuid
)
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.review_supplier_claim_internal(
    p_claim_id,
    p_decision,
    p_admin_notes
  );
$$;

revoke all on function public.review_supplier_claim(uuid, text, text)
  from public, anon, service_role;
grant execute on function public.review_supplier_claim(uuid, text, text)
  to authenticated;

comment on function public.review_supplier_claim(uuid, text, text) is
  'Atomically approves or rejects one pending supplier claim after an authenticated admin check.';

notify pgrst, 'reload schema';

commit;
