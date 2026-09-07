# Dust Wave Platform

Versioned, framework-neutral primitives shared by [Dust Wave](https://dustwave.xyz), [The Pool](https://github.com/aindaco1/pool), [Store](https://github.com/aindaco1/store), and the first-party podcast platform.

This is intentionally a small monorepo, not a shared application runtime. Pool, Store, the Dust Wave site, and Podcast retain separate deployments, data, sessions, secrets, and business rules.

## Boundaries

Packages are added only when consumer characterization tests prove a stable
boundary. Exact duplicates move first; near-duplicates require injected policy
or adapters and independent migration evidence. Consumers retain domain models,
storage, templates, routes, credentials, content, and deployment authority.

Each consumer pins a Platform submodule commit and exact package versions.
Package releases are immutable; consumers upgrade and roll back independently.
See the [consumer adoption guide](docs/consumer-adoption.md) for the migration
workflow and recorded adoption snapshot, and [AGENTS.md](AGENTS.md) for the
repository contribution rules.

## Packages

| Package | Purpose and reference | Version |
|---|---|---|
| `@dustwave/inventory-core` | [Inventory snapshots, counts, and expiring reservations](packages/inventory-core/README.md) | `0.1.0`|
| `@dustwave/worker-core` | [Worker HTTP, security, providers, sessions, logging, and outbox mechanics](packages/worker-core/README.md) | `0.12.1`|
| `@dustwave/shipping-core` | [Shipping profiles, quotes, USPS transport, and country data](packages/shipping-core/README.md) | `0.2.0`|
| `@dustwave/admin-shell` | [Unstyled admin clients, session/UI controls, editors, and share assets](packages/admin-shell/README.md) | `0.10.2`|
| `@dustwave/tax-core` | [Destination normalization, manual calculation, and provider transport](packages/tax-core/README.md) | `0.3.0`|
| `@dustwave/test-core` | [Browser Storage setup and overflow assertions](packages/test-core/README.md) | `0.1.0`|
| `@dustwave/design-core` | [Compile-time Sass foundations, forms, layout, and components](packages/design-core/README.md) | `0.2.0`|
| `@dustwave/site-shell` | [Classic browser navigation, announcements, forms, and cart display](packages/site-shell/README.md) | `0.2.0`|
| `@dustwave/build-core` | [Allowlisted generated CSS/JavaScript minification](packages/build-core/README.md) | `0.2.0`|
| `@dustwave/release-core` | [Release normalization, integrity, provider, and accessibility evidence](packages/release-core/README.md) | `0.2.0`|
| `@dustwave/media-core` | [Site-media paths/catalogs and audio processor contracts](packages/media-core/README.md) | `0.4.0`|
| `@dustwave/product-video-core` | [Local declarative capture and alpha-video rendering](packages/product-video-core/README.md) | `0.1.0`|
| `@dustwave/timed-text` | [Transcription, alignment, confidence, editorial, presentation, and chapters](packages/timed-text/README.md) | `0.11.1`|

## Development

Use Node.js 20.9 or newer; CI uses Node.js 22. From the repository root:

```bash
npm ci
npm run check
```

The check runs the secret scan, locked dependency audit, and unit suite. No
secrets are required. See the [development guide](docs/development.md) for
individual checks and consumer secret-audit adapters.

## Documentation

- [Documentation index](docs/README.md): guides, architecture decisions, and document ownership.
- [Consumer adoption](docs/consumer-adoption.md): pinning, migration, rollback, and recorded release evidence.
- [Changelog](CHANGELOG.md): Platform release history.
- [License](LICENSE): MIT terms.
