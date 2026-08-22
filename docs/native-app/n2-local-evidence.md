# N2 local evidence

Date: 22 August 2026

Status: complete locally on `codex/native-app-n2`. Nothing in this worktree has
been pushed, deployed or connected to a hosted service.

## Delivered

- Expo SDK 57 TypeScript workspace at `apps/mobile` with pinned native runtime
  versions and one repository React installation.
- Expo Router shell with authentication and onboarding route groups plus the
  four labelled tabs: Today, Discover, Plan and You.
- Semantic EverAft native light/dark colour, spacing, radius and type tokens.
- Seeded, device-only Today screen whose recommendation and budget values are
  derived through `@everaft/planning-domain`.
- Separate Expo lint, TypeScript and Jest environments; the web Vitest runner
  excludes mobile tests and the root test command aggregates every suite.
- Local development instructions that require no Expo, Apple or Google paid
  service.
- Saved Today-screen visual reference at
  `docs/native-app/assets/n2-today-screen-concept.png`.

## Verification

- `npm ci`: passed.
- `npm run lint`: passed with the existing web Open Graph `<img>` warning only.
- `npm run typecheck`: passed across web, packages and mobile.
- `npm test`: passed — 523 web tests, two shared-package tests, five native
  tests and every existing database/RLS/migration verifier.
- `npm run build`: passed; the root Next/Vercel build remains unchanged.
- Expo dependency check: passed.
- Expo Doctor: 21/21 checks passed.
- Dependency audit: no critical or high findings after safe transitive pins;
  ten moderate Expo build-tool advisories remain without a safe same-SDK audit
  fix.
- Compact rendering at 390 x 844: Today loaded at `/today`, rendered meaningful
  content with no framework overlay or console issues, exposed the four tabs by
  accessible names, navigated Today → Explore venues → Discover → Today, and
  preserved the expected screen state.
- The light and dark token pairs passed programmatic WCAG AA contrast checks.
  A dark-system rendered pass confirmed the semantic palette and primary action
  changed together without losing the information hierarchy.

The in-app Browser could not reach the Windows local listener despite a host
HTTP 200 response, so the rendered check used a temporary local Playwright
Chromium runtime. Screenshots were kept outside the repository under the system
temporary directory.

## Platform smoke-test limit

This Windows host has neither Android `adb` nor an Android emulator configured,
and Windows cannot run Apple's iOS Simulator. The Android preflight found 7.7
GB RAM, firmware virtualization disabled and 37.5 GB free disk. Google's
current local Studio + Emulator minimum is 16 GB RAM with virtualization
enabled, so installing the emulator here now would not be a credible smoke-test
environment. Use a suitable physical Android device or a machine that meets the
local emulator requirements later. No hosted build or developer account was
created.
