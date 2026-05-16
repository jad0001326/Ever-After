# Ever After

Ever After is a production-minded MVP for premium Scottish wedding venue discovery. The current scope is focused on venue search, detail pages, favourites, enquiries, and a protected admin CMS foundation.

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
- Protected admin CMS for adding/editing venues and uploading gallery images
- PostgreSQL schema for users, venues, images, amenities, favourites, and enquiries
- Scottish placeholder venue data for castles, barns, luxury hotels, and country estates

## Getting Started

Install dependencies:

```bash
npm install
```

Create environment variables:

```bash
cp .env.example .env.local
```

Fill in:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=only-use-in-secure-server-jobs
```

Run locally:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Optionally run `supabase/seed.sql` for starter records.
4. Create your first account through `/signup`.
5. Promote yourself to admin:

```sql
update public.users
set role = 'admin'
where email = 'you@example.com';
```

The schema creates:

- `public.users`
- `public.venues`
- `public.venue_images`
- `public.amenities`
- `public.venue_amenities`
- `public.favourites`
- `public.enquiries`
- `venue-images` storage bucket

## Vercel Deployment

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
src/data                Demo Scottish venue data used before Supabase is connected
src/lib                 Search, formatting, auth guards, Supabase clients
src/types               Domain and generated-style database types
supabase                SQL schema and seed data
```

## Scalability Notes

- Replace demo data search with Postgres queries once the venue catalogue grows beyond a few dozen records.
- Add PostGIS for radius search and map clustering.
- Move admin image management into a richer gallery table editor with ordering and deletion.
- Add saved searches, availability calendars, venue owner accounts, and quote packages as the planning ecosystem expands.
- Generate Supabase TypeScript types in CI once the database is live.
