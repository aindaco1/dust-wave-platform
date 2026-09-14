# Reuse review: completed work and deferred candidates

Status recorded September 13, 2026, America/Denver (September 14 UTC).
The portfolio reuse effort is **paused after two completed release batches**.
No third batch has started. The candidates below are a resume plan, not
accepted APIs or a requirement to upgrade every consumer.

## Completed

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

1. **R12: managed subprocess mechanics.** Compare Podcast Visualizer
   `src/process.js`, Auto Subtitle `engine/process.mjs` and Film
   `scripts/managed-process.mjs`. Characterize argument vectors, time/output
   limits, cancellation, child/grandchild termination, spawn failures, signal
   exits and paths with spaces before designing a Node-only entry. Inject
   process-tree strategy; retain executable selection, environment policy,
   progress decoding and app-specific errors in each consumer. Add a small
   local-tool recipe only after real consumer migrations prove the interface.
   Swift and Rust adapters remain separate.
2. **R13: small subtitle-format primitives.** Compare Auto Subtitle
   `engine/subtitles.mjs` with Podcast Visualizer `src/ass.js`. Start with
   timestamp rounding, encoding/escaping or bounded serialization that both
   consumers actually need, using the existing Timed Text boundary. Preserve
   Unicode, BOM/UTF-16, ASS field order, comments/styles, wording and malformed
   input behavior. A complete shared codec needs a neutral preservation
   contract and a second consumer; model, translation, file and visual policy
   remain local.
3. **R10: Stripe browser mechanics.** Start with the single-flight script
   loader and narrow mount/dispose behavior in Pool and Store's
   `assets/js/stripe-checkout-sidecar.js`. Characterize both checkout-session
   and PaymentIntent differences. Keep pricing, billing, confirmation,
   validation order and routing in the consumer; use an optional browser entry.
4. **R11: small cart mechanics.** Review versioned storage envelopes, event
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
