# Site Shell

Dependency-free classic browser primitives shared by Dust Wave products. The
package is intentionally unstyled and does not provide templates, routing,
content, localization, application state, or deployment.

## Browser entries

- `a11y-live-browser` no-ops without its consumer-rendered region, consumes each
  `data-live-announce` value once, and clears unchanged text after one second.
- `header-nav-browser` preserves query and fragment state across language links,
  removes `admin_login` only on an exact localized or unlocalized admin route,
  and manages the characterized accessible mobile-menu behavior. Missing
  navigation controls are no-ops.
- `shipping-option-utils-browser` exposes neutral
  `window.DustWaveShippingOptionUtils` quote-display mechanics.
- `deferred-stylesheets-browser` activates only links marked with
  `data-deferred-stylesheet="true"`.
- `form-control-identity-browser` assigns IDs only to controls without an ID or
  name. The consumer script element supplies a bounded ID prefix and ordered
  dataset keys.
- `cart-icon-browser` renders the consumer-labelled header summary from an
  injected provider global and bounded cache/event names.

## Failure semantics and ownership

Missing optional DOM nodes are no-ops. Control ID prefixes, prioritized dataset
keys, cache keys, provider globals, and event names reject unsafe shapes and
fall back to generic values. Form-control and cart-summary policy is read from
the consumer-rendered script element.

The cart icon receives all visible labels from consumer markup. The shared
scripts do not discover credentials, fetch data, calculate checkout totals,
pricing, tax, or shipping, migrate storage, or mutate provider state beyond
the characterized cart-open request.

Consumers retain markup, labels, localization, script placement, cart/provider
behavior, currency policy, form schemas, routes, breakpoints, styling,
accessibility review, Content Security Policy, and rollout.

## Reference

See the [public exports](package.json), [browser sources](src/),
[behavior tests](test/), and [consumer adoption guide](../../docs/consumer-adoption.md).

## First-frame video posters

`video-first-frame-poster-browser` handles lazy observation (600px margin), a
1.5-second fallback when observers are unavailable, same-origin preview loading,
JPEG canvas capture (maximum width 1280px, quality 0.86), and five-second cleanup.
An explicit poster or ready/pending marker prevents another capture. Media errors,
canvas failures and timeouts clear pending state so a later `init(root)` can retry.
No error is shown to the viewer. The original video and its playback are untouched.

```html
<script src="/shared/dust-wave-platform/packages/site-shell/src/video-first-frame-poster-browser.js"
  data-dustwave-video-posters="true"
  data-poster-global="ExampleVideoPosters"
  data-poster-cache-key="example_first_frame_poster"
  data-poster-url-base="page" defer></script>
```

Mark videos with `data-first-frame-poster`. Call `window.ExampleVideoPosters.init(root)`
after inserting additional markup. The default global is `DustWaveVideoPosters`
and default cache query key is `dustwave_first_frame_poster`; unsafe names fall back.
Load the entry once per document. The `page` URL policy resolves against the page
and requires its origin. Explicit `document-base` resolves against `document.baseURI`
and permits its origin when the page has an opaque origin, as used by sandboxed
previews. Consumers own that preview/base policy, media URLs, CSP and script placement.

The source is `currentSrc` or the first source element. A missing source follows
URL resolution (it may request the page and then fail as media). Cleanup retains
the donors' event behavior; it does not promise cancellation of already queued
media events or a cache of posters across page loads. Generated posters remain
in the page only; this entry uploads nothing and provides no media storage.

## Script loading

`script-loader-browser` exposes `DustWaveScriptLoader.createScriptLoader`. Each
loader shares one pending promise and joins its consumer-marked existing tag.
Consumers supply URL, selector, marker, SDK lookup and error copy. A load error,
missing SDK or insertion error removes the failed tag and permits a fresh retry.
Successful SDKs are reused. No timeout, payment policy or network bypass is added.

## Checkout helpers

`checkout-utils-browser` exposes `DustWaveCheckoutUtils`; `checkout-utils` exports the same implementation for Workers and tests. Email validation requires a dotted domain and at most 254 characters; callers trim input. US ZIP readiness accepts ZIP5 or ZIP+4. Other countries require nonempty postal text and retain consumer validation.

Debounced actions recheck readiness before calling the consumer; they do not retry errors. Latest-check generations discard superseded responses, including A/B/A edits; unavailable lookup results are empty, and canonical submission must still validate. Payment reveal scrolls only the supplied container once per reset and never focuses a field. Consumers reset on navigation and guard readiness callbacks against stale mounts.

These helpers own no Stripe SDK, checkout endpoint, prices, confirmation, cancellation, storage, markup, labels or payment lifecycle. Store takes payment; Pool saves a card for later campaign settlement. Both retain independent adapters and browser acceptance tests.

Checkout helpers own no Stripe SDK calls, markup, timers after disposal, storage,
pricing, endpoints or retry policy. Consumers must clear the debounced action
and reset the latest lookup on navigation; validate canonical requests in the
Worker. Store and Pool retain independent payment adapters and confirmation tests.

### Early SDK initialization

`DustWaveScriptLoader.createInstanceLoader({ load, create })` returns
`prepare(key, options = {})`. It shares the loading/initialization promise for an
exact key and JSON-serialized options, including simultaneous warmup and mount
calls. Consumers provide stable JSON option shapes, the script loader, and the
SDK factory. A load/factory rejection evicts only that entry so a foreground
attempt can retry. Successful instances last for the page lifetime.

Consumers choose when to start (cart/checkout intent), SDK version, public key and
locale. This helper never creates a payment session, mounts fields, reads customer
details, or confirms payment. Pool's deferred Checkout SDK warmup and Store's
PaymentIntent preparation remain consumer policy. Pair the helper with the
existing script loader so a failed script tag is also removed before retry.
