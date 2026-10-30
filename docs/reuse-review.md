# Reuse review: shared primitives and consumer migration

Updated October 21, 2026. The third extraction batch is implemented as an additive
Platform 0.44.0 candidate. Consumer PRs own final checks, rollout and rollback evidence.

## October extraction batch

The review covered 22 direct submodule consumers, recent Store/Pool changes and
five desktop consumers with embedded runtimes. It did not establish deployment
parity or audit every line. Pool production was synchronized before this work.

| Item | Shared entry | Characterized consumer adapters |
| --- | --- | --- |
| Stripe script loading | Site Shell `script-loader-browser` | Pool and Store preserve Clover SDK URL, marker and errors. Failed tags are removed so concurrent retry cannot hang. |
| Async media targets | Admin Shell `editor-media.captureMediaTarget` | Store and Pool retain block/gallery identity across reorder and reject removal, replacement or detached editors. Source fields and picker UI remain local. |
| Node subprocess lifecycle | Node Core `process` | Film retains inherited output and supervisor signals; Podcast Visualizer retains bounded privacy-safe errors and auxiliary streams; Auto Subtitle retains offline environment and JSON progress. Group cleanup reaches descendants after leader exit. |
| Node runtime bootstrap | Node Core `bin/node-runtime.sh` | Pool and Store inject patched version floors, NVM search order and failure copy. Preserve an approved PATH runtime and fail closed otherwise. |
| Draft recovery baseline | Admin Shell `draft-recovery` | Pool pairs original revision and published snapshot across reloads, preserving conflicts and its exact legacy-revision upgrade rule. No Store domain seam is invented. |
| Publisher drain and rendering fixtures | Node Core `server-drain`; Test Core `rendering` | Store stops admission/scheduling while active catalog work completes; its layout tests use bounded font/frame readiness and same-origin text scaling. Viewport assertions and product markup stay local. |

Before extraction, independent Pool/Store Stripe cases exposed the retained
failed-tag bug; the local fix passed both suites. Store media identity, Pool's
28 draft cases, both runtime-selection suites, Store active-publish drain and
all three process adapters have consumer characterization. Additional cases
exposed Pool's stale numeric media target and Film's TERM-resistant descendant.
These corrections travel with the affected adapters and their regression tests.

Each consumer pins a full immutable candidate commit and exact package versions.
No existing consumer is required to adopt these optional entries. Native speech,
Swift/Qt updater, storage, credentials, payment and product policies are unchanged.
Release evidence is recorded only after the final candidate and affected-consumer
gates pass; source migration alone is not a claim of production publication.

Remaining project-specific improvements include Pool preview template data,
Store ticket reservations, contributions, PaymentIntent policy and product-row
markup. These do not establish framework-neutral shared contracts.

