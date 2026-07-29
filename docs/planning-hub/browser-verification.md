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

The gate then runs one stateful 390 x 844 journey:

1. tries to favourite the first live result and proves a signed-out browser is
   asked to sign in without presenting the venue as saved;
2. adds that result to comparison, opens its on-demand detail and closes it;
3. sets a £30,000 budget, 12 June 2027 date, 80 guests and Fife location;
4. adds a £5,000 booked manual venue and chooses it as the main venue;
5. adds a £1,000 booking deposit due 1 June 2027, records £500 paid and proves
   the plan-wide deadline and paid totals update;
6. proves the remaining budget changes immediately to £25,000;
7. follows the Photography recommendation and proves its URL and rendered
   context contain the exact venue, date, location and remaining pence;
8. proves a manual venue is not mistaken for a catalogue venue filter;
9. returns to the Venue step and proves the chosen venue, budget and partial
   payment restore from the disposable browser's local plan.

It then retains that restored plan for a real keyboard-input journey:

1. focuses the first venue's `View` button and uses Enter to open details;
2. proves focus moves into the on-demand detail panel;
3. uses Tab to reach Close and Enter to close it;
4. proves focus returns to the exact opening `View` button;
5. focuses Compare and uses Space to toggle its pressed state;
6. focuses `Venue not listed?`, uses Enter to expand it and Tab to reach the
   first manual-entry field;
7. focuses the next-stage recommendation and uses Enter to reach Photography
   with the exact restored plan context.

These actions use Chrome's native keyboard input events. Programmatic focus is
used only to establish the starting control for each independent assertion;
activation, sequential focus movement and navigation are performed by the
browser.

Finally, the gate reads Chrome's full accessibility tree rather than inferring
screen-reader behavior from DOM attributes. It proves:

- exactly one banner and one main landmark on Venue and Photography;
- named primary/stage/result navigation plus named filter, result and
  connected-plan landmarks;
- the expected H1, H2 and selected-venue H3 levels;
- chosen, Compare and manual-disclosure pressed/expanded state;
- the on-demand detail region and Close control names;
- the remaining budget and transported venue/date/budget as accessible text;
- meaningful result control, return-link and next-stage link names;
- the same exact Photography query context without a false manual catalogue
  venue ID.

The final stateful check opens Organise with that same device plan, verifies the
booking and payment commitment, and follows `Review payment plan`. The link
must retain the exact plan-item ID, return to the Venue stage, open that item's
payment disclosure and focus its summary. This covers both direct-load and
client-navigation hash timing.

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

The interaction journey requires the local server to have the normal public
Supabase URL and anonymous key so it can read a live venue result. It fails
closed with the rendered catalogue error when those local environment values
are absent. The journey remains signed out and performs no Supabase mutation.

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

During development, rerun only the interaction journey after a failure:

```powershell
$env:PLANNING_HUB_BROWSER_JOURNEY_ONLY = "1"
npm.cmd run test:planning-browser
```

The release gate must still run without `PLANNING_HUB_BROWSER_JOURNEY_ONLY` so
all responsive surfaces are included.

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
4. runs all ten responsive scenarios plus the mobile state and keyboard
   journeys;
5. closes the owned browser process;
6. verifies the temporary path belongs to the run before recursively removing
   it.

No Supabase mutation, migration, branch, deployment, paid service or production
write is involved.
