# N1 mobile-web performance comparison

Date: 20 August 2026

Status: local N1 evidence only. This report does not authorise a commit, push,
deployment, feature-flag change, production-data change or paid service.

## Purpose

Confirm that extracting the reusable planning domain and API contracts into
npm workspaces does not regress the existing mobile-web Planning Hub. This is
a before/after lab comparison, not a production Core Web Vitals report.

## Compared states

| State | Revision | Description |
| --- | --- | --- |
| Before | `880a4eeaabdb497742ede9712a8b14cf19a17cec` | Exact `origin/main` before N0/N1 |
| After | `e0e65f560f770aa04c618d3af12112c219487320` plus the uncommitted N1 diff | N0 planning commit plus extracted shared packages and compatibility exports |

Both states were installed with the root lockfile, built using the production
Next.js build and served locally with only
`PLANNING_HUB_PUBLIC_ENTRY_ENABLED=true`. No hosted service, production data,
Supabase migration or production flag was used.

## Test method

- URL: `/planning-hub`
- Lighthouse: 13.4.1, mobile defaults, three runs per state
- Browser: Chrome 151.0.7922.169
- Categories: Performance and Accessibility
- Comparison: median of three runs
- Local catalogue limitation: no Supabase environment was supplied, so the
  shell and device-plan experience rendered but venue results showed the
  existing `Venue search needs attention` state. A data-backed journey remains
  a later production-like release check.

Reproduction outline:

```text
npm ci
PLANNING_HUB_PUBLIC_ENTRY_ENABLED=true npm run build
PLANNING_HUB_PUBLIC_ENTRY_ENABLED=true npm run start -- --port <port>
lighthouse http://localhost:<port>/planning-hub \
  --only-categories=performance,accessibility --output=json
```

Run each state three times from a fresh Lighthouse navigation and compare the
median. On Windows in this run, Lighthouse wrote valid JSON reports but Chrome
held its temporary profile briefly enough for cleanup to report `EPERM`; that
post-report cleanup error did not invalidate the generated measurements.

## Results

| Metric | Before median | After median | N1 change | Goal |
| --- | ---: | ---: | ---: | ---: |
| Lighthouse performance | 97 | 97 | 0 | at least 90 |
| Lighthouse accessibility | 100 | 100 | 0 | no regression |
| First Contentful Paint | 916 ms | 917 ms | +1 ms | observation |
| Largest Contentful Paint | 2,470 ms | 2,476 ms | +6 ms | below 2,500 ms |
| Cumulative Layout Shift | 0 | 0 | 0 | below 0.1 |
| Total Blocking Time | 114 ms | 116 ms | +2 ms | lab responsiveness proxy |
| Transfer size | 216,278 bytes | 215,376 bytes | -902 bytes | no regression |
| Requests | 17 | 16 | -1 | no regression |

Individual Performance/LCP results were:

- Before: `95 / 2,548 ms`, `97 / 2,470 ms`, `98 / 2,351 ms`.
- After: `96 / 2,537 ms`, `97 / 2,476 ms`, `97 / 2,435 ms`.

The after median met the LCP target; one of three runs was 37 ms over it. The
median performance and accessibility scores were unchanged, and the 6 ms LCP
and 2 ms TBT differences are normal lab variance rather than evidence of a
regression. The later production-like release gate still requires repeatable
target compliance rather than relying on one local median.

## Rendering and interaction evidence

Automated browser verification on both builds found the same 61 annotated
Planning Hub elements, including navigation, budget inputs, venue filters,
manual venue entry, save action and next-stage photography link. Both builds
had meaningful page content, no framework error overlay and no captured console
errors. The after-state home route also rendered successfully.

Lighthouse navigation reports do not provide INP because they do not contain a
representative interaction population. A local after-state interaction sample
changed the budget, guest count and location and saved the plan; its observed
save interaction duration was 32 ms. This is useful regression evidence but is
not a substitute for field INP or a broader scripted interaction trace. The
public-release gate therefore remains INP below 200 ms from production-like or
field evidence.

## Conclusion

N1 preserves the measured mobile-web shell performance and accessibility while
moving shared logic behind explicit package entry points. A production-like,
data-backed Planning Hub journey and field-quality INP evidence remain later
release gates; neither blocks this behavior-preserving extraction.
