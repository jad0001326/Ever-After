import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const ids = {
  claimant: "11000000-0000-4000-8000-000000000001",
  competitor: "12000000-0000-4000-8000-000000000002",
  outsider: "13000000-0000-4000-8000-000000000003",
  admin: "14000000-0000-4000-8000-000000000004",
  existingVendor: "21000000-0000-4000-8000-000000000001",
  approveSupplier: "31000000-0000-4000-8000-000000000001",
  rejectSupplier: "32000000-0000-4000-8000-000000000002",
  rollbackSupplier: "33000000-0000-4000-8000-000000000003",
  draftSupplier: "34000000-0000-4000-8000-000000000004",
  claimedSupplier: "35000000-0000-4000-8000-000000000005",
  inactiveSupplier: "36000000-0000-4000-8000-000000000006",
  conflictSupplier: "37000000-0000-4000-8000-000000000007",
  approveClaim: "41000000-0000-4000-8000-000000000001",
  competingClaim: "42000000-0000-4000-8000-000000000002",
  rejectClaim: "43000000-0000-4000-8000-000000000003",
  remainingClaim: "44000000-0000-4000-8000-000000000004",
  rollbackClaim: "45000000-0000-4000-8000-000000000005",
};

function assert(condition, message) {
  if (!condition) throw new Error(`Supplier claim review contract failed: ${message}`);
}

async function asUser(db, userId, sql) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);");
  }
}

async function expectDenied(action, message) {
  try {
    await action();
  } catch {
    return;
  }
  throw new Error(`Supplier claim review contract failed: ${message}`);
}

function claimInsertSql({ claimId, supplierId, claimantId, businessEmail, role = "Owner" }) {
  return `insert into public.supplier_claims (
    id, supplier_id, claimant_user_id, claimant_name, claimant_email, claimant_role,
    business_email, business_phone, message, permission_confirmed, terms_accepted
  ) values (
    '${claimId}', '${supplierId}', '${claimantId}', 'Submitted claimant',
    'untrusted-input@example.com', '${role}', '${businessEmail}', '0131 555 0101',
    'I am authorised to claim this supplier business.', true, true
  )`;
}

const db = await PGlite.create({ extensions: { pgcrypto } });
let failure = null;

