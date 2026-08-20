import { mkdtemp, readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { platform, tmpdir } from "node:os";
import { join } from "node:path";

const ids = {
  admin: "14000000-0000-4000-8000-000000000004",
  claimant: "11000000-0000-4000-8000-000000000001",
  competitor: "12000000-0000-4000-8000-000000000002",
  supplier: "31000000-0000-4000-8000-000000000001",
  firstClaim: "41000000-0000-4000-8000-000000000001",
  secondClaim: "42000000-0000-4000-8000-000000000002",
  lateSupplier: "32000000-0000-4000-8000-000000000002",
  reviewClaim: "43000000-0000-4000-8000-000000000003",
  lateClaim: "44000000-0000-4000-8000-000000000004",
};

// embedded-postgres installs a global beforeExit hook intended to stop any
// still-running cluster. This verifier owns shutdown explicitly; remove that
// hook after importing the package so Node can terminate normally on Windows.
for (const eventName of ["exit", "beforeExit", "SIGHUP", "SIGINT", "SIGTERM", "SIGBREAK", "message"]) {
  for (const listener of process.listeners(eventName)) {
    if (String(listener).includes("eventFilters") && String(listener).includes("exit(code")) {
      process.removeListener(eventName, listener);
    }
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(`Supplier claim concurrency contract failed: ${message}`);
}

async function findFreePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (!port) throw new Error("Could not reserve a local PostgreSQL test port");
  return port;
}

async function review(client, claimId) {
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [ids.admin]);
    const result = await client.query(
      "select * from public.review_supplier_claim($1, 'approved', 'Native concurrency verification')",
      [claimId],
    );
    await client.query("commit");
    return { status: "fulfilled", row: result.rows[0] };
  } catch (error) {
    await client.query("rollback");
    return { status: "rejected", error };
  }
}

async function submit(client, claimId, supplierId, claimantId) {
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [claimantId]);
    await client.query(`
      insert into public.supplier_claims (
        id, supplier_id, claimant_user_id, claimant_name, claimant_email, claimant_role,
        business_email, business_phone, message, permission_confirmed, terms_accepted
      ) values ($1, $2, $3, 'Late claimant', 'untrusted@example.com', 'Owner',
        'late@example.com', '0131 555 0003', 'Concurrent late claim', true, true)
    `, [claimId, supplierId, claimantId]);
    await client.query("commit");
    return { status: "fulfilled" };
  } catch (error) {
    await client.query("rollback");
    return { status: "rejected", error };
  }
}

async function stopPostgres() {
  const serverProcess = postgres.process;
  if (!serverProcess?.pid) return;
  const binaryPackage = platform() === "win32"
    ? "@embedded-postgres/windows-x64"
    : platform() === "darwin"
      ? (process.arch === "arm64" ? "@embedded-postgres/darwin-arm64" : "@embedded-postgres/darwin-x64")
      : (process.arch === "arm64" ? "@embedded-postgres/linux-arm64" : "@embedded-postgres/linux-x64");
  const { pg_ctl: pgCtl } = await import(binaryPackage);
  await new Promise((resolve, reject) => {
    const stopper = spawn(pgCtl, ["stop", "-D", databaseDir, "-m", "fast", "-w"], {
      stdio: "ignore",
      windowsHide: true,
    });
    stopper.once("error", reject);
    stopper.once("close", (code) => code === 0 ? resolve() : reject(new Error(`pg_ctl stop exited with ${code}`)));
  });
  postgres.process = undefined;
}

const databaseDir = await mkdtemp(join(tmpdir(), "everaft-claim-concurrency-"));
const externalDatabaseUrl = process.env.SUPPLIER_CLAIM_TEST_DATABASE_URL;
let postgres;
let getClient;

