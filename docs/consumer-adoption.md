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

## Reuse rollout source snapshot — September 14, 2026

The two reuse batches are complete; further extraction is paused. Source pins
below were rechecked against fetched default branches on September 14 UTC
(September 13, America/Denver). These supersede the pre-migration entries for
the listed consumers, not the independent pins of every other consumer.
Private consumer identity and operational evidence remain outside this guide.

- [Platform v0.37.0](https://github.com/aindaco1/dust-wave-platform/releases/tag/v0.37.0):
  immutable commit `30b1cf9c1154b6f38e3da34fc7b2ed3b6d312088`.
- [Platform v0.38.0](https://github.com/aindaco1/dust-wave-platform/releases/tag/v0.38.0):
  immutable commit `8609b10348da42f20e51b5a9048e074a3a3ae5e2`.

| Public consumer source | Pinned Platform release | Migration and rollback evidence |
| --- | --- | --- |
| [Pool at cfe28be2](https://github.com/aindaco1/pool/tree/cfe28be28073d9f92a06eeda71c270a1c4b463a3/shared/dust-wave-platform) | v0.38.0 | [PR 44](https://github.com/aindaco1/pool/pull/44), [PR 45](https://github.com/aindaco1/pool/pull/45) |
| [Store at 86418a05](https://github.com/aindaco1/store/tree/86418a0559668851f073d10ebd79c39a67531583/shared/dust-wave-platform) | v0.38.0 | [PR 81](https://github.com/aindaco1/store/pull/81) |
| [Opportunity Radar at f72193f3](https://github.com/aindaco1/dust-wave-opportunity-radar/tree/f72193f3c95238b550b08294cc52dd39d58e1eb6/shared/dust-wave-platform) | v0.38.0 | [PR 47](https://github.com/aindaco1/dust-wave-opportunity-radar/pull/47), [PR 48](https://github.com/aindaco1/dust-wave-opportunity-radar/pull/48) |
| [Scheduler at 9910b96b](https://github.com/aindaco1/scheduler/tree/9910b96bda8d476455bf8b27f7afe148a4be6dd5/shared/dust-wave-platform) | v0.37.0 | [PR 2](https://github.com/aindaco1/scheduler/pull/2) |
| [Film at 8c28a96e](https://github.com/aindaco1/film/tree/8c28a96e96f0c5e8b7924781ef1d3e344db366ef/shared/dust-wave-platform) | v0.37.0 | [PR 2](https://github.com/aindaco1/film/pull/2) |
| [RSS Feed Digest at 943dfe38](https://github.com/aindaco1/rss-feed-digest/tree/943dfe38506385a0df4de4794111ac03d3ffdacb/shared/dust-wave-platform) | v0.37.0 | [PR 3](https://github.com/aindaco1/rss-feed-digest/pull/3) |

Consumer PRs record validation, source rollback rehearsals and rollout evidence.
This refresh verified source and published Platform releases, not current live
provider health or the next scheduled delivery. The immutable release pins
remain unchanged by subsequent documentation commits on Platform's main branch.
See [reuse review status](reuse-review.md) for completed scope and deferred work.

## Pre-migration source adoption inventory — September 13, 2026

The portfolio source review identified 12 direct Platform consumers. The public
repository gitlinks below are verified at their linked source commits; private
consumer identities and operational data are excluded from this public guide.
These are pre-migration source pins, not deployment or release-status claims.
This inventory does not automatically upgrade any project.

| Public consumer source | Recorded Platform gitlink |
| --- | --- |
| [dust-wave-opportunity-radar](https://github.com/aindaco1/dust-wave-opportunity-radar/tree/d0fa2ca83b80fa0a022d8832a1365178ebdaf566/shared/dust-wave-platform) | `499252079bdb86f6cd92fb0d08aabbc1153aff34` |
| [pool](https://github.com/aindaco1/pool/tree/e8e19c36e88b75cb639186de225ee6eefe56147a/shared/dust-wave-platform) | `85165a16ac6923b438514bdce0a9957c1804db5f` |
| [store](https://github.com/aindaco1/store/tree/3ef837e8cf709472f16289eb7857171014637705/shared/dust-wave-platform) | `ae380c43a16af352ae946f47dd1b7aa4e5b093f0` |
| [dust-wave-new](https://github.com/aindaco1/dust-wave-new/tree/ba416c499123e72bf0c4cc6e14476035c81b6fd1/shared/dust-wave-platform) | `af2a5e5e4b65f218e627652b8243feb9704c48a1` |
| [scheduler](https://github.com/aindaco1/scheduler/tree/1701eb22421407111ea7a6aba7374caf4141e29c/shared/dust-wave-platform) | `af2a5e5e4b65f218e627652b8243feb9704c48a1` |
| [film](https://github.com/aindaco1/film/tree/e7e1b18d2f9c816e37ac80099a125758ed73488a/shared/dust-wave-platform) | `af2a5e5e4b65f218e627652b8243feb9704c48a1` |
| [rss-feed-digest](https://github.com/aindaco1/rss-feed-digest/tree/9d901d7067a7b720e6fa7ea74e6939bc3cfa3785/shared/dust-wave-platform) | `af2a5e5e4b65f218e627652b8243feb9704c48a1` |
| [dust-wave-podcast](https://github.com/aindaco1/dust-wave-podcast/tree/20f7bcabe033e02f1b2833daf78da0c4a775883f/shared/dust-wave-platform) | `af2a5e5e4b65f218e627652b8243feb9704c48a1` |
| [auto-subtitle](https://github.com/aindaco1/auto-subtitle/tree/2a8bf5467f8baa5a7cd6dfa0021289f2d149ab28/shared/dust-wave-platform) | `6da7db044f668a481d4bac2e5c2c8d78d17a3d2d` |
| [github-repo-scan](https://github.com/aindaco1/github-repo-scan/tree/59f937e9c252bcf610ff646b951e2d7c58efac0c/shared/dust-wave-platform) | `499252079bdb86f6cd92fb0d08aabbc1153aff34` |
| [podcast-visualizer](https://github.com/aindaco1/podcast-visualizer/tree/9140a979b5853a458a454b5118d8d0b6dd38c5cc/shared/dust-wave-platform) | `6da7db044f668a481d4bac2e5c2c8d78d17a3d2d` |

Use the [capability guide](capabilities.md) to select existing entries before
starting a project. Retain the historical release evidence below separately.

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


## Pool editor and feedback migration (2026-09-16)

Platform 0.39.0 publishes Admin Shell 0.12.0 and Design Core 0.3.0. The Pool
migration branch `codex/admin-preview-feedback` replaces local inline Markdown,
thumbnail/sandbox substitution, blank text and alt-description mechanics with
shared functions; it uses shared bilingual feedback through a campaign field
adapter and opts into shared editor layout mixins. The consumer retains GitHub
uploads, API routes, campaign policy, Ruby/Jekyll filters, and publication authority.
Consumer unit and browser tests cover nested emphasis, canonical saved asset paths,
local image previews before deployment, optional alt text, readable English/Spanish
errors, and panel containment. Platform tests cover the neutral policies separately.

The Pool pull request records the final immutable pin, deployment, and validation.
Rollback reverts that consumer change and restores Platform
`da7bd21ad77e936342d7d67948da88a25f56782c` (Admin Shell 0.11.0, Design Core 0.2.0)
together with its local adapters. No content or storage migration is required.
Other consumers retain their independent pins and deployments.
