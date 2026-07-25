# Dust Wave Platform

Versioned, framework-neutral primitives shared by [Dust Wave](https://dustwave.xyz), [The Pool](https://github.com/aindaco1/pool), [Store](https://github.com/aindaco1/store), and the first-party podcast platform.

This is intentionally a small monorepo, not a shared application runtime. Pool, Store, the Dust Wave site, and Podcast retain separate deployments, data, sessions, secrets, and business rules.

## Packages

| Package | Purpose | Status |
|---|---|---|
| `@dustwave/worker-core` | Runtime-neutral Worker security, signed-identity, Stripe, podcast-benefit code, and request primitives | `0.3.0`; exact and policy-injected duplicate extraction |
| `@dustwave/admin-shell` | Credentialed admin API client, passwordless session coordinator, accessible tabs, Pool-characterized rich-text codecs, and shared tagged-link/QR assets | `0.2.0`; QR engine source is shared by Podcast, Pool, and Store while canonical-path policies remain consumer adapters |
| `@dustwave/tax-core` | Store-characterized destination normalization and deterministic integer-cent manual-rate calculation | `0.1.0`; provider lookup and product taxability remain consumer-owned |

Planned packages are added only when consumer characterization tests prove a
stable boundary: player controls, media manifests, and alignment job contracts.

## Consumer model

Each consumer pins this repository as `shared/dust-wave-platform` and imports an exact package version. Submodule pointers are updated independently on consumer release branches. A consumer must never import another consumer's application code or storage.

## Development

```bash
npm install
npm test
```

No secrets are required for the shared unit suite.

`@dustwave/admin-shell` is intentionally unstyled. Each product retains its
templates, visual system, localization, roles, routes, and state. Its editor
codec is derived from the Pool behavior that preserves emphasis boundary spaces
and sanitizes rich pasted content. Podcast consumes the new package first;
Pool and Store keep their domain-specific URL and dashboard adapters. The shared
marketing asset module owns only normalization, canonical tagged-URL assembly,
QR matrix rendering, and the byte-derived MIT QR engine; email audiences,
attribution storage, and send authority remain consumer-owned.
