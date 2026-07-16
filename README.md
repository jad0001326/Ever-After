# Ever After

Ever After is a production-minded MVP for premium Scottish wedding venue discovery. The current live foundation is focused on Supabase-backed venue search, venue detail pages, favourites, enquiries, and a protected admin CMS.

## Stack

- Next.js App Router, React, TypeScript
- Tailwind CSS
- Supabase Auth, PostgreSQL, Storage
- Vercel-ready project structure

## Features

- Premium mobile-first homepage with venue search
- Search results with URL-synced filters, sorting, and pagination
- SEO-friendly `/venues/[slug]` detail pages with JSON-LD
- Supabase sign up, sign in, favourites, and enquiry persistence
- Protected admin CMS for adding/editing venues, linking amenities, and uploading gallery images
- Public supplier application flow with admin review queue
- Public Scottish photographer directory with venue-first coverage search, style and budget filters
- Reusable supplier profiles, category-specific photographer data, approved imagery and venue-work connections
- Supplier listings available directly inside the wedding budget planner
- Double-opt-in newsletter architecture and cookie-preference control
- Approval-gated, branded business invitation campaigns with ChatGPT tools, unsubscribe handling and delivery tracking
- PostgreSQL schema for profiles, venues, images, amenities, favourites, and enquiries

## Local Setup

Install dependencies:

```bash
npm install
```

Create environment variables:

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=only-use-in-secure-server-jobs
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL="EverAft <invites@everaft.co.uk>"
RESEND_WEBHOOK_SECRET=whsec_your-resend-webhook-secret
ADMIN_NOTIFICATION_EMAIL=hello@yourdomain.com
REPLY_TO_EMAIL=hello@yourdomain.com
OUTREACH_SENDING_ENABLED=false
OUTREACH_APPROVAL_SECRET=generate-a-random-secret-of-at-least-32-characters
OUTREACH_MCP_AUDIENCE=https://www.everaft.co.uk/api/mcp
```

For Vercel, set `NEXT_PUBLIC_SITE_URL` to the deployed site URL, not localhost. For example:

```bash
NEXT_PUBLIC_SITE_URL=https://your-site.vercel.app
```

## Email Notifications

Titan can stay as your normal domain mailbox for reading and replying to email. The app uses Resend for automated transactional emails when these optional environment variables are configured:

- `RESEND_API_KEY`: Resend API key.
- `RESEND_FROM_EMAIL`: branded sender, for example `EverAft <invites@everaft.co.uk>`.
- `ADMIN_NOTIFICATION_EMAIL`: one or more admin inboxes, comma-separated.
- `REPLY_TO_EMAIL`: mailbox for replies, usually your Titan inbox.
- `RESEND_WEBHOOK_SECRET`: signing secret for delivery, bounce and complaint events.

If `RESEND_API_KEY` or `RESEND_FROM_EMAIL` is missing, form submissions still work and email sends are skipped. Configure the sending domain in Resend DNS before using a domain sender in production.

Automated emails currently cover:

- new venue enquiries to admin, claimed venue contact, and the couple
- new venue claims to admin
- claim approval/rejection to the claimant
- vendor listing update requests to admin
- approval-gated venue invitations with rich EverAft HTML, plain-text fallback, one-click unsubscribe and delivery tracking

Run locally:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Supabase Setup

1. Create a Supabase project.
2. In Supabase, open SQL Editor.
3. Run `supabase/schema.sql`.
4. Run `supabase/seed.sql` if you want starter amenities and sample venue rows.
5. Existing projects should also run `supabase/phase6_supplier_and_newsletter.sql` to add supplier applications and newsletter tables.
6. Existing projects should run `supabase/phase7_outreach_campaigns.sql` to add campaign, recipient, suppression, delivery-event and sourced-contact records, then `supabase/phase8_mcp_origin.sql` to align OAuth with the canonical `www` domain.
7. Confirm the `venue-images` Storage bucket exists and is public. The schema creates it automatically.
8. Apply the timestamped migrations in `supabase/migrations`, including `supplier_directory_foundation` and `tune_supplier_directory_policies`, to add the reusable supplier directory.

The schema creates:

- `public.profiles`
- `public.venues`
- `public.venue_images`
- `public.amenities`
- `public.venue_amenities`
- `public.favourites`
- `public.enquiries`
- `public.supplier_applications`
- `public.supplier_categories`
- `public.supplier_listings`
- `public.photographer_profiles`
- `public.supplier_images`
- `public.supplier_venue_connections`
- `public.supplier_favourites`
- `public.newsletter_subscribers`
- `public.outreach_campaigns`
- `public.outreach_campaign_recipients`
- `public.outreach_suppressions`
- `public.outreach_email_events`
- `venue-images` storage bucket

`auth.users` remains Supabase's auth table. The app profile data lives in `public.profiles`.

## First Admin

1. Start the app.
2. Create your first account through `/signup`.
3. If email confirmation is enabled, click the confirmation email link. It should redirect to `${NEXT_PUBLIC_SITE_URL}/login`.
4. In Supabase SQL Editor, promote that profile:

```sql
update public.profiles
set role = 'admin'
where email = 'you@example.com';
```

5. Sign out and sign back in if the admin area still redirects you.
6. Visit `/admin`.

Unauthenticated users are redirected to `/login`. Signed-in users whose `public.profiles.role` is not `admin` are blocked from admin pages and admin actions.

In Supabase Auth settings, set the production Site URL and redirect allow list:

- Site URL: `https://your-site.vercel.app`
- Additional Redirect URLs:
  - `https://your-site.vercel.app/**`
  - `http://localhost:3000/**`

