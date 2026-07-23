# ADR 0001: shared repository boundary

- Status: accepted
- Date: 2026-07-23

## Decision

Use one public `aindaco1/dust-wave-platform` monorepo for framework-neutral packages. Pool, Store, Dust Wave, and Podcast pin it as a Git submodule at `shared/dust-wave-platform`.

The first extraction is the byte-identical Turnstile module in Pool and Store. The original source hashes match before extraction. Each consumer migrates independently on its own release branch and can revert its submodule pointer without changing another product.

## Consequences

- Shared code has one source, package version, test suite, and changelog path.
- Consumer domain logic and deployment remain separate.
- CI that consumes a shared package must check out submodules.
- No consumer follows the shared repository's moving branch at runtime or build time; the recorded gitlink is authoritative.
- Near-duplicate code is not moved until tests define its stable policy/adapter boundary.
