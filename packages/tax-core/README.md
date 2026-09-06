# `@dustwave/tax-core`

Destination normalization, deterministic integer-cent manual-rate calculation,
bounded provider transport, and a vendored New Mexico starter reference for
consumer tax adapters.

## Destination and manual calculation

The root entry normalizes country, postal code, and address fields and reports
invalid destinations with `valid: false`, `destination: null`, and an error.
Manual calculation validates integer-cent amounts and rates and supports
inclusive/exclusive tax and consumer-selected shipping taxability. Invalid
calculation policy throws rather than silently selecting a rate or behavior.

## Provider transport

The provider entry contains bounded Zip-Tax and New Mexico GRT lookups plus
address, street-parser, and provider-source normalization. Provider bases
require HTTPS except for the explicit localhost allowance. Redirects are
rejected, and response sizes and deadlines are bounded. Consumers retain
provider choice, credentials, taxability, fallback,
retry, checkout, storage, and deployment policy.

## New Mexico starter reference

The New Mexico GRT starter entry is a vendored public reference snapshot. Its
updater requires an explicit consumer-owned output path, fetches every seed
successfully before writing, and propagates network or response failures. It
does not select a checkout provider or declare a rate authoritative; each
consumer retains provider configuration, refresh review, taxability, fallback,
and release policy.

## Reference

See the [public exports](package.json), [source contracts](src/), and
[behavior tests](test/). Follow the shared
[consumer adoption guide](../../docs/consumer-adoption.md) when updating a pin.
