# Dust Wave Platform

Versioned, framework-neutral primitives shared by [Dust Wave](https://dustwave.xyz), [The Pool](https://github.com/aindaco1/pool), [Store](https://github.com/aindaco1/store), and the first-party podcast platform.

This is intentionally a small monorepo, not a shared application runtime. Pool, Store, the Dust Wave site, and Podcast retain separate deployments, data, sessions, secrets, and business rules.

## Packages

| Package | Purpose | Status |
|---|---|---|
| `@dustwave/worker-core` | Runtime-neutral Worker security, signed-identity, Stripe, podcast-benefit code, and request primitives | `0.3.0`; exact and policy-injected duplicate extraction |
| `@dustwave/admin-shell` | Credentialed admin API client, passwordless session coordinator, accessible tabs, Pool-characterized rich-text codecs, and shared tagged-link/QR/share-card assets | `0.2.0`; QR and bounded SVG composition are shared while canonical-path, rasterization, and product-content policies remain consumer adapters |
| `@dustwave/tax-core` | Store-characterized destination normalization and deterministic integer-cent manual-rate calculation | `0.1.0`; provider lookup and product taxability remain consumer-owned |
| `@dustwave/media-core` | Runtime-neutral source-audio QC policy, signed processor manifest, normalized measurements, finding, and report contracts | `0.1.0`; processing placement, storage, approval, and publication remain consumer-owned |
| `@dustwave/timed-text` | Bounded English/Spanish provider-segment normalization, deterministic transcript projections, and large-source chunk planning/merge contracts | `0.2.0`; provider calls, storage, review, speaker identity, word alignment, and publication remain consumer-owned |

Planned packages are added only when consumer characterization tests prove a
stable boundary: player controls and alignment job contracts. The first media
contract is intentionally limited to deterministic source-audio QC structures
shared by the Podcast Worker and its owner-controlled FFmpeg processor.
The first timed-text contract accepts only bounded monotonic provider segments,
normalizes generated text as untrusted plain text, and never manufactures word
timing or speaker identity. Its large-source extension deterministically chooses
safe silence boundaries (or duration fallbacks), binds processor manifests to
immutable source/output evidence, and merges source-relative segment timing with
conservative overlap removal. It still never manufactures word timing or
speaker identity.

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
QR matrix rendering, bounded escaped social-card SVG composition, and the
byte-derived MIT QR engine. Consumers supply trusted product text and an
already-bounded image data URL, then choose their own rasterizer, storage, and
publication policy; email audiences, attribution storage, and send authority
remain consumer-owned.
