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
