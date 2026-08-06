# Changelog

## 0.15.0 - 2026-08-06

### Added

- Added `@dustwave/release-core` 0.1.0 with the exact Pool/Store Wrangler
  inventory, KV bulk-get transformation, and checksum-manifest primitives.
- Added canonical redacted provider-evidence and structured command-result
  normalization for consumer-owned release scripts.
- Added complete-manifest checks for path escape, duplicate, missing, changed,
  unlisted, symlink, and unsupported filesystem entries.

### Boundaries

- Platform performs no deployment, provider mutation, secret lookup, traffic
  shift, or rollback. Consumers retain commands, credentials, environment IDs,
  release gates, rollout policy, and independent deployment authority.

## 0.14.0 - 2026-08-06

### Added

- Consolidated the characterized Pool and Store PaymentIntent, SetupIntent,
  Checkout Session, Customer, and PaymentMethod operations into the shared
  `@dustwave/worker-core` 0.6.0 Stripe transport without removing Podcast
  billing operations.
- Added fetch, API-version, user-agent, and redacted observation injection for
  thin consumer adapters.

### Security and reliability

- Fail malformed webhook timestamps and blank object IDs before provider work.
- Honor Stripe's explicit retry header before status-derived classification,
  while leaving all actual retry and reconciliation policy consumer-owned.
- Send idempotency keys only for Stripe API v1 POST requests and keep API keys,
  request bodies, and customer data out of observation events.

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
