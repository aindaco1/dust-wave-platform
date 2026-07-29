# Dust Wave Platform

Versioned, framework-neutral primitives shared by [Dust Wave](https://dustwave.xyz), [The Pool](https://github.com/aindaco1/pool), [Store](https://github.com/aindaco1/store), and the first-party podcast platform.

This is intentionally a small monorepo, not a shared application runtime. Pool, Store, the Dust Wave site, and Podcast retain separate deployments, data, sessions, secrets, and business rules.

## Packages

| Package | Purpose | Status |
|---|---|---|
| `@dustwave/worker-core` | Runtime-neutral Worker security, byte/string checksums, signed-identity, Stripe, podcast-benefit code, and request primitives | `0.3.1`; exact and policy-injected duplicate extraction |
| `@dustwave/admin-shell` | Credentialed admin API/download clients, passwordless session coordinator, accessible and responsive tab and Turnstile controls, Pool-characterized rich-text codecs, unsaved-change lifecycle protection, and shared tagged-link/QR/share-card assets | `0.8.0`; consumers now share fail-closed browser-exit and injected in-app transition guards while retaining their own dirty-state and localized confirmation policies |
| `@dustwave/tax-core` | Store-characterized destination normalization and deterministic integer-cent manual-rate calculation | `0.1.0`; provider lookup and product taxability remain consumer-owned |
| `@dustwave/media-core` | Runtime-neutral source-audio QC policy, signed processor manifest, normalized measurements, finding, and report contracts | `0.1.0`; processing placement, storage, approval, and publication remain consumer-owned |
| `@dustwave/timed-text` | Bounded English/Spanish provider-segment normalization, deterministic transcript/chunk projection, and alignment-runner evidence contracts | `0.3.0`; provider calls, storage, review, speaker identity, benchmark approval, and publication remain consumer-owned |

Planned packages are added only when consumer characterization tests prove a
stable boundary: player controls and alignment job contracts. The first media
contract is intentionally limited to deterministic source-audio QC structures
shared by the Podcast Worker and its owner-controlled FFmpeg processor.
The first timed-text contract accepts only bounded monotonic provider segments,
normalizes generated text as untrusted plain text, and never manufactures word
timing or speaker identity. Its large-source extension deterministically chooses
safe silence boundaries (or duration fallbacks), binds processor manifests to
immutable source/output evidence, and merges source-relative segment timing with
conservative overlap removal. It still never manufactures word timing or
speaker identity. The alignment extension deterministically projects reviewed
cues to stable lexical word IDs and verifies exact runner identity, canonical
result digests, explained omissions, cue/source timing, provenance, and
resource evidence. It validates candidate evidence but cannot declare an
adapter launch-ready; Podcast retains the bilingual human benchmark gate.

## Consumer model

Each consumer pins this repository as `shared/dust-wave-platform` and imports an exact package version. Submodule pointers are updated independently on consumer release branches. A consumer must never import another consumer's application code or storage.

## Development

```bash
npm install
npm run check
```

The check runs the shared unit suite, the locked dependency audit, and a
high-confidence scan of tracked text files, including the current prefixed
Cloudflare global-key, user-token, and account-token formats. Findings report
only the file, line, and credential type; suspected secret values are never
echoed. No secrets are required for the shared checks.

Consumers with local `.dev.vars` files may inject those paths and their
test-only allowlist through `runSecretAudit`. The same primitive then verifies
ignore/tracking posture and searches exact local values in the worktree and
history without returning or partially masking the values. Consumer-specific
secret filenames and fixture policy remain in thin local adapters.

`@dustwave/admin-shell` is intentionally unstyled. Each product retains its
templates, visual system, localization, roles, routes, and state. Its editor
codec is derived from the Pool behavior that preserves emphasis boundary spaces
and sanitizes rich pasted content. Podcast consumes the new package first;
Pool and Store keep their domain-specific URL and dashboard adapters. The shared
responsive-tab control mirrors the accessible tab controller into a labeled
native select without owning consumer breakpoints, labels, or CSS. Its
`tabs-browser` entry is a namespaced, dependency-free classic-script bridge for
Pool and Store; the module entry uses that same implementation, so dynamic tab
visibility and option rebuilding stay behavior-equivalent without a second
runtime copy. The Turnstile browser entry follows the same bridge pattern and
owns only the provider-documented responsive size choice: a consumer with at
least 300 CSS pixels uses the flexible widget, while a narrower or unmeasurable
container fails small to the compact widget. Consumers still own script
loading, site keys, actions, callbacks, tokens, server-side validation, and
visual styling. The shared
marketing asset module owns only normalization, canonical tagged-URL assembly,
QR matrix rendering, bounded escaped social-card SVG composition, and the
byte-derived MIT QR engine. Consumers supply trusted product text and an
already-bounded image data URL, then choose their own rasterizer, storage, and
publication policy; email audiences, attribution storage, and send authority
remain consumer-owned.

The unsaved-change module is the characterized lifecycle overlap between Pool,
Store, and Podcast. Its module and dependency-free classic-script entries block
browser exit only while a consumer callback reports dirty state and expose an
injected confirmation boundary for in-app transitions. Adapter failures fail
closed. Consumers still own editor baselines, localized messages, discard side
effects, and which transitions require confirmation.

The credentialed-download module is the characterized overlap between Pool,
Store, and Podcast accountant/report exports. It always uses credentialed GET,
accepts only caller-allowlisted content types, bounds declared and streamed
bytes, retains only bounded structured JSON errors, rejects path-shaped
filenames, and revokes its temporary object URL. Consumers still own the API
origin, session cookie, authorization, response schema, export columns,
fallback filename, UI messages, and audit policy.
