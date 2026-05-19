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
RESEND_FROM_EMAIL="EverAft <notifications@yourdomain.com>"
ADMIN_NOTIFICATION_EMAIL=hello@yourdomain.com
REPLY_TO_EMAIL=hello@yourdomain.com
```

For Vercel, set `NEXT_PUBLIC_SITE_URL` to the deployed site URL, not localhost. For example:

```bash
NEXT_PUBLIC_SITE_URL=https://your-site.vercel.app
```

## Email Notifications

Titan can stay as your normal domain mailbox for reading and replying to email. The app uses Resend for automated transactional emails when these optional environment variables are configured:

- `RESEND_API_KEY`: Resend API key.
- `RESEND_FROM_EMAIL`: branded sender, for example `EverAft <notifications@yourdomain.com>`.
- `ADMIN_NOTIFICATION_EMAIL`: one or more admin inboxes, comma-separated.
- `REPLY_TO_EMAIL`: mailbox for replies, usually your Titan inbox.

If `RESEND_API_KEY` or `RESEND_FROM_EMAIL` is missing, form submissions still work and email sends are skipped. Configure the sending domain in Resend DNS before using a domain sender in production.

Automated emails currently cover:

- new venue enquiries to admin, claimed venue contact, and the couple
- new venue claims to admin
- claim approval/rejection to the claimant
- vendor listing update requests to admin

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
5. Confirm the `venue-images` Storage bucket exists and is public. The schema creates it automatically.

The schema creates:

- `public.profiles`
- `public.venues`
- `public.venue_images`
- `public.amenities`
- `public.venue_amenities`
- `public.favourites`
- `public.enquiries`
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

## Deployment

1. Push the repo to GitHub.
2. Import the project in Vercel.
3. Add the same environment variables from `.env.example`.
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
