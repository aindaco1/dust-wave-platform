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

## Optional test tooling

`consumer-pin` and `documentation` are opt-in Node entries. The main entry remains
free of Node filesystem, Git and SQLite imports. See the
[capability guide](../../docs/capabilities.md#pin-checks-and-upgrades) for pin and
lockfile assertions; all expected values remain in the consumer.

`documentation` accepts an explicit list of absolute Markdown paths and required
relative paths. It handles local inline links, percent-encoded paths/anchors,
ATX heading collisions and fenced examples. Consumers own discovery and content
policy. The default propagates malformed-link/read failures; `malformedLinks:
'report'` records them as errors. `restrictToRoot` rejects lexical parent-path
escapes, not symlink traversal; this is a checker for trusted repository files,
not a sandbox or a complete Markdown renderer. Remote links are not fetched.

`sqlite-d1` accepts a consumer-created SQLite connection and imports no SQLite
runtime itself. Its statement contract is exercised with Node 22 and 24's
`node:sqlite` (`prepare`, `run`, `all`, `get`, `setReturnArrays`, `exec`). Consumers
own Node compatibility, migration transactions, foreign keys and closing even
after setup failures. `batch` accepts statements from the same adapter, executes
their `run` operations in a transaction, and rolls back on error. It does not
reproduce D1 query-batch results, sessions, dump, durability or all metadata:
timing/size are zero placeholders and sessions/dump throw. Keep real Worker/D1
integration checks. Shared SQLite behavior tests skip only when Node lacks the
builtin; the Node 22/24 CI lanes run them.

## Reference

See the [public exports](package.json), [source contracts](src/), and
[behavior tests](test/). Follow the shared
[consumer adoption guide](../../docs/consumer-adoption.md) when updating a pin.
