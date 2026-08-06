# Site Shell

Dependency-free classic browser primitives shared by Dust Wave products. The
package is intentionally unstyled and does not provide templates, routing,
content, localization, application state, or deployment.

## Browser entries

- `a11y-live-browser` consumes marked announcements once and clears unchanged
  live-region text after one second.
- `header-nav-browser` preserves safe language-switch state and manages the
  characterized accessible mobile-menu behavior.
- `shipping-option-utils-browser` exposes neutral
  `window.DustWaveShippingOptionUtils` quote-display mechanics.
- `deferred-stylesheets-browser` activates only links marked with
  `data-deferred-stylesheet="true"`.
- `form-control-identity-browser` assigns IDs only to nameless controls. The
  consumer script element supplies a bounded ID prefix and ordered dataset keys.
- `cart-icon-browser` renders the consumer-labelled header summary from an
  injected provider global and bounded cache/event names.

## Failure semantics

Missing optional DOM nodes are no-ops. Invalid policy strings fall back to
generic safe values. Provider, storage, and event identities are consumer
policy; the shared scripts do not discover credentials, fetch data, calculate
checkout totals, or mutate provider state beyond the characterized cart-open
request.
