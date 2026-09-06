# `@dustwave/build-core`

Allowlisted generated CSS/JavaScript minification for consumer build adapters.

## Behavior and failure semantics

`@dustwave/build-core` processes only generated CSS and JavaScript below the
explicitly allowlisted directories in a built site; the default remains
`assets`. Relative roots are bounded, traversal-safe, independently checked for
existence, and required to resolve inside the built site. The minifier skips
maps, vendor code, and HTML and writes only when output is smaller. Check mode
exits unsuccessfully when an allowed generated file can still be reduced.
Consumers retain root selection, source assets, build orchestration, budgets,
deployment, and rollback authority.

The [CLI](bin/minify-site-assets.mjs) exposes the same generated-asset boundary.

## Reference

See the [public exports](package.json), [source contracts](src/), and
[behavior tests](test/). Follow the shared
[consumer adoption guide](../../docs/consumer-adoption.md) when updating a pin.
