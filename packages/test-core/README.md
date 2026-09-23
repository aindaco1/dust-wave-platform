# `@dustwave/test-core`

Test-framework-neutral browser Storage setup, mobile overflow assertions and
opt-in semantic evaluation.
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

## Advisory Jev evaluation

The opt-in `jev` entry creates atomic choice questions, validates complete Jev
responses, routes near ties/unknown models to review, and collects advisory
batch evidence. Cases may include an optional `reference` string for comparisons;
questions explicitly prohibit crediting source facts absent from the candidate.
`callCloudflareJev` makes one request with a timeout through body
consumption, bounded response streaming, rejected redirects and sanitized errors.
It reuses Worker Core's bounded response reader. No credentials are discovered
or stored by this entry. Cache and gateway logging are disabled in the request;
these headers do not establish the provider's retention policy.

Consumers own source allowlists, synthetic fixtures, render capture, rubrics,
credential acquisition, cost estimates/caps, calibration labels, evidence storage
and release policy. `evaluateJevCases` validates the entire batch and explicit
question budget before requests, saves raw answers through `onProgress`, stops
on the first error, and never retries. Omit `call` for a request preview, which
stays incomplete. A completed report means evaluation completed, not that cases
passed. `releaseAccepted` always remains false. `minimumMargin` and recognized
`models` are supplied by the consumer; no threshold is claimed to be calibrated.

Request payloads are capped at 32,000 UTF-8 bytes. Model context/cost policies
remain consumer-owned. Empty/malformed answers, mismatched question keys,
invalid probabilities/usage and unfinished provider results cannot become passes.
This is development tooling; importing it does not add model calls to consumers.

## Reference

See the [public exports](package.json), [source contracts](src/), and
[behavior tests](test/). Follow the shared
[consumer adoption guide](../../docs/consumer-adoption.md) when updating a pin.
