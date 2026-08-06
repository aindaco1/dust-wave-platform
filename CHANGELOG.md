# Changelog

## 0.13.0 - 2026-08-06

### Added

- Added policy-injected HTTP/CORS and baseline security-response helpers to
  `@dustwave/worker-core` 0.5.0 from the characterized Pool and Store overlap.
- Added generic timezone-aware date parts, date keys, day boundaries,
  formatting, deadline comparison, and daily-window mechanics.
- Added regression coverage for invalid origins, private/public CORS,
  serialization failures, invalid dates, and 23/25-hour daylight-saving days.

### Boundaries

- Consumers must inject their private fallback origin and continue to own
  routes, authentication, authorization, CSRF, CSP, HSTS, cache, and rate-limit
  policy.
- Pool retains campaign terminology; Store retains product and order scheduling
  policy through independently reversible adapters.

## 0.12.0 - 2026-08-06

### Added

- Added `@dustwave/site-shell` 0.1.0 with the independently characterized,
  dependency-free Pool and Store header-navigation and live-announcement
  browser behavior.
- Added `@dustwave/build-core` 0.1.0 with the exact Pool and Store generated
  CSS/JavaScript minification contract and CLI.
- Added runtime-supported IANA timezone primitives to
  `@dustwave/worker-core` 0.4.0.
- Added the exact Pool and Store New Mexico GRT starter snapshot and an
  explicit-output, fail-before-write updater to `@dustwave/tax-core` 0.2.0.
- Added Platform-owned characterization and failure-semantics coverage for
  every extracted primitive.

### Boundaries

- Pool and Store continue to own templates, visual assets, product content,
  routes, localization, domain scheduling, tax-provider policy, source builds,
  credentials, data, and deployments.
- Consumers migrate and roll back their exact Platform pin independently.

## 0.11.5 - 2026-08-06

### Fixed

- Centralized strict local and historical credential detection without
  returning suspected secret values.
- Preserved consumer-owned secret filename and fixture policy in thin local
  adapters.

### Package versions

- `@dustwave/admin-shell` 0.10.2
- `@dustwave/worker-core` 0.3.6
- `@dustwave/tax-core` 0.1.0
- `@dustwave/media-core` 0.3.0
- `@dustwave/timed-text` 0.5.0