if (externalDatabaseUrl) {
  const { default: pg } = await import("pg");
  getClient = () => new pg.Client({ connectionString: externalDatabaseUrl });
} else {
  const { default: EmbeddedPostgres } = await import("embedded-postgres").catch(() => {
    throw new Error(
      "Install embedded-postgres@18.4.0-beta.17 temporarily, or set SUPPLIER_CLAIM_TEST_DATABASE_URL to the isolated everaft_claim_test database.",
    );
  });
  const port = await findFreePort();
  postgres = new EmbeddedPostgres({
    databaseDir,
    port,
    user: "postgres",
    password: "postgres",
    persistent: false,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "deadlock_timeout=100ms", "-c", "lock_timeout=5s"],
    onLog: () => {},
  });
}

let admin;
let firstReviewer;
let secondReviewer;
let failure;

try {
  if (postgres) {
    await postgres.initialise();
    await postgres.start();
    await postgres.createDatabase("everaft_claim_test");
    getClient = () => postgres.getPgClient("everaft_claim_test");
  }
  admin = getClient();
  firstReviewer = getClient();
  secondReviewer = getClient();
  await Promise.all([admin.connect(), firstReviewer.connect(), secondReviewer.connect()]);
  const databaseIdentity = await admin.query("select current_database() database_name");
  assert(databaseIdentity.rows[0]?.database_name === "everaft_claim_test",
    "refusing to run destructive fixtures outside the isolated everaft_claim_test database");

  await admin.query(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create schema auth;
    create schema private authorization postgres;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table public.profiles (
      id uuid primary key, email text, full_name text, role text not null default 'couple',
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    create table public.vendors (
      id uuid primary key default gen_random_uuid(), name text not null, contact_email text unique,
      contact_phone text, status text not null default 'active', created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table public.vendor_users (
      vendor_id uuid not null references public.vendors(id), user_id uuid not null references public.profiles(id),
      role text not null default 'owner', status text not null default 'active',
      created_at timestamptz not null default now(), primary key (vendor_id, user_id)
    );
    create table public.supplier_categories (slug text primary key, is_live boolean not null default false);
    create table public.supplier_listings (
      id uuid primary key default gen_random_uuid(), vendor_id uuid references public.vendors(id),
      category_slug text not null references public.supplier_categories(slug), slug text not null unique,
      name text not null, listing_status text not null default 'draft', claim_status text not null default 'unclaimed',
      is_claimed boolean not null default false, reviewed_at timestamptz,
      reviewed_by uuid references public.profiles(id), created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table public.supplier_outreach_contacts (
      supplier_id uuid primary key references public.supplier_listings(id),
      invite_status text not null default 'not_sent', updated_at timestamptz not null default now()
    );
    create table public.supplier_claims (
      id uuid primary key default gen_random_uuid(), supplier_id uuid not null references public.supplier_listings(id),
      claimant_user_id uuid not null references public.profiles(id), claimant_name text not null,
      claimant_email text not null, claimant_role text not null, business_email text not null,
      business_phone text not null, message text not null, evidence_url text, status text not null default 'pending',
      permission_confirmed boolean not null default false, terms_accepted boolean not null default false,
      admin_notes text, reviewed_at timestamptz, reviewed_by uuid references public.profiles(id),
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    create unique index supplier_claims_open_claim_idx on public.supplier_claims (supplier_id, claimant_user_id)
      where status in ('pending', 'approved');
    create table public.supplier_claim_audit_log (
      id uuid primary key default gen_random_uuid(), claim_id uuid not null references public.supplier_claims(id),
      supplier_id uuid not null references public.supplier_listings(id), admin_user_id uuid references public.profiles(id),
      action text not null, notes text, created_at timestamptz not null default now()
    );
    create function private.is_admin() returns boolean language sql stable security definer set search_path = pg_catalog as $$
      select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    $$;
    grant usage on schema public, auth, private to anon, authenticated, service_role;
    grant execute on function auth.uid(), private.is_admin() to anon, authenticated, service_role;
    grant select, update on public.profiles to authenticated;
    grant select on public.supplier_categories to anon, authenticated;
    grant select, update on public.supplier_listings to authenticated;
    grant select, insert, update, delete on public.vendors, public.vendor_users to authenticated;
    grant select, insert on public.supplier_claims to authenticated;
    grant select, insert, update, delete on public.supplier_claims, public.supplier_claim_audit_log,
      public.supplier_outreach_contacts to service_role;
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
    create policy "Admins can read profiles" on public.profiles for select to authenticated using (private.is_admin());
    create policy "Admins manage vendors" on public.vendors for all to authenticated
      using (private.is_admin()) with check (private.is_admin());
    create policy "Admins manage vendor users" on public.vendor_users for all to authenticated
      using (private.is_admin()) with check (private.is_admin());
    create policy "Vendor users read own links" on public.vendor_users for select to authenticated using (user_id = auth.uid());
    create policy "Published supplier listings are public" on public.supplier_listings for select
      using (listing_status = 'published' or private.is_admin());
    create policy "Admins update supplier listings" on public.supplier_listings for update to authenticated
      using (private.is_admin()) with check (private.is_admin());
    create policy "Users read own supplier claims" on public.supplier_claims for select to authenticated
      using (auth.uid() = claimant_user_id or private.is_admin());
    create policy "Users submit own supplier claims" on public.supplier_claims for insert to authenticated
      with check (auth.uid() = claimant_user_id and status = 'pending' and permission_confirmed and terms_accepted);
  `);

  const profileMigration = await readFile(
    new URL("../supabase/migrations/20260813074826_lock_down_profile_role_updates.sql", import.meta.url), "utf8",
  );
  const claimMigration = await readFile(
    new URL("../supabase/migrations/20260820125218_atomic_supplier_claim_review.sql", import.meta.url), "utf8",
  );
  await admin.query(profileMigration);
  await admin.query(claimMigration);
  await admin.query(`
    insert into public.profiles (id, email, full_name, role) values
      ('${ids.admin}', 'admin@example.com', 'Admin', 'admin'),
      ('${ids.claimant}', 'claimant@example.com', 'Claimant', 'couple'),
      ('${ids.competitor}', 'competitor@example.com', 'Competitor', 'couple');
    insert into public.supplier_categories (slug, is_live) values ('photographer', true);
    insert into public.supplier_listings (id, category_slug, slug, name, listing_status, claim_status)
      values
        ('${ids.supplier}', 'photographer', 'concurrent-photography', 'Concurrent Photography', 'published', 'pending'),
        ('${ids.lateSupplier}', 'photographer', 'late-photography', 'Late Photography', 'published', 'pending');
    set session_replication_role = replica;
    insert into public.supplier_claims (
      id, supplier_id, claimant_user_id, claimant_name, claimant_email, claimant_role, business_email,
      business_phone, message, status, permission_confirmed, terms_accepted
    ) values
      ('${ids.firstClaim}', '${ids.supplier}', '${ids.claimant}', 'First', 'first@example.com', 'Owner',
       'first@example.com', '0131 555 0001', 'First claim', 'pending', true, true),
      ('${ids.secondClaim}', '${ids.supplier}', '${ids.competitor}', 'Second', 'second@example.com', 'Owner',
       'second@example.com', '0131 555 0002', 'Second claim', 'pending', true, true),
      ('${ids.reviewClaim}', '${ids.lateSupplier}', '${ids.claimant}', 'Existing', 'existing@example.com', 'Owner',
       'existing@example.com', '0131 555 0004', 'Existing claim', 'pending', true, true);
    set session_replication_role = origin;
    insert into public.supplier_outreach_contacts (supplier_id, invite_status) values
      ('${ids.supplier}', 'sent'), ('${ids.lateSupplier}', 'sent');
  `);

  const startedAt = Date.now();
  const results = await Promise.all([
    review(firstReviewer, ids.firstClaim),
    review(secondReviewer, ids.secondClaim),
  ]);
  assert(Date.now() - startedAt < 5000, "competing reviews timed out instead of serializing");
  assert(results.filter((result) => result.status === "fulfilled").length === 1,
    "competing approvals did not produce exactly one successful decision");
  assert(results.filter((result) => result.status === "rejected").length === 1,
    "the losing competing approval did not fail closed");

  const state = await admin.query(`
    select
      (select count(*)::int from public.supplier_claims where supplier_id = $1 and status = 'approved') approved_claims,
      (select count(*)::int from public.supplier_claims where supplier_id = $1 and status = 'rejected') rejected_claims,
      (select count(*)::int from public.vendor_users vu join public.vendors v on v.id = vu.vendor_id
        join public.supplier_listings s on s.vendor_id = v.id where s.id = $1) memberships,
      (select count(*)::int from public.supplier_claim_audit_log where supplier_id = $1) audit_events,
      (select invite_status from public.supplier_outreach_contacts where supplier_id = $1) invite_status,
      (select is_claimed from public.supplier_listings where id = $1) is_claimed,
      (select claim_status from public.supplier_listings where id = $1) claim_status
  `, [ids.supplier]);
  const finalState = state.rows[0];
  assert(finalState.approved_claims === 1 && finalState.rejected_claims === 1,
    "claim decisions are inconsistent after concurrent approval");
  assert(finalState.memberships === 1, "concurrent approval created an inconsistent vendor membership");
  assert(finalState.audit_events === 2, "concurrent approval did not create one audit event per claim");
  assert(finalState.invite_status === "claimed", "concurrent approval did not close the outreach lifecycle");
  assert(finalState.is_claimed === true && finalState.claim_status === "approved",
    "supplier ownership state is inconsistent after concurrent approval");

  const lateResults = await Promise.all([
    review(firstReviewer, ids.reviewClaim),
    submit(secondReviewer, ids.lateClaim, ids.lateSupplier, ids.competitor),
  ]);
  assert(lateResults[0].status === "fulfilled", "the existing valid claim was not approved");
  const lateStateResult = await admin.query(`
    select
      count(*)::int total_claims,
      count(*) filter (where status = 'approved')::int approved_claims,
      count(*) filter (where status = 'rejected')::int rejected_claims,
      count(*) filter (where status = 'pending')::int pending_claims,
      (select count(*)::int from public.supplier_claim_audit_log where supplier_id = $1) audit_events,
      (select count(*)::int from public.vendor_users vu join public.vendors v on v.id = vu.vendor_id
        join public.supplier_listings s on s.vendor_id = v.id where s.id = $1) memberships,
      (select claim_status from public.supplier_listings where id = $1) claim_status,
      (select invite_status from public.supplier_outreach_contacts where supplier_id = $1) invite_status
    from public.supplier_claims where supplier_id = $1
  `, [ids.lateSupplier]);
  const lateState = lateStateResult.rows[0];
  assert(lateState.approved_claims === 1 && lateState.pending_claims === 0,
    "a submission racing approval left an ambiguous or pending claim");
  assert(lateState.total_claims === 1 || (lateState.total_claims === 2 && lateState.rejected_claims === 1),
    "a submission racing approval left inconsistent claim rows");
  assert(lateState.audit_events === lateState.total_claims,
    "a submission racing approval left a claim without an audit outcome");
  assert(lateState.memberships === 1 && lateState.claim_status === "approved" && lateState.invite_status === "claimed",
    "a submission racing approval left inconsistent supplier, membership or outreach state");

  console.log("Supplier claim native concurrency verification passed: independent PostgreSQL sessions serialized competing approvals and a late submission race without deadlock, pending claims or inconsistent supplier, membership, outreach and audit state.");
} catch (error) {
  failure = error;
} finally {
  await Promise.allSettled([admin?.end(), firstReviewer?.end(), secondReviewer?.end()]);
  if (postgres) {
    await stopPostgres().catch((error) => { failure ??= error; });
    await rm(databaseDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 })
      .catch((error) => { failure ??= error; });
  } else {
    await rm(databaseDir, { recursive: true, force: true });
  }
}

if (failure) throw failure;
