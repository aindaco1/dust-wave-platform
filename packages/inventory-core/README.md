# `@dustwave/inventory-core`

Pure inventory state mechanics for consumer inventory coordinators.

## Behavior and ownership

`@dustwave/inventory-core` contains the pure state overlap below the Pool and
Store inventory coordinators: JSON-safe cloning, count-map normalization,
legacy and expiring reservation normalization, reserved-count totals, and
bootstrap reconciliation. Consumers must inject a positive default reservation
TTL and choose `replace` or `merge` bootstrap behavior. Pool uses `replace` so
its persisted campaign snapshot remains authoritative; Store uses `merge` so
current catalog metadata can refresh without losing claimed counts. The package
does not perform Durable Object transactions, KV writes, catalog reads,
checkout or order/pledge transitions, timers, routes, or deployment.

## Failure semantics

Invalid default TTL or bootstrap strategy throws `TypeError`; the strategy
defaults to `replace`. Count normalization omits non-finite or negative values
and floors valid counts. JSON cloning errors propagate for unsupported input.

## Reference

See the [public exports](package.json), [source contracts](src/), and
[behavior tests](test/). Follow the shared
[consumer adoption guide](../../docs/consumer-adoption.md) when updating a pin.