The base includes Release Core 0.5.1's smol-toml fix from
[PR 54](https://github.com/aindaco1/dust-wave-platform/pull/54), and the
[runtime trust boundary](security-runtime-trust.md). Consumer CA stores, signing
entitlements and release pipelines remain consumer-owned.

## Completed earlier batches

The source review covered 43 owned repositories and identified 12 direct
Platform consumers. It combined documentation, source inventories, duplicate
comparisons and focused contract reviews; it was not a line-by-line audit of
every repository. Private repository details and operational evidence remain
outside this public repository.

| Review scope | Result | Release evidence |
| --- | --- | --- |
| R1: admin declarations | Narrow public TypeScript entries and compiler fixtures; Scheduler removed its ambient declaration copy. | [v0.37.0](https://github.com/aindaco1/dust-wave-platform/releases/tag/v0.37.0), [PR 41](https://github.com/aindaco1/dust-wave-platform/pull/41) |
| R2: pin checks and discovery | Shared immutable gitlink/package/lockfile assertions, a capability catalog and a dated adoption inventory. | [v0.37.0](https://github.com/aindaco1/dust-wave-platform/releases/tag/v0.37.0) |
| R3: HTTP and crypto | One bounded stream mechanism with distinct request/response failure policies; reuse of existing hash and comparison primitives. | [v0.37.0](https://github.com/aindaco1/dust-wave-platform/releases/tag/v0.37.0) |
| R4: dependency audit | Shared report validation, failure classification and bounded retries; consumer execution and severity policy remain local. | [v0.37.0](https://github.com/aindaco1/dust-wave-platform/releases/tag/v0.37.0) |
| R5: documentation validation | Shared Markdown link/anchor mechanics; discovery, required guides and publication rules remain local. | [v0.37.0](https://github.com/aindaco1/dust-wave-platform/releases/tag/v0.37.0) |
| R6: SQLite test adapter | Injected statement/result normalization and transaction-backed batches in two consumers. This remains a partial unit-test adapter, not production D1 emulation. | [v0.37.0](https://github.com/aindaco1/dust-wave-platform/releases/tag/v0.37.0) |
| R7: backup utilities | Characterized retention planning, evidence-age classification and read-only receipt inspection in Pool and Store. | [v0.38.0](https://github.com/aindaco1/dust-wave-platform/releases/tag/v0.38.0), [PR 42](https://github.com/aindaco1/dust-wave-platform/pull/42) |
| R8: Notion transport | One bounded request attempt in two consumers; version, retry, schema, error and write-reconciliation policy remain local. | [v0.38.0](https://github.com/aindaco1/dust-wave-platform/releases/tag/v0.38.0) |
| R9: video posters | Shared first-frame lifecycle in Pool and Store, with explicit origin/base-URL policy and consumer-owned names. | [v0.38.0](https://github.com/aindaco1/dust-wave-platform/releases/tag/v0.38.0) |
| New-project recipes | Worker/admin preview, scheduled digest preview and a Jekyll site using the independently pinned template; fresh-checkout tests verify narrow installs, behavior and pin-drift rejection. | [Tested recipes](../examples/recipes/README.md) |

The releases passed their shared and affected-consumer gates. The second batch
included 321 shared tests, Node 22/24 CI, a Ruby 3.2 Jekyll recipe build,
before/after consumer characterization, browser media fixtures and independent
source rollback rehearsals. See [consumer adoption](consumer-adoption.md#reuse-rollout-source-snapshot--september-14-2026)
for immutable pins and consumer PRs; those PRs own migration, deployment and
rollback evidence. Package versions and APIs remain in the
[package catalog](../README.md#packages), rather than being repeated here.

Recorded deployments and public checks passed during rollout. This pause
record is not a fresh production-health check. Scheduled delivery, recipient
acceptance, live provider operations and protected backup/restore rehearsals
remain separate acceptance claims. No new product deployment is needed for
this documentation update, and existing scheduled services are not paused.

## Remaining work, in recommended order

1. **R13: small subtitle-format primitives.** Compare Auto Subtitle
   `engine/subtitles.mjs` with Podcast Visualizer `src/ass.js`. Start with
   timestamp rounding, encoding/escaping or bounded serialization that both
   consumers actually need, using the existing Timed Text boundary. Preserve
   Unicode, BOM/UTF-16, ASS field order, comments/styles, wording and malformed
   input behavior. A complete shared codec needs a neutral preservation
   contract and a second consumer; model, translation, file and visual policy
   remain local.
2. **R11: small cart mechanics.** Review versioned storage envelopes, event
   subscriptions/listener cleanup and busy/display helpers in the two
   `assets/js/cart-provider.js` files, one seam at a time. Reuse existing
   inventory/shipping/tax entries first. Campaign pledges, SKUs, quantities,
   RSVP, totals and fulfillment do not become a universal cart model.

The following follow-ups were deliberately left outside the completed slices:

- R2: selective adoption by additional consumers when an existing capability
  matches an actual need; do not synchronize all pins for version parity.
- R5: Python documentation adapters, built-HTML publication checks and
  fail-closed CI change classification still need separate characterization.
- R6: Film's broader SQLite/D1 test surface has not migrated to the shared
  adapter. Preserve real Worker/D1 integration checks in every consumer.
- R7/R8: filesystem discovery, backup execution/deletion/recovery, retry
  permission and Notion write reconciliation intentionally remain local.
- Assess matching email escapers, date helpers and static-site media/build/test
  entries before introducing another package. Schedules and editorial policy
  remain local.
- Desktop artifact/updater validation and screenplay interchange are separate
  candidates requiring their own fixtures and ownership. Preserve the existing
  RecordSpeech and Jekyll Template boundaries. No shared signing/publishing
  pipeline, screenplay domain model or second speech engine is planned here.

## Deferred native macOS roadmap

Decision recorded October 30, 2026: **on hold at the owner's request**.
Native Mac Live Activities, including preparatory Record changes, an optional
menu-bar fallback and any shared extraction, remain roadmap items only. Touch
proposals are also unscheduled. No implementation or toolchain migration is
scheduled.

Revisit when a public SDK exposes the native Mac ActivityKit/WidgetKit APIs and
a compatible runtime is established. The previously inspected Xcode 27.2 SDK
does not meet that gate; Apple's announced 27.3 beta is a candidate to verify,
not confirmed support. Availability prompts reassessment; implementation waits
until the owner reprioritizes the work.

The [macOS touch and Live Activities plan](macos-touch-and-live-activities-plan.md)
owns the SDK evidence, consumer findings and execution sequence: verify a signed
sample, pilot Record, then CutNotes, and extract only demonstrated duplication.
Preserve existing OS support and consumer ownership. Direct-touch acceptance
separately requires hardware that is not currently available.

## Resume checklist

1. Re-read the chosen consumers' current docs, source, tests and gitlinks;
   account for changes since this snapshot and preserve active worktrees.
2. Select one small seam using the [capability guide](capabilities.md). Record
   current behavior in every affected consumer before moving implementation.
3. Define narrow exports and failure semantics with explicit policy adapters.
   Follow the [migration and rollback workflow](consumer-adoption.md#migration-and-rollback-evidence).
4. Run shared and consumer gates, rehearse each consumer's rollback, then
   release an immutable package version and pin. Deploy each consumer through
   its own release procedure and record acceptance separately.
5. Clean only verified generated outputs and stale refs. Preserve locked
   dependencies, local state/settings, source fixtures, release evidence,
   published tags and active work. Record recovery locations outside Platform.
