# Changelog

## 0.31.0 - 2026-08-06

### Added

- Expanded `@dustwave/build-core` to 0.2.0 with repeatable, explicitly
  allowlisted generated-asset roots in both the API and CLI.
- Added characterization for default-only scope, multiple roots, duplicate
  normalization, missing roots, CLI flag forms, and untouched unselected and
  vendor files.

### Security, performance, and boundaries

- Asset roots reject absolute paths, traversal, blank or dot segments, unsafe
  characters, overlong values, more than 16 entries, and any resolved path
  outside the built site without reflecting unsafe values. Every selected root
  must exist before any file is changed.
- Pool and Store can now minify their generated copies of pinned Site Shell
  scripts without adding requests or changing runtime behavior. Consumers
  continue to select roots and own source files, builds, budgets, deployment,
  and independent rollback.

## 0.30.0 - 2026-08-06

### Added

- Expanded `@dustwave/design-core` to 0.2.0 with the byte-identical Pool/Store
  form controls plus their characterized layout and mixin near-overlap.
- Added compile-time policy for padding- versus width-based centered gutters
  and consumer-owned brand-title letter spacing, animation identity, mobile
  type scale, and line width.
- Added contract coverage for the exact form source, narrow exports, neutral
  policy defaults, interpolation, and the absence of product-named selectors.

### Performance, responsiveness, and boundaries

- The package remains Sass-only and adds no browser JavaScript, request,
  runtime configuration, or deployment coupling. Consumer migrations must
  prove byte-equivalent generated main/admin CSS and rerun responsive,
  accessibility, performance-budget, and full release gates.
- Tokens, selected policy values, import order, templates, content, Jekyll
  integration, credentials, deployment, and independent rollback remain in
  Pool and Store. Liquid includes and Ruby plugins remain outside Platform.

## 0.29.0 - 2026-08-06

### Added

- Added `@dustwave/site-shell` 0.2.0 with the characterized Pool/Store shipping
  option utility, deferred stylesheet activator, form-control identity helper,
  and cart-summary icon behavior.
- Replaced product-named globals in the shared mechanics with neutral Dust Wave
  globals or bounded data-attribute policy for cache, provider, event, ID
  prefix, and dataset-priority identity.
- Added framework-free browser characterization for quote selection, signature
  price labels, deferred activation, explicit control identity preservation,
  unsafe policy fallback, cached cart summary rendering, and provider cart
  opening.

### Security, accessibility, performance, and boundaries

- Policy strings are length- and character-bounded before global, storage, ID,
  or event use. Generated control IDs remain deterministic, explicit IDs/names
  are preserved, and dynamically inserted controls retain the characterized
  observer path. Shared scripts add no dependency, timer, network request, or
  storage migration and replace the same number of consumer script requests.
- Platform owns no form schema, cart provider, price or tax calculation,
  shipping quote, currency/label localization, template, style, breakpoint,
  Content Security Policy, deployment, or rollback. Pool and Store retain that
  policy in independently reversible includes and runtime adapters.

## 0.28.0 - 2026-08-06

### Added

- Added `@dustwave/release-core` 0.2.0 with shared cache-policy evidence,
  policy-injected Cloudflare admin response-rule management, and assisted
  VoiceOver/Whisper screen-reader evidence.
- Added characterization coverage for cache semantics, exact origin/path
  handling, redirect rejection, body cancellation, response-body omission,
  Cloudflare drift matching, edge-injection failure, repeated transcript
  expectations, missing recordings, and non-macOS behavior.

### Security, accessibility, performance, and boundaries

- Provider rule identities, origins, paths, target counts, diagnostics, audio
  settings, transcript phrases, and command names are bounded. Screen-reader
  commands receive argv directly without a shell; Cloudflare evidence never
  returns tokens or response bodies; cache probes cancel bodies after headers.
- Platform owns no product origin, rule identity, credential, recording
  consent, evidence-retention policy, target list, provider mutation approval,
  deployment, or rollback. Consumers inject those policies through thin,
  independently reversible adapters.

## 0.27.0 - 2026-08-06

### Added

- Added optional `@dustwave/design-core` 0.1.0 with the exact Pool/Store Sass
  overlap for base typography, buttons, content blocks, modals, and utilities.
- Recorded the explicit design-system/Jekyll boundary: shared Sass is a
  compile-time package, while Liquid includes, Ruby plugins, tokens, markup,
  content, localization, build hooks, and deployment remain consumer-owned.

### Accessibility, performance, and boundaries

- Platform locks the initial sources to both consumers' characterized hashes;
  consumer migrations must preserve generated CSS and pass their complete
  mobile, accessibility, build, security, and pre-merge suites.
- Components add no JavaScript or runtime request cost, and future consumers
  can import only the styles they use. Platform owns no breakpoint, visual
  token, template, content, asset, CSS budget, Jekyll runtime, or deployment.

## 0.26.0 - 2026-08-06

### Added

- Added `@dustwave/test-core` 0.1.0 with the exact Pool/Store browser Storage
  setup and mobile horizontal-overflow assertion mechanics.
- Kept Vitest and Playwright injected by tiny consumer adapters, so Platform
  does not add a test-runner or browser-automation runtime dependency.

### Reliability and boundaries

- Storage shims preserve the Web Storage surface used by both consumers and
  reuse an existing usable browser implementation; overflow tolerance is
  explicit and bounded, and missing page/expect adapters fail before polling.
- Platform owns no consumer fixtures, URLs, viewports, breakpoints, styles,
  content, runner configuration, browser installation, CI orchestration,
  deployment, or rollback. Consumer copies of behavior-focused accessibility
  and media tests remain independent migration evidence.

