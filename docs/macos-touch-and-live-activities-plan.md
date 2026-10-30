# macOS touch and Live Activities adoption plan

Reviewed October 29, 2026; SDK follow-up and deferral decision October 30.
Status: deferred at the owner's request; no application changes or releases
performed. Scope confirmed with the owner: SwiftUI/AppKit macOS apps only.
No direct-touch test device is currently available.

This plan is retained in the [deferred native macOS roadmap](reuse-review.md#deferred-native-macos-roadmap).
Live Activity implementation, preparatory app changes, the optional menu-bar
fallback and shared extraction are on hold. Touch proposals remain unscheduled.
Revisit native Live Activities when a public SDK and compatible runtime support
them; availability triggers reassessment, not automatic implementation. Resume
only when the owner reprioritizes this work.

If resumed, address the two concrete input gaps in Record and Podcast Visualizer
and prototype Live Activities in Record, then CutNotes, after verifying the SDK.
Share only mechanics demonstrated by those implementations. Keep app workflows,
activity content, controls, and packaging in their consumer repositories.

## Scope and compatibility

| App | Current minimum | Relevant opportunities | Priority |
| --- | --- | --- | --- |
| Record | macOS 15, Apple Silicon | Touch area selection; recording/finalization status with existing controls | First |
| CutNotes | macOS 15, Apple Silicon | Recording and transcription/formatting status; pause, resume, finish | Second Live Activity |
| Podcast Visualizer | macOS 15, Apple Silicon | Touch caret-to-playhead interaction; analysis, alignment and render progress | First touch pass; later Live Activity |
| Auto Subtitle | macOS 15, Apple Silicon | Native control audit; Align/Generate progress and ready-to-save handoff | Later Live Activity |
| MKV Magic | macOS 13, Universal | Native control audit; queue/run/verification progress | Later Live Activity |
| Paper | macOS 13, Apple Silicon | Settings sliders, disclosure controls, menu interaction and overlay pass-through | Touch audit only initially |

The owner confirmed that current OS support must be preserved; add new features
only where available, retaining existing behavior on older supported systems.
Build-tool upgrades and deployment minimums are separate decisions.
Preserve MKV Magic's Intel build and existing release
qualification. Excluded: Tauri/Qt/Python desktop applications, iOS-only apps, web
apps, new AI features, and unrelated release/toolchain migrations.

## What the Apple sessions change

- [Design for touch on Mac](https://developer.apple.com/videos/play/tech-talks/111456/):
  retain desktop layout and keyboard/pointer behavior. Use native controls;
  custom touch targets should reach 36 points without indiscriminately enlarging
  visible controls. Essential hover actions need a touch-accessible route.
  Small native controls can offer expanding touch presentations.
- [Bring Touch to your Mac app](https://developer.apple.com/videos/play/tech-talks/111468/):
  use control events, delegates and gesture recognizers. A touch-only recognizer
  can call the same begin/update/end/cancel logic as existing mouse handling.
  The talk also covers scrolling and gesture exclusivity; these are specialized
  tools, not blanket settings for this portfolio.
- [Bring Live Activities to Mac](https://developer.apple.com/videos/play/tech-talks/111467/):
  Mac apps can publish ongoing activity state through ActivityKit, WidgetKit and
  SwiftUI, with App Intent actions. Design compact, minimal and expanded views;
  support both menu-bar and Dynamic Island presentations. Start, update and end
  the activity with the underlying operation.

The sessions' English captions and published code were reviewed, alongside
Apple's linked documentation. Recommendations below are project-specific design
proposals, not claims that these features already work in our apps.

### SDK evidence: the first Live Activity gate

Local compile checks now cover both installed toolchains:

| Check | Host macOS | Xcode | macOS SDK | Native ActivityKit result |
| --- | --- | --- | --- | --- |
| October 29 | 27.0.1 (`26A434`) | 27.1 (`27A9275`) | 27.0 | `Activity` and `ActivityAttributes` unavailable |
| October 30, after both updates | 27.2 (`26B123`) | 27.2 (`27B52`) | 27.2 | Same errors, including with an explicit `arm64-apple-macos27.2` target |

The 27.2 SDK also marks WidgetKit's `ActivityConfiguration`/`DynamicIsland` and
App Intents' `LiveActivityIntent` unavailable on macOS. `canImport(ActivityKit)`
alone is insufficient. These are SDK declarations, not missing app entitlements.

Apple's [ActivityKit reference](https://developer.apple.com/documentation/activitykit)
still advertises iOS/iPadOS availability in its Markdown metadata and includes
paired-device guidance. The new talk describes native Mac support. This evidence
does not establish the minimum shipping macOS/SDK version for that new support.

The important new evidence is Apple's [Touch on Mac resource page](https://developer.apple.com/touch-on-mac/):
it groups all three talks with **Xcode 27.3 beta**, labeled **Coming soon** on
October 30. This points to the upcoming toolchain as the next candidate; it is
not proof that all announced APIs will be enabled in its first beta or that
macOS 27.2 will provide the required runtime. No exact release date is stated.

Before writing the integration, verify the actual SDK declarations and a signed
Mac widget-extension sample. Record the exact compiler, SDK, runtime, API
availability and distribution support. Use a separately selected toolchain for
the experiment; do not replace a consumer's release toolchain implicitly. If
the APIs remain unavailable, continue the independent touch work and leave the
Live Activity milestones blocked on that explicit dependency.

### Preparation options retained for later

The following options are also on hold; they are not an active implementation
batch or a prerequisite to waiting for the SDK.

Prepare Record's small operation projection and reusable SwiftUI presentation
using its existing state/commands; test timing, action eligibility, identity and
completion without importing ActivityKit. Do not build a new cross-app framework
or speculative ActivityKit wrapper while its Mac contract is unavailable.

If an interim user-facing improvement is wanted, extend Record's existing
`NSStatusItem` and menu rather than adding another status item: recording state,
elapsed time, pause/resume/stop, and transcription state already have an owner in
`Sources/Record/UI/MenuBarController.swift`. A compact status label or small
popover can reuse that data. This is a menu-bar presentation, not a system Live
Activity. An [Apple DTS response](https://developer.apple.com/forums/thread/834361)
also recommends menu-bar extras for this kind of experience; that older guidance
does not establish availability of the newly announced API.

After the work is resumed and Xcode 27.3 beta becomes available, install it
alongside stable Xcode and select it only for the sample. Rerun native ActivityKit and WidgetKit compile
probes, inspect availability annotations, and test a signed widget extension on
the required runtime. If the mismatch persists, use the minimal reproduction to
ask Apple which SDK/runtime supports talk 111467. Do not change SDK interfaces,
use private frameworks, or add invented entitlements to bypass unavailability.
An iPhone companion plus mirrored Live Activity would require another app and
cross-device state delivery; it is outside the confirmed Mac-only scope.

Some touch APIs are already in the installed SDK: control tracking events are
annotated for macOS 11; touch scrolling and view exclusivity additions require
macOS 27. Check each symbol used. Do not infer availability for every API shown
in the talks from one successful import or the major OS version.

## Confirmed code findings

Paths below are relative to each named consumer repository.

| Finding | Existing implementation | Proposed change |
| --- | --- | --- |
| Record's area selector handles only mouse down/drag/up | `Sources/Record/RegionSelectionController.swift`, `RegionSelectionView` | Characterize the existing geometry, then feed mouse and touch into one selection interaction. Add cancellation that clears an unfinished gesture and a visible way to cancel without a keyboard. |
| Record already has common automation commands | `Sources/RecordCore/RecordingControl.swift`; `Sources/Record/Automation/RecordingAppIntents.swift` | Project recording state into the activity and route controls through the same command handler. Pause/resume currently apply only to screen recording; retain that restriction. |
| Podcast Visualizer observes mouse events to position the audio playhead from the text caret | `macos/Sources/PodcastVisualizerApp/Views/TranscriptCaretClickObserver.swift` | Add a direct-touch path that preserves native text editing and the existing stale-text, selection and Unicode checks. |
| Podcast Visualizer already models progress | `macos/Sources/PodcastVisualizerCore/ProgressPresentation.swift`; `Views/OperationProgressView.swift`; `Stores/AppStore.swift` | Reuse phase, fraction, output position and existing estimates. Keep unknown progress indeterminate. |
| CutNotes already has a bounded recording control protocol | `macos/Sources/CutNotesApp/Stores/CutNotesStore.swift`; `docs/CLI_PROTOCOL.md` | Keep Python authoritative. Map activities from acknowledged progress; expose explicit pause/resume intents instead of replaying the UI's toggle method. |
| Auto Subtitle receives structured engine events, but stage is display text | `macos/Sources/AutoSubtitleApp/AppModel.swift`; `macos/Sources/AutoSubtitleCore/JobRequest.swift` | Reuse its decoded events. Start with coarse operation kind/fraction; add a tested stable phase field only if finer states need one. Do not infer activity state by parsing English labels. |
| MKV Magic distinguishes execution, verification and commit | `Sources/MKVMagic/VerifiedOutputProgressWindowController.swift`; `QueueWindowController.swift`; `Sources/MKVMagicCore/JobQueue.swift` | Observe existing execution/queue snapshots. “Pause Automatic Starts” must not be presented as pausing an active encode. |
| Paper already has standard sliders and common commands | `Sources/Paper/WorkflowControls.swift`; `PaperState.swift`; `PaperIntents.swift` | Audit touch and accessibility in Settings. Keep the texture overlays nonactivating and input-transparent. |

Apple's [Sidecar technote](https://developer.apple.com/documentation/technotes/tn3212-adopting-gesture-recognizers-for-sidecar-touch-support)
states that direct touches do not pass through event monitors. Recognizers are
gathered along the hit-tested view's ancestor chain. Therefore, attaching a
recognizer to Podcast Visualizer's current hit-test-transparent observer sibling
would not establish a working fix. Integrate with the actual editor or an
appropriate ancestor, and verify that text selection and scrolling still win
when appropriate.

The audit found no ActivityKit integration in the six apps' searched `Sources`
trees. These are source findings, not results from exercising the apps with touch.

## DRY and KISS implementation boundary

Use this flow within each app:

```text
Existing operation owner -> small activity projection -> ActivityKit -> system UI
App Intent -> existing command handler -> existing operation owner
```

The projection describes an operation; it never runs one. Activity failure,
denial, dismissal or expiry must not cancel recording, kill a subprocess, or
change a saved result. Existing window/menu controls remain usable.

- Consumer-owned: `ActivityAttributes`, content state, labels, view composition,
  operation identity, phase mapping, action eligibility, App Intents, extension
  targets, entitlements, signing and release configuration.
- Reuse existing controls and progress models inside each app before extracting
  anything. Do not create a second timer, recorder, queue, pipeline, subtitle
  engine or process supervisor.
- Implement Record first and CutNotes independently. After both have behavior
  tests, compare lifecycle code. Extract only matching request/update/end,
  serialization or duplicate-update handling that removes meaningful duplication.
  A few simple app-specific calls can remain local.
- If extraction earns its place, propose a small optional product under
  `desktop/` with a focused ADR extending its current scope. Keep existing
  desktop targets' deployment minimum and dependencies unchanged. Do not put
  ActivityKit/UI code in `native/`, Foundation-only `support/`, or Node/Worker
  packages. Do not introduce a universal activity schema or shared app shell.
- Platform extraction requires characterization in every adopting consumer,
  narrow exports and documented errors, an immutable version/pin, independent
  consumer migration and rollback evidence, and compatible branches before any
  breaking change. Do not combine it with FluidAudio or Sparkle upgrades.

### Activity behavior to keep simple

Start with one activity per foreground operation or app queue, not one per
subprocess, output file or internal stage. Initial presentation uses an app icon,
operation label, truthful phase, and measured progress or elapsed time. Omit
filenames, project titles, transcript text and paths. This fits the apps' existing
local-content boundaries and keeps the extension payload small.

Use local updates only. No APNs, server, shared daemon, additional network
entitlement or model changes are required by the proposed workflows. Share only
bounded presentation data if extension packaging requires a shared container;
do not grant the extension access to media or a whole project store.

Serialize updates, discard late events from an old operation, suppress unchanged
content, and coalesce frequent progress notifications. Phase transitions and
terminal states must remain prompt. Prefer a system-rendered timer based on
authoritative elapsed data; freeze it while paused. Keep the current pause/limit
calculation in Record/CutNotes, and measure update cost instead of inventing an
arbitrary global throttle.

Every mutating intent must target the intended operation identity and revalidate
its current state. Double taps and stale controls cannot toggle a newer session.
Record's current intent bridge opens the app and uses an in-process handler;
prove the extension's execution/launch behavior before assuming that handler is
reachable. Start with an open-app action if safe in-place controls are not yet
proven. Do not have the extension launch its own capture or CLI process.

Reconcile owned activities at launch; retire orphaned presentation after a crash.
Respect user dismissal instead of recreating the activity on the next update.
Verify the Mac-specific duration, payload, authorization and background behavior
in the selected SDK; do not silently import iPhone limits as Mac guarantees.
Long jobs must continue correctly if their activity expires.

## Execution sequence

All steps are unscheduled. This sequence applies only after the owner resumes
the work; SDK availability alone does not activate it.

Effort ranges are planning estimates in focused engineering days. They exclude
waiting for an SDK or hardware, unrelated baseline failures and public releases.

| Step | Work and owner | Dependency | Completion evidence | Estimate |
| --- | --- | --- | --- | --- |
| 0 | Consumer maintainers: prove API availability and extension packaging with a disposable minimal Mac sample | Suitable SDK/runtime | Compiling sample, signed/embedded extension, menu-bar activity, working action route; exact environment recorded | 0.5–1.5 |
| 1 | Record: characterize selection; add one touch input adapter to shared selection logic | Current touch-capable SDK; independent of step 0 | Existing mouse behavior preserved; deterministic geometry/cancel tests; direct touch marked pending until a device exists | 1–2 |
| 2 | Podcast Visualizer: repair caret interaction for direct input | Editor integration spike; independent of step 0 | Touch path reaches the same reviewed seek function; typing, selection, scrolling and stale callbacks cannot seek accidentally | 1–2 |
| 3 | Each consumer: native control/input audit | Independent of step 0 after resumption | Small fixes or explicit no-change findings; keyboard/accessibility regression evidence | 1–2 total |
| 4 | Record: first activity for recording through finalization | Step 0 | Compact/minimal/expanded views; supported pause/resume/stop; accurate saving state; dismissal/failure do not affect capture | 2–4 |
| 5 | CutNotes: second activity for Record/Import/Format | Step 0; lessons from step 4 | CLI acknowledgements drive UI; explicit controls; elapsed time excludes pauses; partial/failed formatting stays distinguishable from success | 2–3 |
| 6 | Platform + both consumers: evaluate extraction | Steps 4 and 5 characterized | Either a justified optional package plus before/after tests and rollback, or a recorded decision to keep simple adapters local | 0.5–2 |
| 7 | Podcast Visualizer, Auto Subtitle, MKV Magic: adopt one app at a time | Proven activity approach | Existing progress/state retained; verified completion and cancellation; independent consumer acceptance | 1–3 each |
| 8 | Consumer maintainers: signed app and hardware qualification | Compatible runtime; direct-touch hardware for touch claims | Completed applicable matrix, prior-version update, preserved user artifacts, documented untested conditions | Per app |

After resumption, steps 1–3 can form an independent first batch even if step 0
is blocked. They do not require a portfolio-wide Live Activity release.

### First-batch detail

**Record:** separate selection begin/update/end/cancel mechanics, then add a
direct-touch pan adapter while retaining the characterized mouse path. Test
reverse drags, bounds clipping, negative display origins, backing scale,
cancellation and repeated attempts. Preserve the existing 16-point minimum
selection geometry: a 36-point touch target is not a new minimum capture size.
Do not change ScreenCaptureKit permission routing or capture policy.

**Podcast Visualizer:** use the smallest AppKit bridge needed to distinguish a
deliberate caret placement from text selection/typing. Preserve the current
approximate-seek disclosure, UTF-16/character conversion, immutable cue identity
and stale-text checks. A touch gesture must yield to scrolling and selection;
test long press, drag selection, double tap, keyboard selection and editor reuse.
Keep audio controls available if touch-to-caret integration cannot be made safe.

**All six:** inspect primary buttons, file import/drop zones, context menus,
lists, icon actions and custom hit areas. Test with keyboard and pointer before
changing layout. Use existing native controls and semantic actions; only enlarge
custom touch hit areas where needed, resolving overlaps deterministically. Check
Paper's custom disclosure-label tap handlers for duplicate activation and retain
click-through overlay behavior. There is no measured hit-target defect yet in
the other four apps; audit results should drive changes.

Keep default gesture exclusivity and system gestures initially. No scoped app
currently demonstrates a need for simultaneous multi-slider input or disabling
system gestures. Do not add `NSIsTouchNative` portfolio-wide: Apple's
[key reference](https://developer.apple.com/documentation/bundleresources/information-property-list/nsistouchnative)
primarily targets apps replacing non-AppKit mouse emulation with their own touch
pipeline; most AppKit apps do not need it.

### Later app-specific activity slices

- **Record:** recording indicator and elapsed time first; pause/resume only when
  the existing mode permits them. Stop transitions to saving and ends after
  verified finalization/export. Transcription queues are a separate later slice.
- **CutNotes:** continue through transcription and formatting; finish-recording
  is distinct from cancel. Publish completion only from the final CLI result,
  with a review/open-app handoff for retained warnings or incomplete output.
- **Podcast Visualizer:** analyze/align/render phase, phase fraction, and output
  position. End at a human-review boundary or verified result. Cancel routes
  through `AppStore`; existing immutable outputs and prior stage remain intact.
- **Auto Subtitle:** Align/Generate progress; completion says ready to save
  until the existing save flow succeeds. Open the app for review/save; do not
  attempt file authorization or output selection from the activity.
- **MKV Magic:** aggregate queue count and active execution/verification/commit
  state. Open Queue is the initial action; add cancellation only after operation
  identity and commit-stage policy are characterized. No invented encode pause.
- **Paper:** no persistent Live Activity for an always-on texture. An optional
  snooze countdown can be reconsidered only if it solves a demonstrated need
  beyond the existing menu timer; it is outside the first implementation batch.

## Validation and rollout

1. Establish each affected consumer's baseline before edits. Reuse its existing
   standard test entrypoint and focused state/geometry/progress tests. For a new
   shared package, run Platform `npm test` and `swift test --package-path desktop`.
   Run native/support/Qt suites only if those packages actually change.
2. Add behavior tests for operation identity, duplicate requests, update/end
   races, paused timing, denied activity creation, user dismissal, stale data,
   cancellation, crash/relaunch and failure during verification. Activity errors
   must leave the operation and preserved artifacts unchanged.
3. Test supported older macOS fallbacks and existing CPU architectures. Verify
   old build lanes can exclude unsupported activity source/extension targets;
   runtime `#available` checks cannot make an unavailable SDK declaration compile.
4. Inspect each presentation with VoiceOver, keyboard navigation, Reduce Motion,
   light/dark appearance, long/localized labels, multiple activities and external
   displays. Do not depend on color alone or show fabricated percentages/ETAs.
5. Run real direct-touch acceptance on compatible Sidecar hardware or a touch Mac
   when available: tap, long press, scroll, drag, cancellation, alternating mouse
   and touch, screen changes and interrupted gestures. Pointer automation,
   screenshots and unit tests are not evidence of direct-touch behavior. Current
   status: blocked by unavailable test hardware, not a passing result.
6. Verify signed extension embedding, registration, entitlements, minimum OS,
   nested signatures, notarization, Gatekeeper, launch/quit and updater behavior
   through each app's existing release scripts. Keep current privacy boundaries
   and required consumer checks; this plan does not replace their release gates.
7. Roll out one consumer at a time. Record old/new Platform pins if changed,
   exact test/runtime evidence and untested hardware. Roll back the consumer's
   adapter, extension packaging and dependency pin together. No shared data
   migration should be needed. A pilot build is not a public release.

## Documentation and evidence reviewed

Platform baseline: `db792448510d93827a01a24c5c950c276c903128` (workspace 0.46.0).
Consumer source snapshots: Record `6b8430a`, CutNotes `7ff307e`, Auto Subtitle
`b7b345b`, Podcast Visualizer `18194e9`, Paper `8713988`, MKV Magic `73d0fb9`.
These identify inspected local source, not installed or released versions.
Paper had unrelated untracked duplicate documentation; it was left untouched.

- Platform: root README/AGENTS, documentation index, capability and reuse guides,
  consumer/desktop adoption, ADRs 0001/0004/0005, native/desktop/support/Qt package
  references, development guide, manifests and relevant changelog entries.
- Consumers: root guides and available AGENTS, architecture/CLI contracts,
  relevant macOS 27 readiness documents, current state/control/progress/input
  source and existing test entrypoints. Older readiness records were treated as
  dated evidence, not current release certification.
- Apple: all three linked talks' captions/code, ActivityKit documentation,
  Sidecar technote, `NSIsTouchNative` reference, and local SDK declarations.

The Platform development guide still says Node 20.9+, while AGENTS, the root
README and manifest require patched supported Node 22/24/26 lines. Follow the
current manifest/AGENTS floor; the local Node used for this plan is 26.12.1.
That documentation discrepancy is unrelated to the app implementation scope.

Remaining execution gates: qualify the SDK/runtime for native Mac Live Activities
and arrange direct-touch hardware before claiming touch acceptance. Scope and
preservation of current OS support are confirmed. The roadmap is retained for
future reprioritization; no implementation is currently scheduled.
