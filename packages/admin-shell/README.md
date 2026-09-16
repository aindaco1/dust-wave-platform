# `@dustwave/admin-shell`

`@dustwave/admin-shell` is intentionally unstyled. Each product retains its
templates, visual system, localization, roles, routes, and state. Its editor
codec is derived from the Pool behavior that preserves emphasis boundary spaces
and sanitizes rich pasted content. The codec was introduced for Podcast;
Pool and Store retain their domain-specific URL and dashboard adapters.

The package also exposes a [passwordless session coordinator](src/passwordless-session.js)
and [confirmation-dialog controls](src/confirmation-dialog.js) for consumer UI adapters.

## Tabs and Turnstile

The shared responsive-tab control mirrors the accessible tab controller into
a labeled native select without owning consumer breakpoints, labels, or CSS. Its
`tabs-browser` entry is a namespaced, dependency-free classic-script bridge for
Pool and Store; the module entry uses that same implementation, so dynamic tab
visibility and option rebuilding stay behavior-equivalent without a second
runtime copy. The Turnstile browser entry follows the same bridge pattern and
owns only the provider-documented responsive size choice: a consumer with at
least 300 CSS pixels uses the flexible widget, while a narrower or unmeasurable
container fails small to the compact widget. Consumers still own script
loading, site keys, actions, callbacks, tokens, server-side validation, and
visual styling.

## Marketing assets

The shared marketing asset module owns only normalization, canonical tagged-URL
assembly, QR matrix rendering, bounded escaped social-card SVG composition, and the
byte-derived MIT QR engine. Consumers supply trusted product text and an
already-bounded image data URL, then choose their own rasterizer, storage, and
publication policy; email audiences, attribution storage, and send authority
remain consumer-owned.

## Workflow progress

The workflow-progress entry defaults to ordered progress navigation with
`aria-current="step"`. `selectionMode: "tabs"` opts into a horizontal,
automatically activated ARIA tablist: Left and Right wrap across enabled tabs,
while Home and End select the first and last enabled tabs. Consumers may supply
each step's `controls` ID and remain responsible for the corresponding tabpanel,
visibility, and focus policy. Disabled tabs are skipped and cannot be selected;
`setActive` returns `false` for a missing ID or a disabled tab, an invalid root
throws `TypeError`, and consumer callback failures propagate to the caller.

## API client

The API client preserves credentialed admin requests as its default. A
consumer that calls an explicitly public cross-origin API may inject
`credentials: "omit"` at construction; invalid Fetch credential policies fail
before any request. The consumer still owns CORS, authentication, CSRF,
Turnstile, route, and response-schema policy.

## Unsaved changes

The unsaved-change module is the characterized lifecycle overlap between Pool,
Store, and Podcast. Its module and dependency-free classic-script entries block
browser exit only while a consumer callback reports dirty state and expose an
injected confirmation boundary for in-app transitions. Adapter failures fail
closed. Consumers still own editor baselines, localized messages, discard side
effects, and which transitions require confirmation.

## Dirty controls

The dirty-controls module is the exact button-state overlap characterized in
Pool and Store and used by Podcast review drafts. Its module and
dependency-free classic-script entries apply the `is-dirty` class,
`data-dirty-state`, consumer-provided clean/dirty text, and the established
disable-when-clean behavior. Consumers still own how changes are detected,
localized labels, force-disabled policy, and the focus-ring styling.

## Credentialed downloads

The credentialed-download module is the characterized overlap between Pool,
Store, and Podcast accountant/report exports. It always uses credentialed GET,
accepts only caller-allowlisted content types, bounds declared and streamed
bytes, retains only bounded structured JSON errors, rejects path-shaped
filenames, and revokes its temporary object URL. Consumers still own the API
origin, session cookie, authorization, response schema, export columns,
fallback filename, UI messages, and audit policy.

## Reference

The `api-client`, `tabs`, `dirty-controls`, `unsaved-changes` and `turnstile`
entries publish TypeScript declarations alongside their existing JavaScript.
Consumers can remove ambient module copies for these entries. API responses
remain `unknown` until narrowed by the consumer; no schema or response shape is
implied by the declaration. The compile fixture exercises package resolution
and rejected input/response assumptions; existing runtime behavior tests remain
authoritative.

See the [public exports](package.json), [source contracts](src/), and
[behavior tests](test/). Follow the shared
[consumer adoption guide](../../docs/consumer-adoption.md) when updating a pin.


## Editor rendering, media, and feedback (0.12.0)

`editor-codec` and the classic `editor-codec-browser` entry use one implementation
(`DustWaveAdminShellEditorCodec`). Nested bold/italic spans render and round-trip
through the editor. Existing rich-text and timed-text policies remain available.
Optional `isSafeHref`, `onUnsafeHref`, `discardUnsafeLinks`, and `externalLinks`
let a Worker adapter retain its URL rules and report unsafe links without
changing the browser policy. HTML sanitization and storage remain the consumer's
responsibility; the renderer accepts only its existing inline formatting tags.

`editor-media` / `editor-media-browser` expose `DustWaveAdminShellEditorMedia`:

- `createImagePreviewCache()` maps canonical uploaded paths to tab-local object
  URLs. `remember(path, File)` rejects missing paths/non-images, revokes a replaced
  URL, and returns its preview record. `clear()` revokes every URL; call on logout
  or teardown. Never serialize object URLs into saved content.
- `imageThumbnail(record, options)` caches a bounded WebP data thumbnail on the
  record. The default maximum edge is 960 pixels; decode/canvas failures return
  an empty string. Invalid size options throw. Consumers inject DOM APIs in tests.
- `applyPreviewMedia(sanitizedHtml, replacements, options)` replaces mapped media
  with image thumbnails inside opaque sandbox previews. Failed or non-image local
  media receives consumer-supplied placeholder text. It does not sanitize arbitrary
  HTML or weaken an iframe's sandbox. Original server content stays unchanged.
- `isEmptyTextBlock(block, options)` recognizes only blank text placeholders with
  allowed keys. Unknown fields, raw HTML, and other content types remain subject
  to consumer validation.
- `normalizeImageAccessibility(image, options)` preserves explicit decorative
  state and returns cleaned alt text plus advisory `normalized`/`recommended`
  notices. Missing descriptions never produce a save/publish error. Consumers
  supply their text cleaner, length limit, and validation policy.

`feedback` / `feedback-browser` expose `DustWaveAdminShellFeedback`. `message`
provides English/Spanish defaults, regional locale fallback, interpolation, and
an optional translation callback. `formatIssue` recognizes common validation
reasons; callers supply localized field names and domain context. Unknown reasons
return an empty string. `createRequestError` uses the consumer's `resolveIssue`
adapter and safe localized request/status fallbacks instead of displaying raw
provider diagnostics. It retains the original response in `error.rawData`, a
localized display copy in `error.data`, and `error.status`. Do not log private
response data without the consumer's redaction policy. These helpers never send
requests, choose authorization, or change backend validation outcomes.

Pool characterizes its browser editor, Worker preview, before/after-save media
previews, validation, and responsive layout independently. Other consumers adopt
these additive entries through their own pinned upgrades.
