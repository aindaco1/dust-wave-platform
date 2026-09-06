# `@dustwave/test-core`

Test-framework-neutral browser Storage setup and mobile overflow assertions.
Consumers inject runner adapters and retain fixtures, pages, viewports,
product assertions, browser installation, and runner configuration.

## Browser Storage

`createStorageShim` provides an in-memory Web Storage-shaped object with
string keys and values. `syncBrowserStorageGlobals` does nothing when its
target has no `window`; otherwise it reuses usable existing browser storage
or installs a shim on both the target and its window.

## Horizontal overflow

`expectNoHorizontalOverflow` uses the consumer's `page.evaluate` and
`expectTarget.poll` to compare document overflow against `tolerancePixels`
(default: 1). It throws `TypeError` when either required adapter is missing
and `RangeError` for a non-finite tolerance or one outside zero through 100.
Assertion failures propagate through the injected test runner.

## Reference

See the [public exports](package.json), [source contracts](src/), and
[behavior tests](test/). Follow the shared
[consumer adoption guide](../../docs/consumer-adoption.md) when updating a pin.
