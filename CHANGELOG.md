# Changelog

## 0.19.0 - 2026-08-06

### Added

- Added a policy-injected `@dustwave/worker-core` scoped-console factory from
  the exact Pool/Store Worker logger overlap, including child scopes, severity
  filtering, per-environment caching, and structured `Error` normalization.
- Added `@dustwave/media-core/site-catalog` with shared bounded repo-path,
  public-path, label, type, source/derivative, responsive-image, video WebM,
  manifest, and placement-budget mechanics.
- Added injected media scope, entity-slug, placement-budget, WebM-audio, and
  broken-reference policies for Store and Pool adapters.

### Security, performance, and boundaries

- Logger product/runtime/scope labels and structured error output are bounded;
  media paths reject controls, traversal, excessive length, and excessive
  known-path sets before catalog work.
- Platform sends no telemetry, performs no filesystem write or media transform,
  and owns no product/campaign content, provider, placement choice, credentials,
  deployment, or rollback.

## 0.18.0 - 2026-08-06

### Added

- Added `@dustwave/shipping-core` 0.1.0 with the independently characterized
  Pool/Store physical-item profile normalization, mixed-shipment aggregation,
  missing-metadata summary, manual USPS flat table, fallback/free quote shape,
  and delivery-option selection mechanics.
- Added explicit policy injection for origin country, fallback cents, free
  shipping, and configured option IDs so product and campaign policy remain in
  their consumer repositories.

### Reliability, performance, and boundaries

- Bounded tier, support-item, add-on, catalog, mail-class, and option lists;
  invalid quantities and missing physical metadata retain explicit failures.
- The package performs no USPS request, credential lookup, token caching,
  retry/backoff, catalog lookup outside injected data, checkout mutation,
  storage, or deployment. Store and Pool retain destination validation,
  provider transport/configuration, product/campaign rules, and rollback.

## 0.17.0 - 2026-08-06

### Added

- Added bounded, Web Platform-native signed JSON token creation and verification
  for the characterized Pool and Store passwordless-admin contract, including
  explicit expiry and required-claim checks.
- Added narrow session-cookie serialization and clearing primitives with
  validated names, paths, sizes, `SameSite`, `HttpOnly`, `Secure`, and
  non-negative `Max-Age` policy.
- Added same-origin request evidence evaluation with explicit consumer options
  for the existing missing-header and unconfigured-local behavior.

### Security and boundaries

- Tokens fail closed on missing expiry, extra segments, malformed base64url,
  invalid signatures, oversized token/payload/secret input, absent required
  claims, and expiry. Cookie input is bounded and rejects delimiter injection;
  `SameSite=None` cannot be emitted without `Secure`.
- Platform owns no user roles, session or nonce records, CSRF token, route,
  storage, credential, email, TTL selection, authorization decision, or
  deployment. Pool and Store inject those policies through thin adapters and
  retain independent rollout and rollback.

## 0.16.0 - 2026-08-06

### Added

- Added `@dustwave/worker-core` Resend/Svix verification for the characterized
  Store, Pool, and Podcast raw-body signature contract, including bounded event
  IDs, integer timestamps, multiple `v1` candidates, base64 secret handling,
  and explicit failure reasons.
- Added the shared bounded Resend error shape and pure retry classification for
  network failures, conflicts, rate limits, provider failures, and numeric or
  HTTP-date `Retry-After` guidance.

### Security and boundaries

- Webhook validation fails before event parsing on missing, malformed, stale,
  oversized, or mismatched inputs; signature work is bounded and comparisons
  use the existing constant-work primitive.
- Platform performs no email send, retry, provider lookup, webhook side effect,
  suppression, storage, or deployment. Consumers retain API transport,
  recipients, templates, consent, idempotency keys, outbox policy, credentials,
  and independent rollback.

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
