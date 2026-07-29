# Planning Hub performance verification

Date: 29 July 2026

## Scope

This record recertifies the venue-first entry route after the complete local
Planning Hub milestone was assembled. It measures the optimized
`/planning-hub` build with eight real, lightweight venue results and the normal
public Supabase URL and anonymous key. It does not load a service-role key,
authenticate a user, mutate Supabase, deploy or use a hosted test service.

Targets from the product objective:

| Metric | Target |
| --- | ---: |
| Mobile Lighthouse performance | at least 90 |
| LCP | below 2,500ms |
| INP | below 200ms in the field |
| CLS | below 0.1 |

## Method

- Next.js 16.2.12 optimized build served by `next start` on loopback;
- Lighthouse 13.4.1 and installed Chrome, mobile form factor;
- simulated mobile throttling and a fresh Lighthouse profile per run;
- three cold samples against `http://127.0.0.1:3002/planning-hub`;
- Performance, Accessibility and Best Practices categories;
- report `runtimeError` checked before accepting each sample.

Lighthouse generated complete valid JSON reports, but its Windows cleanup
attempt exited with `EPERM` after each report because Chrome briefly retained
the disposable profile. The application audit itself had no runtime error. The
metrics below come from the generated reports, not the cleanup exit code.

## Results

| Run | Performance | Accessibility | Best practices | FCP | LCP | TBT | CLS | Speed Index | TTI |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 99 | 100 | 100 | 926ms | 2,227ms | 31ms | 0 | 1,156ms | 2,618ms |
| 2 | 98 | 100 | 100 | 909ms | 2,395ms | 34ms | 0 | 1,155ms | 2,608ms |
| 3 | 99 | 100 | 100 | 918ms | 2,237ms | 47ms | 0 | 949ms | 2,642ms |
| **Median** | **99** | **100** | **100** | **918ms** | **2,237ms** | **34ms** | **0** | **1,155ms** | **2,618ms** |

The median transfer was 295,358 bytes, approximately 288KiB.

## Trace interpretation

- The LCP element is the server-rendered hero heading, “Turn venue browsing
  into your wedding plan.” It is not delayed by a catalogue image or a
  client-only loading state.
- In the median trace, the LCP breakdown recorded about 16ms time to first byte
  and 89ms element render delay before simulated throttling.
- The route-specific Planning Hub page chunk transfers about 8.5KiB.
- Main-thread work is about 0.8 seconds in total, while the blocking portion
  remains only 34ms at the median.
- The shared 15KiB stylesheet is the only render-blocking opportunity
  Lighthouse identifies, with an estimated 80ms saving.
- The unused-JavaScript opportunity is in shared framework chunks rather than
  the small route chunk.
- Image delivery passes. The first card uses a priority responsive image, while
  detail galleries remain on demand.

No product change is justified by this trace. Removing or inlining shared
styles, or attempting to fork framework chunks, would increase maintenance and
visual-regression risk while every measured target already passes.

## What remains unproven

Lighthouse TBT is a lab responsiveness proxy, not field INP. The repeatable
browser journey separately proves immediate budget and selection updates with
no browser exception, but the stated INP target still needs real-user field
data after an approved release. Physical iPhone/Safari and Android touch
testing also remains a release gate.