## Adding Venues

1. Visit `/admin/venues/new`.
2. Fill in the listing fields.
3. Select amenities.
4. Save the venue.
5. The app redirects to the edit page with a success message.

Published venues appear on `/venues` and `/venues/[slug]`. Draft venues stay visible to admins through the admin dashboard but are hidden from public venue pages.

## Supplier applications and newsletters

`/for-business` is a public supplier application flow. It includes server-side input validation, an anti-spam honeypot, a best-effort rate guard and a secure Supabase service-role write. The service-role key must be present only in Vercel/server environment variables; it is never used in browser code.

New applications are visible in `/admin/applications` for an authenticated admin. Review and approval are intentionally separate from publishing a public profile so the team can verify the business first.

Approving a non-venue supplier application now creates a draft supplier profile. Admins can complete and publish it from `/admin/suppliers`. Photographers appear on `/photographers` only after the profile has a useful summary, full description and official website. Portfolio imagery is optional and can be added only after display rights are confirmed.

The photographer search can start from a selected EverAft venue. A photographer matches when the business covers the venue town or region, lists that service area, travels UK-wide, or has a verified connection showing that it has worked at the venue. Couples who have not booked a venue can continue to search by location, style and budget.

The homepage newsletter uses a double-opt-in flow. It stores only a hashed, one-time confirmation token and sends the confirmation email through Resend. Newsletter confirmation requires both the Supabase service-role key and the Resend variables listed above.

## Business invitation automation

The `/admin/outreach` workspace and `/api/mcp` ChatGPT connection use the same approval-gated campaign service. ChatGPT can:

1. Read published, unclaimed venues that are eligible for a first invitation or follow-up.
2. List venues that still need contact research, with each official website.
3. Add only a business email visibly published on that official website, together with the exact source page, to a read-only campaign preview.
4. Generate personalised EverAft copy and return the exact recipient list, sourced contacts, subject and sample before asking for approval.
5. On one explicit send approval, save those exact sourced contacts, freeze the audience, send the rich HTML campaign and record provider IDs.
6. Track accepted, delivered, failed, bounced, complained, replied, suppressed and unsubscribed states. Admins can record replies or manually suppress an address, and suppressions are re-checked immediately before every send.

The preview token is signed, tied to the connected admin, expires after 30 minutes and freezes the exact copy and recipients. A changed audience requires a new preview. Resend batches are capped at 100 recipients, and replaying the same approval is idempotent.

Production sending is deliberately off by default. Keep `OUTREACH_SENDING_ENABLED=false` until all of the following are complete:

- Verify `everaft.co.uk` as a sending domain in Resend and use a domain sender such as `EverAft <invites@everaft.co.uk>`.
- Point `REPLY_TO_EMAIL` at the monitored EverAft mailbox.
- Create a Resend webhook for `https://www.everaft.co.uk/api/resend/webhook`, subscribe to delivered, bounced, complained, failed and suppressed email events, and copy its signing secret into `RESEND_WEBHOOK_SECRET`.
- Generate `OUTREACH_APPROVAL_SECRET` with a password manager or `openssl rand -base64 48`; never commit its value.
- In a non-production deployment, add a dedicated test venue whose recipient address you control, temporarily enable sending there, then inspect the campaign on desktop and mobile mail clients, test its unsubscribe link and confirm webhook events appear in the campaign record. Keep the production switch off during this test.
- Review the audience as corporate subscribers. Do not use this flow for sole traders, some partnerships or personal subscribers unless the appropriate electronic-mail permission has been established.

Only after those checks should production set `OUTREACH_SENDING_ENABLED=true`.

### Connect EverAft to ChatGPT

The MCP endpoint uses Supabase OAuth and accepts only an authenticated EverAft profile whose role is still `admin`.

1. Deploy the site on the final HTTPS domain and set `NEXT_PUBLIC_SITE_URL=https://www.everaft.co.uk` and `OUTREACH_MCP_AUDIENCE=https://www.everaft.co.uk/api/mcp`.
2. In Supabase Authentication, enable the OAuth 2.1 server and dynamic client registration.
3. Set the OAuth authorization path to `/oauth/consent` and make sure the production site URL and redirect allow list are correct.
4. In Authentication Hooks, select `public.everaft_mcp_access_token_hook` as the Custom Access Token hook. The phase 7 migration creates this hook and binds OAuth access tokens to the production MCP audience.
5. Use an asymmetric Supabase JWT signing key and complete the Supabase OAuth token-security checklist before production use.
6. In ChatGPT on the web, enable developer mode, add an MCP connection for `https://www.everaft.co.uk/api/mcp`, and sign in with the EverAft admin account. Once linked, the connection is also available in ChatGPT mobile.

