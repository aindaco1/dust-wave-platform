# Dust Wave Platform

Versioned, framework-neutral primitives shared by [Dust Wave](https://dustwave.xyz), [The Pool](https://github.com/aindaco1/pool), [Store](https://github.com/aindaco1/store), and the first-party podcast platform.

This is intentionally a small monorepo, not a shared application runtime. Pool, Store, the Dust Wave site, and Podcast retain separate deployments, data, sessions, secrets, and business rules.

## Packages

| Package | Purpose | Status |
|---|---|---|
| `@dustwave/worker-core` | Runtime-neutral Worker security and request primitives | `0.1.0`; first exact-duplicate extraction |

Planned packages are added only when consumer characterization tests prove a stable boundary: admin shell primitives, content editor codecs, player controls, timed text, media manifests, tax calculation, and alignment job contracts.

## Consumer model

Each consumer pins this repository as `vendor/dust-wave-platform` and imports an exact package version. Submodule pointers are updated independently on consumer release branches. A consumer must never import another consumer's application code or storage.

## Development

```bash
npm install
npm test
```

No secrets are required for the shared unit suite.
