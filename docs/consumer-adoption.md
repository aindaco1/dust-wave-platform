# Consumer adoption

For maintainers integrating Platform packages into Pool, Store, the Dust Wave
website, Podcast, or another consumer. Consumer repositories retain domain
models, storage, templates, routes, secrets, content, and deployment authority.

## Pinning and ownership

Each consumer pins this repository as `shared/dust-wave-platform` and imports an exact package version. Submodule pointers are updated independently on consumer release branches. A consumer must never import another consumer's application code or storage.

Package releases are immutable. Read the package's README and public exports
at the pinned commit; the latest Platform documentation may describe APIs that
an older consumer pin does not contain. The [root package table](../README.md#packages)
links to each package reference in this checkout.

These pins are intentionally not synchronized automatically. A newer Platform
release becomes active in a consumer only after that consumer advances its
gitlink and exact package versions, passes its characterization and release
gates, and ships an independently reversible release.

## Migration and rollback evidence

1. Characterize the existing consumer behavior before extraction or migration.
   Exact duplicates move first. Near-duplicates require an injected policy or
   adapter and independent evidence in every current consumer.
2. Select an immutable Platform release on a consumer release branch. Update
   the submodule pointer, exact package versions, relevant lockfiles, and thin
   local adapters together. Consumer CI must check out submodules.
3. Run the affected consumer's characterization and release gates. Shared
   `npm test` results establish Platform behavior; they do not establish
   consumer deployment or acceptance.
4. Record the old and new Platform commits and package versions, validation
   results, consumer release evidence, and rollback evidence in the consumer
   pull request. Keep product data and environment-specific evidence in that
   consumer repository.
5. Retain a compatible rollback of the consumer's gitlink, package versions,
   lockfiles, and adapters. Rollback must be independently possible without
   advancing or reverting another consumer.

Do not merge a breaking Platform change until all affected consumers have a
compatible release branch. See the [repository rules](../AGENTS.md) and
[shared-repository ADR](adr/0001-shared-repository-boundary.md).

## Recorded adoption snapshot

The following values were recorded on **2026-08-06**. Documentation provenance
was checked on **2026-09-06** against the Platform commits linked below.
Consumer releases and live deployments were not reverified during that check;
this is a historical snapshot, not a current production-status claim.

| Consumer | Consumer release | Platform pin | Shared scope |
|---|---:|---:|---|
| Pool | `v1.2.20` | `v0.32.0` (`85165a16`) | Worker, admin, browser, design, build, release, shipping, tax, inventory, media, test, and local product-video primitives |
| Store | `v1.1.22` | `v0.31.0` (`5ca8ee6d`) | Worker, admin, browser, design, build, release, shipping, tax, inventory, media, and test primitives |
| Podcast | `v0.2.26` | `v0.23.0` (`a0006c3e`) | Worker HTTP/provider/GitHub, admin, media, tax, and timed-text primitives |
| Dust Wave website | `v1.3.0` | `v0.15.0` (`2e79a8d7`) | Media contracts and shared admin-shell browser assets |

Source records:

- [Initial adoption table, commit 9d4a7035](https://github.com/aindaco1/dust-wave-platform/commit/9d4a7035): Store, Podcast, website, and Jekyll Template values.
- [Pool product-video adoption, commit 037c37ab](https://github.com/aindaco1/dust-wave-platform/commit/037c37ab): Pool release and Platform pin update.

At the same snapshot, Pool and Store also pinned
[`dust-wave-jekyll-template`](https://github.com/aindaco1/dust-wave-jekyll-template)
`v0.1.0` (`351281a5`) for 17 checked-in Jekyll integration files. The template
is a compile-time source-upgrade dependency with its own versioning and explicit
upgrade workflow. The [design-system and Jekyll ADR](adr/0002-design-system-and-jekyll-boundary.md)
records that boundary.

When refreshing this table, verify the consumer's release and recorded gitlink,
include the verification date and evidence, and distinguish shipped adoption
from a local pointer update or passing Platform tests. Consumer pull requests
remain authoritative for migration, deployment, and rollback evidence.
