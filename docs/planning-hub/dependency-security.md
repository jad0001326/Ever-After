# Planning Hub dependency security

Date: 28 July 2026

Status: production dependency audit clear; development-only upstream advisory
documented and accepted as a local release gate to monitor.

## Changes

| Package | Previous declaration | Verified resolution |
| --- | --- | --- |
| Next.js | `^16.2.6` | `16.2.12` |
| `@next/third-parties` | `^16.2.10` | `16.2.12` |
| Sharp | `^0.34.5` | `0.35.3` |
| PostCSS override | `8.5.10` | `8.5.24` |
| MCP SDK | `^1.29.0` | `1.30.0` |
| `eslint-config-next` | `latest` | `16.2.12` |
| Tailwind PostCSS adapter | `latest` | `4.3.3` |

The lockfile also resolves patched `fast-uri` 3.1.4 and
`@hono/node-server` 2.0.12. Exact versions are used for the framework,
image-processing and tooling packages so a later install cannot silently
change this verified baseline.

## Audit result

Before this slice, `npm audit --omit=dev` reported 6 production findings:
2 moderate and 4 high. The full audit reported 11 findings.

After the upgrade:

- `npm audit --omit=dev`: zero known vulnerabilities.
- Full `npm audit`: 9 high findings, all confined to the development-only
  ESLint/minimatch chain through `brace-expansion` 1.x.

The patched `brace-expansion` release is outside the dependency range and API
generation used by the current ESLint stack. `npm audit fix --force` proposes
downgrading `eslint-config-next` to 12.0.4, which is incompatible with the
Next.js 16 application and would weaken rather than improve the verified
toolchain. No forced audit fix was applied. This residual is not bundled into
or executed by the production application.

## Compatibility checks

Sharp 0.35 requires Node.js 20.9 or later; verification used Node.js 24.15.0.
The application uses supported Sharp APIs: bounded input decoding, automatic
rotation, flattening, resizing, JPEG conversion and buffer output. A direct
conversion smoke test produced a valid 40 x 30 JPEG through that pipeline.

This is a patch-level Next.js 16 upgrade. The application already uses the
Next.js 16 async request APIs and webpack scripts, so no framework codemod was
required.

## Verification

- 60 Vitest files and 275 tests passed.
- Embedded PostgreSQL RLS verification passed for 8 migrations and 10
  user-owned tables.
- TypeScript passed.
- ESLint passed with the existing unrelated Open Graph `<img>` warning.
- Optimized Next.js 16.2.12 build passed with 78 generated pages.
- Supplier roadmap and home navigation passed at 390 x 844 with no horizontal
  overflow or browser errors.
- Supplier roadmap axe scan found zero violations.
- No cloud resource, deployment, production write or paid service was used.
