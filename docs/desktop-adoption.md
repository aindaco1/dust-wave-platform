# Desktop update and diagnostics adoption

This migration preserves product behavior and shares existing mechanics.
The separately scoped Swift package supports macOS 13+ without speech or AI
dependencies. Framework-neutral JavaScript entries support Tauri consumers and
the existing reviewed-report relay. No universal app UI or report schema is
introduced.

| Consumer | Shared surface | Retained local policy |
| --- | --- | --- |
| Paper | Swift updates and reviewed reports | Explicit launch call, settings opt-out, exact preview, pending report |
| Record | Swift updater and pure launch policy | One launch check, local-only main-app sandbox |
| CutNotes | Swift updater, transport and receipts | Launch check, batching, legacy receipts and local failure messages |
| Auto Subtitle | Swift updater/policy and JS reviewed sender | Busy deferral, local report contract, explicit Node submission |
| Podcast Visualizer | Swift updater, transport and receipts | Launch check, reviewed batch, retry retention |
| MKV Magic | Swift updater, transport and receipts | Manual checks, isolated reporting XPC, main-app network prohibition |
| ASCII VJ Remix | Tauri progress/manifest and relay mechanics | Launch/manual UI, Rust report collection, fixed schemas/routes and deployment |
| Social | Tauri progress/manifest | Vue UI, Rust version recheck and restart, local health/export |

Grainery remains excluded. The 0.42 expansion adds Road Notice's diagnostics
through `support/` (no updater change) and OwlSwitch through `qt/`. OwlSwitch's
consumer-owned relay adopts its historical issue markers/counts through an
optional initialization adapter and durable serialization. Existing shared
relay routes and their defaults remain compatible.

Desktop Swift 0.3.0 re-exports `DustWaveSupport` without changing existing
imports. Consumers advancing their pin must include the sibling `support/`
directory in source archives. Road Notice uses `platform-support.json` and
passes that filename to the same pin checker; OwlSwitch records `qtVersion`
and exact JS versions in `platform-desktop.json`.

Consumers retain exact Sparkle declarations and Swift lockfile revisions:
2.9.5, 2.9.6 or 2.10.0. The shared package accepts only that bounded range.
Do not combine extraction with a Sparkle upgrade. Feed/key values, app bundle
identities, signing, entitlements, installation consent and releases stay local.

The relay retains its routes, class names, bindings, storage keys, migrations,
fingerprints, receipts and operator controls. Its adapters supply product
formatting and GitHub authentication. There is no new service or data migration.

The preceding paragraph describes the original shared ASCII relay. OwlSwitch's
separate relay adds per-ID and per-fingerprint Durable Objects while retaining
its endpoint, sanitization, rate-limit KV and historical issue index. After
deployment, roll back app pins independently; retain the new durable namespaces
when rolling back worker code so receipt history is not deleted.

## Migration and rollback

1. Run the existing behavior tests at the old consumer commit.
2. Advance its immutable Platform gitlink, exact package-version assertions,
   adapters and lockfiles together. CI and source archives must include the
   pinned submodule; packaged Node clients include only needed runtime files.
3. Run shared tests, consumer characterization, build and package gates.
   Record the old/new source pins and actual outcomes in the consumer PR.
4. Revert that consumer's migration commit to restore its prior gitlink,
   adapters, manifests and locks. No other consumer changes, deletion of
   Durable Object namespaces, or user-data migration is required.

Each migrated repository records its immutable commit, package versions and
retained Sparkle revision in `platform-desktop.json`. Run
`node shared/dust-wave-platform/scripts/check-desktop-consumer.mjs` from the
consumer root. The check verifies both the staged gitlink and initialized
checkout; it never fetches or updates dependencies.

Source tests, hosted CI, signed artifacts, installed updater acceptance and
deployed GitHub delivery are distinct evidence. This guide specifies the
migration contract; consumer PRs record its verification.
