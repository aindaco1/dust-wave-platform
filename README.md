# Dust Wave Platform

Versioned, framework-neutral primitives shared by [Dust Wave](https://dustwave.xyz), [The Pool](https://github.com/aindaco1/pool), [Store](https://github.com/aindaco1/store), and the first-party podcast platform.

This is intentionally a small monorepo, not a shared application runtime. Pool, Store, the Dust Wave site, and Podcast retain separate deployments, data, sessions, secrets, and business rules.

## Packages

| Package | Purpose | Status |
|---|---|---|
| `@dustwave/worker-core` | Runtime-neutral Worker security, byte/string checksums, signed-identity, Stripe, timezone, podcast-benefit code, and request primitives | `0.4.0`; timezone support is the exact Pool/Store runtime overlap |
| `@dustwave/admin-shell` | Policy-bound admin/public API and credentialed-download clients, passwordless session coordinator, accessible responsive tabs, Turnstile, workflow-progress and confirmation-dialog controls, Pool-characterized rich-text codecs, unsaved-change lifecycle protection, dirty-action state, and shared tagged-link/QR/share-card assets | `0.10.2`; workflow progress supports opt-in accessible section tabs with resilient roving focus |
| `@dustwave/tax-core` | Store-characterized destination normalization, deterministic integer-cent manual-rate calculation, and the Pool/Store New Mexico starter reference | `0.2.0`; live provider choice and product taxability remain consumer-owned |
| `@dustwave/site-shell` | Dependency-free classic browser scripts for the exact Pool/Store header-navigation and live-announcement behavior | `0.1.0`; templates, localization, routes, styling, and breakpoints remain consumer-owned |
| `@dustwave/build-core` | Generated CSS/JavaScript asset minification shared exactly by Pool and Store | `0.1.0`; source assets, HTML, vendor files, and deployment remain consumer-owned |
| `@dustwave/media-core` | Runtime-neutral source-audio QC policy, signed processor manifest, normalized measurements, finding, and report contracts | `0.3.0`; processing placement, storage, approval, and publication remain consumer-owned |
| `@dustwave/timed-text` | Bounded English/Spanish provider-segment normalization, deterministic transcript/chunk projection, and alignment-runner evidence contracts | `0.5.0`; provider calls, storage, review, speaker identity, benchmark approval, and publication remain consumer-owned |

Packages are added only when consumer characterization tests prove a stable
boundary. The first media
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

`@dustwave/site-shell` contains unstyled classic scripts and intentionally
exports no application shell. Header navigation preserves query and fragment
state across language links, removes `admin_login` only on an exact localized
or unlocalized admin route, and no-ops when navigation controls are absent.
The live announcer no-ops without its consumer-rendered region, consumes each
`data-live-announce` value once, and clears unchanged text after one second.
Consumers retain markup, labels, localization, focus styling, routes, and
Content Security Policy.

`@dustwave/build-core` processes only generated CSS and JavaScript below a
site's `assets` directory. It skips source files, maps, vendor code, and HTML;
it writes only when output is smaller. A missing generated asset directory is
an explicit error, and check mode exits unsuccessfully when a generated file
can still be reduced. Consumers retain build orchestration, budgets, and
deployment authority.

The Worker timezone entry exposes only runtime-supported IANA zone discovery,
labels, validation, and deterministic fallback. Unsupported values fall back
to a caller-supplied supported zone or `America/Denver`; date boundaries and
domain scheduling remain consumer-owned.

The New Mexico GRT starter entry is a vendored public reference snapshot. Its
updater requires an explicit consumer-owned output path, fetches every seed
successfully before writing, and propagates network or response failures. It
does not select a checkout provider or declare a rate authoritative; each
consumer retains provider configuration, refresh review, taxability, fallback,
and release policy.

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

The workflow-progress entry defaults to ordered progress navigation with
`aria-current="step"`. `selectionMode: "tabs"` opts into a horizontal,
automatically activated ARIA tablist: Left and Right wrap across enabled tabs,
while Home and End select the first and last enabled tabs. Consumers may supply
each step's `controls` ID and remain responsible for the corresponding tabpanel,
visibility, and focus policy. Disabled tabs are skipped and cannot be selected;
`setActive` returns `false` for a missing ID or a disabled tab, an invalid root
throws `TypeError`, and consumer callback failures propagate to the caller.

The API client preserves credentialed admin requests as its default. A
consumer that calls an explicitly public cross-origin API may inject
`credentials: "omit"` at construction; invalid Fetch credential policies fail
before any request. The consumer still owns CORS, authentication, CSRF,
Turnstile, route, and response-schema policy.

The unsaved-change module is the characterized lifecycle overlap between Pool,
Store, and Podcast. Its module and dependency-free classic-script entries block
browser exit only while a consumer callback reports dirty state and expose an
injected confirmation boundary for in-app transitions. Adapter failures fail
closed. Consumers still own editor baselines, localized messages, discard side
effects, and which transitions require confirmation.

The dirty-controls module is the exact button-state overlap characterized in
Pool and Store and now used by Podcast review drafts. Its module and
dependency-free classic-script entries apply the `is-dirty` class,
`data-dirty-state`, consumer-provided clean/dirty text, and the established
disable-when-clean behavior. Consumers still own how changes are detected,
localized labels, force-disabled policy, and the focus-ring styling.

The credentialed-download module is the characterized overlap between Pool,
Store, and Podcast accountant/report exports. It always uses credentialed GET,
accepts only caller-allowlisted content types, bounds declared and streamed
bytes, retains only bounded structured JSON errors, rejects path-shaped
filenames, and revokes its temporary object URL. Consumers still own the API
origin, session cookie, authorization, response schema, export columns,
fallback filename, UI messages, and audit policy.
