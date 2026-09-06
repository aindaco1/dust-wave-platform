# `@dustwave/shipping-core`

Deterministic physical-shipping mechanics and bounded USPS transport.

## Behavior and ownership

`@dustwave/shipping-core` contains the exact deterministic Pool/Store overlap
for physical shipping profiles, mixed tier/support-item/add-on aggregation,
missing-metadata fallback summaries, the characterized USPS First-Class flat
table, fallback/free quote shapes, and standard/signature option selection.
Consumers inject origin country, fallback cents, free-shipping state, and
configured option IDs. Selection and catalog arrays are bounded before loops.
The USPS entry accepts consumer-resolved configuration, owns a bounded
in-memory token/quote/cache-backoff lifecycle, aborts provider timeouts, and
refreshes once after a 401. Provider credentials never appear in result/error
shapes. The canonical shipping-country YAML is copied to framework-owned
consumer data only through an explicit-output check/write command, keeping
Jekyll integration outside the runtime package. Platform still owns no address
eligibility, catalog, fallback/free rate, checkout mutation, fulfillment,
storage, carrier account, or deployment; Store retains product rules and Pool
retains campaign rules through thin, independently reversible adapters.

See the [country sync command](bin/sync-shipping-countries.mjs) for the explicit
consumer-output check/write interface.

## Reference

See the [public exports](package.json), [source contracts](src/), and
[behavior tests](test/). Follow the shared
[consumer adoption guide](../../docs/consumer-adoption.md) when updating a pin.