try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create schema auth;
    create schema private authorization postgres;

    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;

    create table public.profiles (
      id uuid primary key,
      email text,
      full_name text,
      role text not null default 'couple',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table public.vendors (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      contact_email text unique,
      contact_phone text,
      status text not null default 'active',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table public.vendor_users (
      vendor_id uuid not null references public.vendors(id),
      user_id uuid not null references public.profiles(id),
      role text not null default 'owner',
      status text not null default 'active',
      created_at timestamptz not null default now(),
      primary key (vendor_id, user_id)
    );
    create table public.supplier_categories (
      slug text primary key,
      is_live boolean not null default false
    );
    create table public.supplier_listings (
      id uuid primary key default gen_random_uuid(),
      vendor_id uuid references public.vendors(id),
      category_slug text not null references public.supplier_categories(slug),
      slug text not null unique,
      name text not null,
      listing_status text not null default 'draft',
      claim_status text not null default 'unclaimed',
      is_claimed boolean not null default false,
      reviewed_at timestamptz,
      reviewed_by uuid references public.profiles(id),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table public.supplier_outreach_contacts (
      supplier_id uuid primary key references public.supplier_listings(id),
      invite_status text not null default 'not_sent',
      updated_at timestamptz not null default now()
    );
    create table public.supplier_claims (
      id uuid primary key default gen_random_uuid(),
      supplier_id uuid not null references public.supplier_listings(id),
      claimant_user_id uuid not null references public.profiles(id),
      claimant_name text not null,
      claimant_email text not null,
      claimant_role text not null,
      business_email text not null,
      business_phone text not null,
      message text not null,
      evidence_url text,
      status text not null default 'pending',
      permission_confirmed boolean not null default false,
      terms_accepted boolean not null default false,
      admin_notes text,
      reviewed_at timestamptz,
      reviewed_by uuid references public.profiles(id),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create unique index supplier_claims_open_claim_idx
      on public.supplier_claims (supplier_id, claimant_user_id)
      where status in ('pending', 'approved');
    create table public.supplier_claim_audit_log (
      id uuid primary key default gen_random_uuid(),
      claim_id uuid not null references public.supplier_claims(id),
      supplier_id uuid not null references public.supplier_listings(id),
      admin_user_id uuid references public.profiles(id),
      action text not null,
      notes text,
      created_at timestamptz not null default now()
    );

    create function private.is_admin() returns boolean
    language sql stable security definer set search_path = pg_catalog as $$
      select exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
      )
    $$;

    grant usage on schema public, auth, private to anon, authenticated, service_role;
    grant execute on function auth.uid(), private.is_admin() to anon, authenticated, service_role;
    grant select, update on public.profiles to authenticated;
    grant select on public.supplier_categories to anon, authenticated;
    grant select, update on public.supplier_listings to authenticated;
    grant select, insert, update, delete on public.vendors, public.vendor_users to authenticated;
    grant select, insert on public.supplier_claims to authenticated;
    grant select, insert, update, delete on public.supplier_claims, public.supplier_claim_audit_log, public.supplier_outreach_contacts to service_role;

    alter table public.profiles enable row level security;
    alter table public.vendors enable row level security;
    alter table public.vendor_users enable row level security;
    alter table public.supplier_listings enable row level security;
    alter table public.supplier_claims enable row level security;
    alter table public.supplier_claim_audit_log enable row level security;
    alter table public.supplier_outreach_contacts enable row level security;

    create policy "Users can read own profile" on public.profiles for select to authenticated
      using (id = auth.uid() or private.is_admin());
    create policy "Users can update own profile" on public.profiles for update to authenticated
      using (id = auth.uid()) with check (id = auth.uid());
    create policy "Admins can read profiles" on public.profiles for select to authenticated
      using (private.is_admin());
    create policy "Admins manage vendors" on public.vendors for all to authenticated
      using (private.is_admin()) with check (private.is_admin());
    create policy "Vendor users read own vendor" on public.vendors for select to authenticated
      using (exists (
        select 1 from public.vendor_users
        where vendor_users.vendor_id = vendors.id and vendor_users.user_id = auth.uid()
      ));
    create policy "Admins manage vendor users" on public.vendor_users for all to authenticated
      using (private.is_admin()) with check (private.is_admin());
    create policy "Vendor users read own links" on public.vendor_users for select to authenticated
      using (user_id = auth.uid());
    create policy "Published supplier listings are public" on public.supplier_listings for select
      using (listing_status = 'published' or private.is_admin());
    create policy "Admins update supplier listings" on public.supplier_listings for update to authenticated
      using (private.is_admin()) with check (private.is_admin());
    create policy "Users read own supplier claims" on public.supplier_claims for select to authenticated
      using (auth.uid() = claimant_user_id or private.is_admin());
    create policy "Users submit own supplier claims" on public.supplier_claims for insert to authenticated
      with check (
        auth.uid() = claimant_user_id
        and status = 'pending'
        and permission_confirmed
        and terms_accepted
      );

    insert into public.profiles (id, email, full_name, role) values
      ('${ids.claimant}', 'claimant@example.com', 'Claimant', 'couple'),
      ('${ids.competitor}', 'competitor@example.com', 'Competitor', 'couple'),
      ('${ids.outsider}', 'outsider@example.com', 'Outsider', 'couple'),
      ('${ids.admin}', 'admin@example.com', 'Admin', 'admin');
    insert into public.vendors (id, name, contact_email, contact_phone)
      values ('${ids.existingVendor}', 'Existing supplier business', 'Claimant@Example.com', '0131 555 0101');
    insert into public.supplier_categories (slug, is_live) values
      ('photographer', true),
      ('florist', true),
      ('videographer', true),
      ('inactive', false);
  `);

  const migration = await readFile(
    new URL("../supabase/migrations/20260811094148_atomic_supplier_claim_review.sql", import.meta.url),
    "utf8",
  );
  const normalizedMigration = migration.replaceAll("\r\n", "\n");
  const reviewFunction = normalizedMigration.slice(
    normalizedMigration.indexOf("create or replace function private.review_supplier_claim_internal"),
    normalizedMigration.indexOf("revoke all on function private.review_supplier_claim_internal"),
  );
  const supplierLock = reviewFunction.indexOf(
    "from public.supplier_listings as suppliers\n  where suppliers.id = v_claim.supplier_id\n  for update",
  );
  const targetClaimLock = reviewFunction.indexOf(
    "from public.supplier_claims as claims\n  where claims.id = p_claim_id\n  for update",
  );
  assert(supplierLock >= 0, "review no longer locks the supplier row");
  assert(targetClaimLock > supplierLock, "review locks a claim before its supplier and can deadlock competing decisions");
  await db.exec(migration);

  // The later production hotfix remains idempotent in chronological fresh-stack order.
  const profileGrantMigration = await readFile(
    new URL("../supabase/migrations/20260813074826_lock_down_profile_role_updates.sql", import.meta.url),
    "utf8",
  );
  await db.exec(profileGrantMigration);

  await db.exec(`
    insert into public.supplier_listings (id, category_slug, slug, name, listing_status, claim_status) values
      ('${ids.approveSupplier}', 'photographer', 'approval-photography', 'Approval Photography', 'published', 'unclaimed'),
      ('${ids.rejectSupplier}', 'florist', 'rejection-flowers', 'Rejection Flowers', 'published', 'unclaimed'),
      ('${ids.rollbackSupplier}', 'videographer', 'rollback-films', 'Rollback Films', 'published', 'unclaimed'),
      ('${ids.draftSupplier}', 'photographer', 'draft-photography', 'Draft Photography', 'draft', 'unclaimed'),
      ('${ids.claimedSupplier}', 'photographer', 'claimed-photography', 'Claimed Photography', 'published', 'approved'),
      ('${ids.inactiveSupplier}', 'inactive', 'inactive-supplier', 'Inactive Supplier', 'published', 'unclaimed'),
      ('${ids.conflictSupplier}', 'florist', 'conflict-flowers', 'Conflict Flowers', 'published', 'unclaimed');
    update public.supplier_listings
      set vendor_id = '${ids.existingVendor}', is_claimed = true
      where id = '${ids.claimedSupplier}';
    insert into public.supplier_outreach_contacts (supplier_id, invite_status) values
      ('${ids.approveSupplier}', 'sent'),
      ('${ids.rollbackSupplier}', 'sent');
  `);

  await expectDenied(
    () => asUser(db, ids.claimant, claimInsertSql({ claimId: "51000000-0000-4000-8000-000000000001", supplierId: ids.draftSupplier, claimantId: ids.claimant, businessEmail: "draft@example.com" })),
    "a claim can be submitted for a draft supplier",
  );
  await expectDenied(
    () => asUser(db, ids.claimant, claimInsertSql({ claimId: "52000000-0000-4000-8000-000000000002", supplierId: ids.claimedSupplier, claimantId: ids.claimant, businessEmail: "claimed@example.com" })),
    "a claim can be submitted for an already claimed supplier",
  );
  await expectDenied(
    () => asUser(db, ids.claimant, claimInsertSql({ claimId: "53000000-0000-4000-8000-000000000003", supplierId: ids.inactiveSupplier, claimantId: ids.claimant, businessEmail: "inactive@example.com" })),
    "a claim can be submitted for an inactive category",
  );

  await asUser(db, ids.claimant, claimInsertSql({ claimId: ids.approveClaim, supplierId: ids.approveSupplier, claimantId: ids.claimant, businessEmail: "claimant@example.com" }));
  await asUser(
    db,
    ids.claimant,
    `${claimInsertSql({ claimId: ids.approveClaim, supplierId: ids.conflictSupplier, claimantId: ids.claimant, businessEmail: "ignored@example.com" })} on conflict do nothing`,
  );
  const ignoredConflictState = await db.query(`
    select
      (select count(*)::int from public.supplier_claims where supplier_id = '${ids.conflictSupplier}') as claim_count,
      (select claim_status from public.supplier_listings where id = '${ids.conflictSupplier}') as claim_status
  `);
  assert(ignoredConflictState.rows[0]?.claim_count === 0, "handled claim-id conflict inserted an unexpected claim row");
  assert(ignoredConflictState.rows[0]?.claim_status === "unclaimed", "handled claim-id conflict changed supplier state without a claim row");
  await asUser(db, ids.competitor, claimInsertSql({ claimId: ids.competingClaim, supplierId: ids.approveSupplier, claimantId: ids.competitor, businessEmail: "competitor@example.com", role: "Manager" }));
  await asUser(db, ids.claimant, claimInsertSql({ claimId: ids.rejectClaim, supplierId: ids.rejectSupplier, claimantId: ids.claimant, businessEmail: "flowers@example.com" }));
  await asUser(db, ids.competitor, claimInsertSql({ claimId: ids.remainingClaim, supplierId: ids.rejectSupplier, claimantId: ids.competitor, businessEmail: "flowers-two@example.com" }));
  await asUser(db, ids.claimant, claimInsertSql({ claimId: ids.rollbackClaim, supplierId: ids.rollbackSupplier, claimantId: ids.claimant, businessEmail: "rollback@example.com" }));

  const submittedState = await db.query(`
    select claims.claimant_email, suppliers.claim_status
    from public.supplier_claims as claims
    join public.supplier_listings as suppliers on suppliers.id = claims.supplier_id
    where claims.id = '${ids.approveClaim}'
  `);
  assert(submittedState.rows[0]?.claimant_email === "claimant@example.com", "submission retained a caller-controlled account email");
  assert(submittedState.rows[0]?.claim_status === "pending", "submission did not atomically mark the supplier pending");

  await expectDenied(
    () => asUser(db, ids.claimant, `update public.profiles set role = 'admin' where id = '${ids.claimant}'`),
    "a signed-in user can still promote their own profile to administrator",
  );
  const claimantProfile = await db.query(`select role from public.profiles where id = '${ids.claimant}'`);
  assert(claimantProfile.rows[0]?.role === "couple", "failed role escalation changed the claimant profile");
  const profilePrivileges = await db.query(`
    select
      has_table_privilege('authenticated', 'public.profiles', 'update') as table_update,
      has_column_privilege('authenticated', 'public.profiles', 'role', 'update') as role_update
  `);
  assert(profilePrivileges.rows[0]?.table_update === false, "authenticated retains table-level profile UPDATE");
  assert(profilePrivileges.rows[0]?.role_update === false, "authenticated retains profile role UPDATE");

  await expectDenied(
    () => asUser(db, ids.outsider, `select * from public.review_supplier_claim('${ids.approveClaim}', 'approved', null)`),
    "a non-admin can execute a claim decision",
  );
  await expectDenied(
    () => asUser(db, ids.claimant, `select * from public.review_supplier_claim('${ids.approveClaim}', 'approved', null)`),
    "a claimant can approve their own claim",
  );

  await expectDenied(
    () => asUser(db, ids.claimant, `update public.supplier_claims set status = 'approved' where id = '${ids.approveClaim}'`),
    "a claimant can directly change review status",
  );
  const directClaimMutation = await db.query(`select status from public.supplier_claims where id = '${ids.approveClaim}'`);
  assert(directClaimMutation.rows[0]?.status === "pending", "a claimant can directly change review status");
  await expectDenied(
    () => asUser(db, ids.admin, `update public.supplier_claims set supplier_id = '${ids.rejectSupplier}' where id = '${ids.approveClaim}'`),
    "the claim-review grant allows ownership fields to be rewritten",
  );
  await expectDenied(
    () => asUser(db, ids.admin, `update public.supplier_claims set status = 'rejected', reviewed_by = '${ids.admin}', reviewed_at = now() where id = '${ids.approveClaim}'`),
    "an administrator can bypass the atomic review RPC",
  );
  await expectDenied(
    () => asUser(db, ids.claimant, `insert into public.supplier_claim_audit_log (claim_id, supplier_id, action) values ('${ids.approveClaim}', '${ids.approveSupplier}', 'approved')`),
    "a claimant can insert a review audit event",
  );
  await expectDenied(
    () => asUser(db, ids.claimant, `update public.supplier_outreach_contacts set invite_status = 'claimed' where supplier_id = '${ids.approveSupplier}'`),
    "a claimant can change protected outreach state",
  );
  const directOutreachMutation = await db.query(`select invite_status from public.supplier_outreach_contacts where supplier_id = '${ids.approveSupplier}'`);
  assert(directOutreachMutation.rows[0]?.invite_status === "sent", "a claimant can change protected outreach state");

  const approval = await asUser(
    db,
    ids.admin,
    `select * from public.review_supplier_claim('${ids.approveClaim}', 'approved', 'Evidence checked')`,
  );
  assert(approval.rows[0]?.reviewed_claim_id === ids.approveClaim, "approval returned the wrong claim");
  assert(approval.rows[0]?.reviewed_vendor_id === ids.existingVendor, "case-insensitive vendor reuse failed");

  const approvedState = await db.query(`
    select
      claims.status,
      claims.reviewed_by,
      suppliers.vendor_id,
      suppliers.is_claimed,
      suppliers.claim_status,
      contacts.invite_status
    from public.supplier_claims as claims
    join public.supplier_listings as suppliers on suppliers.id = claims.supplier_id
    join public.supplier_outreach_contacts as contacts on contacts.supplier_id = suppliers.id
    where claims.id = '${ids.approveClaim}'
  `);
  assert(approvedState.rows[0]?.status === "approved", "target claim was not approved");
  assert(approvedState.rows[0]?.reviewed_by === ids.admin, "approval did not record the administrator");
  assert(approvedState.rows[0]?.vendor_id === ids.existingVendor, "supplier was not linked to the reused vendor");
  assert(approvedState.rows[0]?.is_claimed === true && approvedState.rows[0]?.claim_status === "approved", "supplier ownership state is inconsistent");
  assert(approvedState.rows[0]?.invite_status === "claimed", "protected outreach state was not marked claimed");

  const membership = await db.query(`select role, status from public.vendor_users where vendor_id = '${ids.existingVendor}' and user_id = '${ids.claimant}'`);
  assert(membership.rows[0]?.role === "Owner" && membership.rows[0]?.status === "active", "active supplier membership was not created");
  const reusedVendorCount = await db.query("select count(*)::int as count from public.vendors where lower(btrim(contact_email)) = 'claimant@example.com'");
  assert(reusedVendorCount.rows[0]?.count === 1, "approval created a duplicate vendor for the same normalized email");

  const competingState = await db.query(`select status, reviewed_by, admin_notes from public.supplier_claims where id = '${ids.competingClaim}'`);
  assert(competingState.rows[0]?.status === "rejected" && competingState.rows[0]?.reviewed_by === ids.admin, "competing pending claim was left open");
  assert(competingState.rows[0]?.admin_notes?.startsWith("Automatically rejected") === true, "automatic competing-claim reason was not retained");
  const approvalAudits = await db.query(`select claim_id, action from public.supplier_claim_audit_log where supplier_id = '${ids.approveSupplier}' order by claim_id`);
  assert(approvalAudits.rows.length === 2, "approval did not create exactly one audit per resolved claim");
  assert(approvalAudits.rows.every((row) => [ids.approveClaim, ids.competingClaim].includes(row.claim_id)), "approval wrote an audit for an unrelated claim");

  await expectDenied(
    () => asUser(db, ids.admin, `select * from public.review_supplier_claim('${ids.approveClaim}', 'rejected', 'Changed mind')`),
    "an approved claim can be reversed",
  );
  await expectDenied(
    () => asUser(db, ids.admin, `select * from public.review_supplier_claim('${ids.competingClaim}', 'approved', null)`),
    "an automatically rejected competing claim can be reversed",
  );

  await expectDenied(
    () => asUser(db, ids.admin, `select * from public.review_supplier_claim('${ids.rejectClaim}', 'rejected', null)`),
    "a claim can be rejected without a reason",
  );
  const rejection = await asUser(
    db,
    ids.admin,
    `select * from public.review_supplier_claim('${ids.rejectClaim}', 'rejected', 'Evidence did not match')`,
  );
  assert(rejection.rows[0]?.review_status === "rejected", "rejection returned the wrong status");
  const rejectedState = await db.query(`
    select claims.status, suppliers.claim_status, suppliers.is_claimed, suppliers.vendor_id
    from public.supplier_claims as claims
    join public.supplier_listings as suppliers on suppliers.id = claims.supplier_id
    where claims.id = '${ids.rejectClaim}'
  `);
  assert(rejectedState.rows[0]?.status === "rejected", "target claim was not rejected");
  assert(rejectedState.rows[0]?.claim_status === "pending", "supplier lost its pending state while another claim remains");
  assert(rejectedState.rows[0]?.is_claimed === false && rejectedState.rows[0]?.vendor_id == null, "rejection created supplier ownership");
  const remainingState = await db.query(`select status from public.supplier_claims where id = '${ids.remainingClaim}'`);
  assert(remainingState.rows[0]?.status === "pending", "rejecting one claim changed another pending claim");
  const rejectionAudits = await db.query(`select count(*)::int as count from public.supplier_claim_audit_log where claim_id = '${ids.rejectClaim}' and action = 'rejected'`);
  assert(rejectionAudits.rows[0]?.count === 1, "rejection did not create exactly one audit event");

  await db.exec(`
    create function public.reject_forced_claim_audit() returns trigger language plpgsql as $$
    begin
      if new.notes = 'force rollback' then
        raise exception 'forced audit failure';
      end if;
      return new;
    end
    $$;
    create trigger reject_forced_claim_audit
      before insert on public.supplier_claim_audit_log
      for each row execute function public.reject_forced_claim_audit();
  `);
  await expectDenied(
    () => asUser(db, ids.admin, `select * from public.review_supplier_claim('${ids.rollbackClaim}', 'approved', 'force rollback')`),
    "an injected downstream failure did not abort claim review",
  );
  const rollbackState = await db.query(`
    select claims.status, suppliers.vendor_id, suppliers.is_claimed, suppliers.claim_status, contacts.invite_status
    from public.supplier_claims as claims
    join public.supplier_listings as suppliers on suppliers.id = claims.supplier_id
    join public.supplier_outreach_contacts as contacts on contacts.supplier_id = suppliers.id
    where claims.id = '${ids.rollbackClaim}'
  `);
  assert(rollbackState.rows[0]?.status === "pending", "failed approval changed the claim");
  assert(rollbackState.rows[0]?.vendor_id == null && rollbackState.rows[0]?.is_claimed === false && rollbackState.rows[0]?.claim_status === "pending", "failed approval changed supplier ownership");
  assert(rollbackState.rows[0]?.invite_status === "sent", "failed approval changed outreach state");
  const rolledBackVendor = await db.query("select id from public.vendors where contact_email = 'rollback@example.com'");
  assert(rolledBackVendor.rows.length === 0, "failed approval left an orphan vendor");
  const rolledBackAudit = await db.query(`select id from public.supplier_claim_audit_log where claim_id = '${ids.rollbackClaim}'`);
  assert(rolledBackAudit.rows.length === 0, "failed approval left an audit event");

  const contract = await db.query(`
    select
      p.prosecdef,
      p.proconfig,
      has_function_privilege('anon', p.oid, 'execute') as anon_execute,
      has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute,
      has_function_privilege('service_role', p.oid, 'execute') as service_execute
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'review_supplier_claim'
  `);
  assert(contract.rows.length === 1, "claim-review RPC is missing or overloaded unexpectedly");
  assert(contract.rows[0]?.prosecdef === false, "claim-review RPC is SECURITY DEFINER");
  assert(contract.rows[0]?.proconfig?.includes('search_path=""') === true, "claim-review RPC has a mutable search path");
  assert(contract.rows[0]?.anon_execute === false, "anonymous users can execute claim review");
  assert(contract.rows[0]?.authenticated_execute === true, "authenticated administrators cannot execute claim review");
  assert(contract.rows[0]?.service_execute === false, "service role can bypass the authenticated claim-review contract");

  const privateContracts = await db.query(`
    select
      p.proname,
      p.prosecdef,
      p.proconfig,
      has_function_privilege('anon', p.oid, 'execute') as anon_execute,
      has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in ('prepare_supplier_claim_submission', 'mark_supplier_claim_pending', 'review_supplier_claim_internal')
    order by p.proname
  `);
  assert(privateContracts.rows.length === 3, "private claim submission/review routines are missing");
  for (const row of privateContracts.rows) {
    assert(row.prosecdef === true, `${row.proname} is not SECURITY DEFINER`);
    assert(row.proconfig?.includes('search_path=""') === true, `${row.proname} has a mutable search path`);
    assert(row.anon_execute === false, `anonymous users can execute ${row.proname}`);
  }
  assert(
    privateContracts.rows.find((row) => row.proname === "prepare_supplier_claim_submission")?.authenticated_execute === false,
    "authenticated users can call the private submission trigger directly",
  );
  assert(
    privateContracts.rows.find((row) => row.proname === "mark_supplier_claim_pending")?.authenticated_execute === false,
    "authenticated users can call the private supplier-state trigger directly",
  );
  assert(
    privateContracts.rows.find((row) => row.proname === "review_supplier_claim_internal")?.authenticated_execute === true,
    "the public security-invoker wrapper cannot reach the private review routine",
  );

  const normalizedVendorIndex = await db.query(`
    select indexdef
    from pg_indexes
    where schemaname = 'public' and indexname = 'vendors_contact_email_normalized_idx'
  `);
  assert(normalizedVendorIndex.rows[0]?.indexdef?.includes("UNIQUE") === true, "normalized vendor email uniqueness is missing");

  console.log("Supplier claim review verification passed: profile-role escalation denial, locked claim submission, ignored-conflict safety, normalized vendor identity, admin-only atomic review, competing-claim closure, direct-update denial and full rollback on failure.");
} catch (error) {
  failure = error;
} finally {
  await db.close();
}

if (failure) {
  console.error(failure instanceof Error ? failure.message : String(failure));
  process.exitCode = 1;
}
