# My EverAft native shell

This is the local Expo N2 prototype. It uses seeded, device-only data and does
not connect to Supabase or any production service.

## Local development

From the repository root:

```powershell
npm.cmd install
npm.cmd run start --workspace=@everaft/mobile
```

Press `a` to open an installed Android emulator. On macOS, press `i` for the
iOS Simulator. Windows cannot run Apple's iOS Simulator; use a Mac for that
smoke test or an explicitly approved physical-device workflow later. Press `w`
for the local web rendering used for layout checks.

No Expo account, EAS subscription, Apple Developer account, Google Play account
or hosted build is required for N2. Do not create or purchase one for this
slice.

## Quality gates

```powershell
npm.cmd run lint:mobile
npm.cmd run typecheck:mobile
npm.cmd run test:mobile
```

The root `npm test` remains the aggregate web, package, mobile and database
verification gate. The root `npm run build` remains the unchanged Vercel web
build.
