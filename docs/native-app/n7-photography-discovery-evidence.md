# N7 Photography discovery evidence

Date: 28 August 2026

Status: implemented and verified locally on `codex/native-app-n7-photography-discovery`.
This is an uncommitted, stacked N7 checkpoint. It has not been pushed, deployed,
connected to production or used to change supplier data, flags or outreach.

## Connected vertical slice

- Adds strict versioned collection/detail contracts and bounded public API routes
  for the live `photographer` category only.
- Reuses `supplier_listings`, `photographer_profiles`, approved
  `supplier_images` and the existing caller-owned `supplier_favourites` API/RLS.
- Returns at most eight lightweight results, deterministic ID tie-breakers and
  on-demand detail/gallery data.
- Rejects dormant categories at collection and detail boundaries.
- Returns `matched`, `not_provided` or `stale` venue context. A withdrawn venue
  produces no supplier results instead of silently broadening the search.
- Carries `approved`, `representative` or `absent` visual status and always marks
  wedding-date availability as `not_checked`.
- Routes the native Today recommendation from a selected venue into Photography.
- Adds native search, detail, bookmark sync, device-persisted three-way compare,
  connected plan selection and manual photographer fallback.
- Migrates device-plan format v2 to v3 without losing venue discovery state.

No database migration is required for this slice.

## Verification

- Full web unit suite: 131 files, 590 tests passed on the final source.
- Package suites: 5 files, 19 tests passed.
- Native suite: 30 suites, 115 tests passed.
- The final explicit absent-image placeholder change passed its focused native
  test, the full mobile TypeScript check and mobile lint.
- Supplier detail failures are separated from confirmed absence: database and
  profile-query failures return generic catalogue unavailability without
  leaking database details, while a confirmed missing published supplier
  remains a not-found response.
- Search input rejects impossible ISO-shaped wedding dates before any catalogue
  query, preventing malformed client input from becoming a server error.
- Full root and package/mobile TypeScript checks passed.
- Full lint passed with zero errors. The only warning is the pre-existing
  `<img>` warning in `src/app/venues/[slug]/opengraph-image.tsx`.
- Planning Workspace RLS, supplier-owner RLS, supplier-claim review, Data API
  grants, supplier outreach migration and production migration-alignment gates
  passed.
- All 19 generated Planning Workspace contracts remain current.
- Next.js production build passed and generated 92 pages; both new supplier API
  routes were included as dynamic routes.
- `git diff --check` passes after normal line-ending notices.

### Android emulator smoke

- The free local Android 16 `everaft_n3_android` emulator ran at 1080x1920.
- From the temporary short worktree `C:\e7`, the x86_64 debug build completed
  all 338 Gradle tasks in 7m 5s, installed `uk.co.everaft.mobile` and bundled
  1,835 modules without a fatal Android or React Native exception.
- The device-only Today screen and the Photography discovery screen rendered.
- A local fixture reached the native collection and detail screens through an
  `adb reverse` localhost-only connection. The collection visibly rendered the
  explicit `Photography coming soon` placeholder for absent approved imagery;
  the detail screen disclosed `Photography is not yet available`, location,
  style, unchecked availability and estimate/quote/booking choices.
- This proves local Android build, navigation, bounded fixture parsing and the
  principal visual states. It does not prove real account authentication,
  bookmark RLS or production/non-production Data API connectivity.

## Still required before release

- Commit and review this N7 checkpoint locally.
- Push N6 and N7 as deliberately stacked draft PRs only after approval.
- Run a real non-production Android Auth/Data API journey after the N6 connected
  environment is approved, including supplier search, bookmark isolation,
  comparison restore and connected budget rehydrate.
- Run TalkBack on Android and the real connected owner/partner journey. iOS
  still requires Mac/Xcode/device access.
- Production deployment remains a separate decision after N6 migration/API
  review and N7 review. Enabling another supplier category is explicitly out of
  scope.
