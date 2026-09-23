# Native speech and Apple generation

SwiftPM libraries for macOS 15+; Apple generation requires macOS 26+.
Consumers use an immutable `shared/dust-wave-platform` gitlink and a local
SwiftPM dependency on `shared/dust-wave-platform/native`.

| Product | Responsibility |
|---|---|
| `DustWaveSpeechCore` | Stable Parakeet model identifiers and configuration parsing |
| `DustWaveSpeech` | Local Parakeet transcription, tokens/words/confidence, model verification, bounded diarization and progress |
| `DustWaveAppleIntelligence` | Explicit model profiles, fresh sessions, greedy response budgets, cancellation and passive model metadata |

Speech comes from Record's tested shared library, including the optional progress
and exact-speaker-count extensions consumed by Auto Subtitle and Podcast
Visualizer. The original MIT attribution is retained in [LICENSE.Record](LICENSE.Record).
There is no model downloader; explicit local assets and FluidAudio offline mode
remain mandatory. The API preserves existing result field names and error behavior.

Record 0.15.7, CutNotes 0.15.6, and Auto Subtitle/Podcast Visualizer 0.15.5
are the characterized FluidAudio versions. Consumers declare their exact version
and preserve `Package.resolved`; the shared package accepts only that bounded
range. Updating the implementation and upgrading FluidAudio are separate changes.

Apple callers retain their prompts, guided schemas, locale/availability messages,
input bounds, batching, preservation checks, and failure fallback. `transformation`
uses the general model with permissive content transformations; `contentTagging`
preserves the existing classification selection. Neither profile promises semantic
fidelity. The common adapter preserves Apple errors and discards cancelled output.
Metadata is passive and optional on older SDK/OS versions. Apple can update its
model independently, so record OS/model information alongside native evaluations.

## Validation and coordinated adoption

```sh
swift test --package-path native
bash scripts/test-native-version.sh 0.15.5 # also 0.15.6 and 0.15.7
node scripts/check-native-consumers.mjs --root /path/to/checkouts
```

The cohort check requires all four consumer gitlinks and checkout revisions to
match this Platform commit, verifies every declared FluidAudio version and
lockfile, and checks SwiftPM links. It does not fetch, stage, build, release,
read transcripts, or access credentials. A mismatch exits nonzero.

Before adoption, run every consumer's deterministic tests and its fixed synthetic
Apple/Jev suite, keeping prompts, corpus, questions, and judge thresholds frozen.
Compare per-case outputs and failures against the baseline. A successful API call,
passing unit suite, or unchanged pre-existing failure is not a content acceptance
claim. Never send private media or transcripts to Jev.

Advance all consumer gitlinks together on review branches. Each consumer still
owns its build, signing, acceptance, release, and independent rollback. Revert the
gitlink, manifest, lockfile, and adapter changes together; no user-data migration
or shared background service is involved.
