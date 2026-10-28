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
rejected with `tax_provider_redirect`: transport uses Worker-compatible manual
redirect mode and rejects every 3xx response without forwarding credentials. Response sizes and deadlines are bounded. Consumers retain
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

## US postal and open local-tax references

`address-consistency` checks known US ZIP/state combinations and suggests mailing cities without rejecting city aliases. Unknown/international destinations remain unchecked; this is not street validation. `open-us-tax` returns reviewed ZIP-level general-rate components or null for unknown, ambiguous, excluded or expired data (90 days from the upstream timestamp). It does not decide taxability, nexus or fallback.

Data lives in `data/` with source metadata and license notices. Keep these server-side; do not ship the reference databases in browser bundles. `open-us-tax-updater` verifies source digest/schema, limits sizes and coverage loss, and atomically replaces an explicitly supplied output. `bin/update-us-postal.py --output PATH` refreshes the GeoNames reference. Review and release snapshot changes; downloading them does not activate consumer tax configuration. Consumer-selected output paths and release pins preserve independent rollout.
