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

- `createMediaRemovalControl({ label, className, hasSelection, clearSelection, document })`
  returns a native `button` plus `refresh()`, `changed()`, `beginUpload()`, and
  `isCurrentUpload(ticket)`. The button is disabled for an empty field; a pending
  upload enables removal. Removing, changing the value, or starting another upload
  invalidates earlier tickets. Apply a result only when its ticket is current,
  then call `changed()`. On a failed upload, call `changed()` after restoring the
  consumer preview. Use `hasSelection` to include staged replacements and
  `clearSelection` to clear the reference and revoke pending previews while keeping
  captions/alt text. The callback can record undo history, rerender, restore focus,
  and announce the result. No storage, upload endpoint, asset deletion, translation,
  CSS, or product content is owned by the control. Missing callbacks/label throw.
  Available in Admin Shell 0.13.0 through both module and classic browser entries.
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

## Async targets and draft recovery

`editor-media.captureMediaTarget` retains item/target identity before asynchronous
work. Its `index()` resolves the current position and returns -1 when detached,
removed, replaced, canceled or no longer a nested member. Consumers inject list,
attachment, membership and ticket checks and retain all domain mutation policy.

`draft-recovery` and `draft-recovery-browser` expose `recoverDraftBaseline`.
Revision and snapshot are opaque paired values. Unpublished stale edits preserve
the original pair and conflict flag; only a consumer-confirmed legacy match can
upgrade that baseline. Storage, parsing, draft content and publish authority stay
in the consumer. Pool is the initial characterized caller of this pure decision.

## Block editor

`block-editor` and `block-editor-browser` expose the same implementation. The
classic entry installs `DustWaveAdminShellBlockEditor`; load it before dashboard
code. `createBlockModel` owns the eight established block shapes, normalization,
gallery options and provider choices. `createBlockEditor(root, options)` owns
block composition, toolbar DOM, insert/reorder/delete/type/alignment commands,
slash splitting, selection format detection and event routing. Existing
`editor-codec` and `editor-media` remain the owners of rich text and upload races.

The adapter supplies `getBlocks`, `setBlocks`, `renderBody` and optionally
`onRender`, `beforeMutation`, `onMutation` and localized `t(key, fallback)` copy.
`renderBody` retains consumer media fields, URL validation, previews and upload
controls. Store's Markdown projection and Pool's paired draft/revision baseline,
undo history, diary context and email restrictions remain in their adapters.
The composer never copies blocks when rendering or reordering: asynchronous media
operations continue to resolve the captured object through `editor-media`.

```js
import { createBlockEditor, createBlockModel } from '@dustwave/admin-shell/block-editor';
const editor = createBlockEditor(root, {
  model: createBlockModel(),
  getBlocks: () => blocks,
  setBlocks: value => { blocks = value; },
  renderBody, // consumer's editable fields and media controls
  onRender: () => syncDraftFields(blocks)
});
editor.bind({ actions: formattingAndMediaActions, input: updateAuthoredField });
editor.render();
// editor.destroy() removes listeners; bind() also removes any previous binding.
```

`bind` routes block commands, format/media actions and keyboard Enter, with
consumer hooks for focus, pointer, clipboard, undo and field updates. `run`
wraps handlers for consumers with multiple editing contexts. `beforeClick` and
`beforeKey` may return `false` to stop dispatch. `outside` is called outside
that context wrapper so adapters can close the specified root without changing
an unrelated active draft. Binding does not publish or persist anything.

Invalid constructor arguments throw `TypeError`; callback exceptions propagate.
Invalid JSON throws by default; `invalidJson: 'empty'` preserves Store's tolerant
import contract. Unknown block/provider/alignment values use established text,
YouTube and left defaults. Model type/provider getters are evaluated on use so
email editors can restrict their palette. Decorative-image coercion and alt
clearing are explicit model policies; gallery images keep the existing strict
boolean contract. Invalid movement and attempts to delete the last block return
`false`. Each consumer can roll back its gitlink and adapter together.

## Guided provider setup (0.16.0)

Import the two HTML renderers from `@dustwave/admin-shell/provider-setup`.
They work without JavaScript and accept plain text for status, title, description,
and the primary button label. The consumer supplies authenticated, root-relative
POST routes and can include its CSRF token in the hidden `csrf` field. Omit an
action to show the guide without accepting submissions.

```js
import { renderR2Card, renderStripeCard } from "@dustwave/admin-shell/provider-setup";

const stripe = renderStripeCard({
  status: account.statusLabel,
  description: account.nextStep,
  action: routes.startStripe,
  checkAction: routes.refreshStripe,
  csrfToken,
  existingOAuth: policy.canConnectExistingAccount,
  resume: account.onboardingStarted,
  ready: account.ready
});
const r2 = renderR2Card({
  status: storage.statusLabel,
  action: routes.connectStorage,
  csrfToken,
  values: { accountId: storage.accountId, bucket: storage.bucket, jurisdiction: storage.jurisdiction },
  connected: storage.connected
});
```

**Stripe.** The start form submits `mode=new` or `mode=reuse`. Enable
`existingOAuth` only for an integration eligible to connect an existing Stripe
account. Its second button then submits `mode=existing`. With `resume`, the
only start mode is `resume`. With `ready`, only an enabled status-check action
is shown. The separate check form posts no mode. The consumer authenticates
each request, issues fresh hosted links or starts OAuth, reconciles provider
events, and assesses readiness for its required payment and payout capabilities.
Show test-mode and outstanding requirements in the status and description.
Determine the status from Stripe’s account data after a return.
[Hosted onboarding](https://docs.stripe.com/connect/hosted-onboarding) and
[reusing business details](https://docs.stripe.com/connect/networked-onboarding).

**Cloudflare R2.** The connection form submits `accountId`, `bucket`,
`jurisdiction` (`default`, `eu`, `us`, or `fedramp`), `accessKeyId`,
`secretAccessKey`, and an explicit `privateConfirmed=yes`. Credentials are
entered fresh. The optional `connected` flag collapses the replacement form.
The operator attests to the bucket and key settings. An authenticated read
proves the key can read the object. The operator or a management API with
independent permissions must establish the bucket’s public settings and the
scope of that key. The consumer validates payloads and CSRF, protects secrets
at rest and in logs, and records the result of its connection test.
[Token permissions and jurisdictions](https://developers.cloudflare.com/r2/api/tokens/)
and [public bucket settings](https://developers.cloudflare.com/r2/buckets/public-buckets/).

A missing status, invalid rendered action, or unknown displayed jurisdiction
throws a `TypeError`. Actions accept literal root-relative route paths. The
consumer owns the surrounding document, styling, links to product support, and
submission error messages. Add `form-action 'self'; base-uri 'none'` to the
page’s Content Security Policy when its other forms permit it. Style
`.provider-card`, `.provider-card--stripe`, `.provider-card--r2`,
`.provider-status`, `.provider-guide`, and `.provider-form` in the app.
