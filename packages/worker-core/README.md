# `@dustwave/worker-core`

Runtime-neutral Worker primitives for consumer adapters. Authentication,
authorization, telemetry, provider policy, storage, and product behavior remain
consumer-owned.

## Date, time, and timezone behavior

The Worker timezone entry exposes runtime-supported IANA zone discovery,
labels, validation, and deterministic fallback. Unsupported values fall back
to a caller-supplied supported zone or `America/Denver`. The date/time entry
adds the exact Pool/Store local-part, date-key, day-boundary, formatting, and
daily-window mechanics. Pool retains campaign naming and Store retains its
catalog/order scheduling policy through thin adapters. Invalid date shapes
produce an invalid `Date`; formatting invalid instants propagates the runtime
`RangeError` rather than manufacturing a value.

## HTTP, request validation, and provider fetch

The Worker HTTP entry requires a valid consumer-supplied private origin before
it returns helpers. It normalizes configured origins, never accepts wildcard
as a private fallback, and preserves the characterized JSON, CORS, and baseline
security-header contract. JSON serialization and invalid `Response` status
errors propagate. Consumers retain route visibility, authentication,
authorization, CSRF, CSP, HSTS, cache, rate-limit, and deployment policy.

The request-validation entry rejects oversized declared bodies before reading,
bounds streamed bodies by encoded bytes, cancels after a limit is crossed, and
preserves explicit request error status/code fields. JSON readers accept only
objects; scalar helpers keep the independently characterized Podcast
normalization and failure semantics. The provider-fetch entry owns one timeout
and abort signal around an injected or global Fetch implementation, always
clears its timer, and never retries. The policy-injected CORS/JSON helper
reflects only an exact origin from the consumer's comma-separated allow-list
matches and lets consumers supply their own method, request-header, base
response, and private response policies. Podcast retains routes, schemas, CSRF
names, allowed-origin configuration, authorization, provider credentials,
retry, storage, deployment, and rollback.

## GitHub transport

The GitHub entry adds a bounded, timeout-enforced transport for
workflow dispatch, Contents API operations, directory listing, and atomic
multi-file commits. It validates repository-relative paths, branch refs,
workflow names, input counts, file sizes, and response sizes; never returns
credentials or raw network errors; and never retries or force-updates a branch.
It uses the edge-runtime-compatible manual redirect mode and rejects every 3xx
response before reading or following its location.
Consumers retain repository selection, publish mode, content schemas, paths,
messages, logging, authorization, effects, and rollback.

## Stripe transport

The Stripe entry provides one form-encoded Worker transport for the
characterized Pool, Store, and Podcast operations. It accepts injected API
version, user agent, fetch, and redacted observation policy; it never returns
the API key or request body to observers. Network failures and Stripe-directed
or status-derived retryability are classified but never retried automatically.
Invalid object IDs fail before a request, malformed webhook timestamps fail
closed, observer failures cannot change payment behavior, and provider error
messages are whitespace-normalized and bounded. Consumers retain keys,
idempotency construction, prices, products, settlement, reconciliation,
webhook effects, retry scheduling, and deployment authority.

## Resend webhook mechanics

The Resend entry verifies bounded Svix webhook IDs, integer timestamps,
multiple `v1` signatures, and the exact raw request body with a five-minute
default tolerance. It classifies network, conflict, rate-limit, and server
failures plus bounded numeric or HTTP-date `Retry-After` guidance, but never
performs a retry or parses a provider event. Consumers retain API transport,
templates, recipients, consent, idempotency construction, outboxes,
suppression, webhook effects, scheduling, credentials, and deployment.

## Session security

The session-security entry signs and verifies bounded expiring JSON claims,
serializes the characterized secure session-cookie shape, and evaluates
same-origin request evidence. Verification requires one exact two-part token,
a valid integer expiry, and any consumer-declared claims. Cookie names, paths,
values, and policy are validated; `SameSite=None` requires `Secure`. The
same-origin primitive fails unconfigured policy closed by default, while Pool
and Store may explicitly preserve their existing local-development allowance.
Consumers retain secret selection, nonce and session storage, TTL selection,
roles, scopes, CSRF tokens and header names, routes, authorization, login email,
credentials, rate limiting, deployment, and rollback.

## Scoped logging

The Worker logger entry creates a consumer-named scoped-console factory with
per-owner policy caching, child scopes, severity filtering, and bounded
structured `Error` output. It writes only to an injected console-compatible
target and sends no telemetry. Consumers retain environment/config parsing,
observability destinations, redaction policy for ordinary objects, and whether
logging is enabled.

## Additional entries

- [Crypto](src/crypto.js): byte/string SHA-256 checksums, HMAC, tokens,
  `timingSafeEqual`, email, and cookie helpers.
- [Turnstile](src/turnstile.js): verification with consumer-injected secret,
  required-challenge, bypass, and action policy.
- [Outbox](src/outbox.d.ts): canonical payload/job IDs, bounded records,
  queue state, terminal/due/expiry/lease classification, injected retry policy,
  redacted failure evidence, and Resend event mechanics. It performs no
  storage operation, send, or retry scheduling.
- [Podcast benefits](src/podcast-benefits.js): shared benefit-code mechanics;
  entitlement and redemption policy remain consumer-owned.

Failure behavior is entry-specific; the linked implementations, declarations,
and tests define validation errors and structured result shapes.

## Reference

See the [public exports](package.json), [source contracts](src/), and
[behavior tests](test/). Follow the shared
[consumer adoption guide](../../docs/consumer-adoption.md) when updating a pin.
