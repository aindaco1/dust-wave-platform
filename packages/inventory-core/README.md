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

## Verify reservation expiry

Run `npm run verify:inventory-expiry` from the repository root with Java 11+
and a supported Node version. The command downloads and checksum-verifies
the TLA+ v1.7.4 tools. To run offline, set `TLA2TOOLS_JAR` to that release's
local `tla2tools.jar`. CI runs the same command on pull requests and on main.

The [model](verification/ReservationExpiry.tla) checks that at every clock tick
the holds still present are exactly those with a future deadline. Two holds
of two and three units share one item. Each can be absent or expire at one of
three ticks. TLC explores all 80 states, including simultaneous expiry and
one live hold alongside an expired one. For every state, the checker compares
TLC's total with `normalizeState` followed by `getReservedCounts` using both
Store's merge policy and Pool's replace policy (600-second defaults). Each
tick is one millisecond in JavaScript.

This verifies the shared calculation for persisted holds with explicit, valid
deadlines. Legacy expiry defaults have separate [unit tests](test/inventory-state.test.js).
The consumer suites cover routing and persistence.

## Reference

See the [public exports](package.json), [source contracts](src/), and
[behavior tests](test/). Follow the shared
[consumer adoption guide](../../docs/consumer-adoption.md) when updating a pin.