An example request after connection is: “Find all eligible Scottish venues, research only public business emails on their official sites, write a warm EverAft founding-partner invitation, and show me the exact recipients and email for approval.” ChatGPT will do the read-only preparation first; sending remains an external write action and requires confirmation for that exact preview.

## Adding Images

1. Open `/admin/venues/[id]/edit`.
2. Upload an image through the image uploader.
3. Add meaningful alt text.
4. The file is stored in the public `venue-images` Supabase Storage bucket.
5. A row is inserted into `public.venue_images`.

If uploads fail, check that `venue-images` exists, is public, and that the storage policies from `supabase/schema.sql` were run.

## Testing Supabase Connection

Use these checks before treating the app as live:

```bash
npm run typecheck
npm run build
```

Then verify manually:

- `/venues` shows Supabase data, not demo data.
- `/admin` requires a signed-in admin user.
- `/admin/venues/new` creates a row in `public.venues`.
- The edit page can upload an image and insert `public.venue_images`.
- Selected amenities create rows in `public.venue_amenities`.
- `/signup` creates both an `auth.users` row and a `public.profiles` row.

If Supabase environment variables are missing, public venue pages show an explicit connection message instead of silently falling back to fake data.

## Venue Research Tool

Use `scripts/research_venues.py` to collect starter venue research into a reviewable CSV before entering listings into admin. The output is for research only; every row should be checked manually before publishing.

Google Places discovery requires a Google Places API key:

```bash
set GOOGLE_PLACES_API_KEY=your-google-places-api-key
python scripts/research_venues.py --query "wedding venues Scotland" --limit 20 --output outputs/venue_research/scotland_venues.csv
```

Known website crawl mode does not need an API key:

```bash
python scripts/research_venues.py --url https://example-venue.com --output outputs/venue_research/known_venues.csv
```

You can also provide a text file with one website per line:

```bash
python scripts/research_venues.py --urls-file inputs/venue_urls.txt --output outputs/venue_research/known_venues.csv
```

The CSV includes starter fields such as venue name, website, phone, public email, contact page, town, region, address, Google Maps URL, source URL, confidence, and notes. It deliberately does not auto-copy venue descriptions or images.

## Outreach enrichment audit

Run the catalogue-wide audit in dry-run mode before proposing any database change:

```powershell
npm.cmd run enrichment:audit
```

Add `--research` to crawl only official business websites, respect `robots.txt`, collect exact source pages, and run syntax plus DNS/MX checks on public email addresses:

```powershell
npm.cmd run enrichment:audit -- --research --concurrency=4 --max-pages=5
```

The command is deliberately read-only. It writes review artifacts under `outputs/enrichment-audit/`, never sends email, and rejects an `--apply` flag. Research is resumable through its checkpoint file and uses bounded concurrency, per-host delays, timeouts, and retries.

Without `SUPABASE_SERVICE_ROLE_KEY`, the public venue catalogue is still audited, but protected supplier applications, suppressions, unsubscribe/bounce state, and campaign history are reported as unavailable. Those checks must be available before any record is treated as safe to send. Apply `supabase/phase10_enrichment_workflow.sql` only after reviewing the first dry-run report; it creates the private evidence, proposal, duplicate, verification, change-log, and rollback workflow used by `/admin/enrichment`.

After the dry run has been reviewed and phase 10 has been applied, stage its evidence in the private admin queue without changing any business record:

```powershell
npm.cmd run enrichment:stage -- --from=outputs/enrichment-audit/<run>/audit.json --confirm-stage-review
```

Staging is fingerprinted and idempotent. Replaying the same report returns the existing run. Business-field changes still require an authenticated admin to approve and apply individual proposals in `/admin/enrichment`; rollback is available only when the live value still matches the value applied by that proposal.

The audit keeps two concepts separate:

- Current outreach eligibility mirrors the sender: published, unclaimed Scottish venue; correct invite state; valid public business email; exact official-site source; no duplicate email; no suppression; campaign limit respected.
- Broader data quality includes pricing, coordinates, amenities, representative imagery, freshness, business activity, and possible duplicate businesses. Missing price or representative imagery does not by itself block outreach.

## Deployment

1. Push the repo to GitHub.
2. Import the project in Vercel.
3. Add the same environment variables from `.env.example`, including `SUPABASE_SERVICE_ROLE_KEY` for the supplier-application and newsletter server actions.
4. Set `NEXT_PUBLIC_SITE_URL` to your production domain.
5. Deploy.

Vercel will run:

```bash
npm run build
```

## Architecture

```text
src/app                 App Router pages, metadata, server actions
src/components          Reusable UI, search, venue, auth, admin components
src/data                Form option constants and isolated development/demo references
src/lib                 Formatting, auth guards, compatibility Supabase exports, venue queries
src/utils/supabase      Canonical Supabase browser/server/middleware helpers
src/types               Domain and generated-style database types
supabase                SQL schema and seed data
```

## Out Of Scope For Now

Payments, supplier features, and wedding planner workflows are intentionally not part of this foundation pass.