## 0.25.0 - 2026-08-06

### Added

- Added `@dustwave/worker-core` 0.12.0 durable-outbox primitives for canonical
  payload serialization and job IDs, bounded record and queue-state creation,
  terminal/due/expiry/lease classification, injected retry policy, redacted
  failure evidence, safe email/tag normalization, and Resend event mechanics.

### Security, performance, and boundaries

- Job kinds, dedupe inputs, records, metadata, email/tag values, error evidence,
  webhook tags, retry/lease policy, and timestamps are bounded or validated;
  consumer metadata cannot override lifecycle fields; errors omit messages,
  payloads, addresses, credentials, and provider response bodies.
- Platform performs no KV/D1/Queue operation, template rendering, provider
  send, retry scheduling, suppression lookup/write, order/pledge mutation,
  webhook storage effect, credential lookup, deployment, or rollback. Pool and
  Store retain those policies in independently reversible adapters.

## 0.24.0 - 2026-08-06

### Added

- Added bounded, timeout-enforced Zip-Tax v60 and New Mexico GRT lookup
  transports to `@dustwave/tax-core` 0.3.0, plus the exact Pool/Store address,
  street-parser, and provider-source normalization mechanics.

### Security, performance, and boundaries

- Provider bases require HTTPS, redirects are rejected, input and response
  sizes are bounded, deadlines abort in-flight work, and network errors never
  return credentials or raw exceptions. Provider failure messages are bounded,
  while failed New Mexico responses remain generic.
- Platform performs no provider selection or fallback, rate/taxability
  decision, tax calculation from provider data, address eligibility, checkout
  mutation, storage, credential lookup, retry, deployment, or rollback.
  Consumers retain those policies and independently reversible adapters.

## 0.23.0 - 2026-08-06

### Added

- Added a policy-injected GitHub client to `@dustwave/worker-core` 0.11.0 for
  workflow dispatch, bounded UTF-8/base64 Contents API reads and writes,
  directory listing, idempotent deletion, and Store-characterized atomic
  multi-file commits with optimistic SHA checks.
  Public-repository reads may omit a token; every mutation fails before
  transport when credentials are absent.

### Security, performance, and boundaries

- Repository paths, refs, workflows, workflow inputs, content, messages, and
  provider responses are bounded; requests time out and reject redirects;
  network errors are normalized without returning tokens or raw exceptions;
  batch updates use one non-force branch move and reject duplicate or stale
  file evidence before creating a commit.
- Platform performs no retry, repository selection, publish-mode decision,
  content construction, logging, credential lookup, route handling, provider
  mutation outside an explicit call, deployment, or rollback. Consumers retain
  those policies and independent release authority.

## 0.22.0 - 2026-08-06

### Added

- Added a policy-injected USPS OAuth/rate client to `@dustwave/shipping-core`
  0.2.0 from the characterized Pool/Store transport, including one 401 token
  refresh, domestic/international payloads, service/price normalization,
  bounded quote caching, and provider cooldown state.
- Moved the exact 95-entry Pool/Store shipping-country registry beside
  shipping-core and added an explicit-output check/write sync command for the
  Jekyll consumer snapshots.

### Security, performance, and boundaries

- Provider credentials stay inside request construction and never appear in
  result/error shapes. Mail-class lists, access tokens, and the in-memory quote
  cache are bounded; timeouts abort; 429/5xx/timeout cooldowns prevent provider
  stampedes; cached OAuth tokens are isolated by base URL and client ID.
- Platform owns no shipping eligibility, catalog, fallback/free rate, address
  policy, credentials, checkout, fulfillment, storage, route, deployment, or
  carrier account. Consumers retain configuration and independent rollback.

## 0.21.0 - 2026-08-06

### Added

- Added `@dustwave/inventory-core` 0.1.0 with shared deep-copy, count-map,
  reservation expiry, reserved-count, and inventory-state normalization
  mechanics characterized in Pool and Store.
- Made the consumers' distinct bootstrap behavior explicit: Pool keeps its
  stored campaign snapshot authoritative, while Store refreshes catalog
  metadata and preserves already-claimed counts.

### Reliability and boundaries

- Reservation TTL and bootstrap strategy are required policy; callers may
  inject time for deterministic tests. Expired reservations are removed with
  explicit cleanup evidence, and reservation updates can exclude their own
  counts when calculating availability.
- Platform performs no Durable Object transaction, KV write, catalog lookup,
  checkout mutation, reservation scheduling, order/pledge transition, route,
  credential lookup, or deployment. Consumers retain those responsibilities
  and independent rollback.

## 0.20.0 - 2026-08-06

### Added

- Added bounded streamed request bytes/text and required/optional JSON-object
  readers to `@dustwave/worker-core`, with the characterized Podcast scalar
  validation and filename/date normalization contract.
- Added provider fetch timeouts with one managed abort signal and an injectable
  transport for deterministic consumer tests.
- Added policy-injected exact-origin CORS, JSON, private JSON, and preflight
  response helpers while preserving the existing Pool/Store HTTP API.

### Security, performance, and boundaries

- Oversized declared bodies fail before consumption; undeclared streamed bodies
  are cancelled immediately after crossing the byte limit; origin reflection is
  restricted to exact consumer allow-list matches; private responses override
  caller cache and indexing headers.
- Platform owns no routes, authorization, CSRF policy, allowed-origin values,
  provider credentials, retry policy, response schema, storage, or deployment.
  Consumers retain those policies and independent rollback.

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
