# Planning Hub browser verification

Date: 29 July 2026

## Purpose

`npm run test:planning-browser` turns the release-candidate browser checks into
one repeatable local gate. It uses an installed Chrome or Edge executable
through the browser's DevTools protocol; it does not install a browser, contact
a hosted test service or write to production.

The command verifies five milestone surfaces at both release viewports:

- Venue discovery, including the responsive shell, server result area and
  manual-entry fallback;
- the plan-aware Photography handoff with exact transported context;
- Organise, including budget/bookings, payments, profile, tasks and guest/table
  readiness;
- the existing public Budget Planner;
- the existing public Table Planner.

That produces ten scenarios in total: each surface at 390 x 844, representing a
small iPhone viewport, and 1440 x 900, representing the desktop release
viewport.

For each viewport it proves:

- the stable milestone content for that surface renders, including the exact
  venue, wedding date, location and remaining-budget context in Photography;
- the viewport and document widths match, with no page-level horizontal
  overflow;
- no Next.js development overlay is present;
- no application error or browser exception is emitted;
- axe-core reports no violations and no indeterminate checks.

The cookie preference is set to essential inside the disposable browser profile
so the test scans the Planning Hub rather than a consent overlay. Cookie
consent behaviour retains its separate component tests.

## Safe local use

First create and serve an optimized local build:

```powershell
$env:EVERAFT_LOW_MEMORY_BUILD = "1"
npm.cmd run build
npm.cmd run start -- --hostname 127.0.0.1 --port 3001
```

In a second terminal:

```powershell
$env:PLANNING_HUB_BROWSER_BASE_URL = "http://127.0.0.1:3001"
npm.cmd run test:planning-browser
```

The verifier defaults to `http://127.0.0.1:3000`. It accepts only `localhost`,
`127.0.0.1` or `::1` and rejects credentials in the URL. It therefore cannot
be redirected to the live EverAft site.

Chrome and Edge are discovered in their standard Windows, macOS and Linux
locations. Set `PLANNING_HUB_BROWSER_EXECUTABLE` to an explicit local path when
the browser is installed elsewhere.

## Isolation and cleanup

Every run:

1. reserves a temporary local debugging port;
2. creates a fresh browser profile under the operating-system temporary
   directory;
3. launches the browser headlessly;
4. runs all ten responsive scenarios;
5. closes the owned browser process;
6. verifies the temporary path belongs to the run before recursively removing
   it.

No Supabase mutation, migration, branch, deployment, paid service or production
write is involved.
