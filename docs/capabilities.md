# Choose an existing primitive

Start from the package catalog in the [root README](../README.md#packages), then
read the entry's failure semantics at the consumer's pinned commit. Install only
the packages the project needs. There is no shared application runtime.

| Need | Existing entry | Consumer-owned decisions |
| --- | --- | --- |
| Admin fetch, tabs, dirty controls, navigation guard, Turnstile sizing | `admin-shell/api-client`, `tabs`, `dirty-controls`, `unsaved-changes`, `turnstile` (TypeScript declarations included) | Routes, CSRF token source, dirty state, confirmation text, storage availability, styling |
| Validate incoming request bodies | `worker-core/request-validation` | Body budget, schema, authorization, route response |
| Bound upstream response bytes or JSON | `worker-core/response-body` | Response budget and schema; upstream transport |
| Hash text or bytes, compare text digests | `worker-core/crypto` | Encoding choice and authorization policy; synchronous empty-token rejection remains separate |
| Provider transport, headers and outbox state | `worker-core/provider-fetch`, `github`, `resend`, `email`, `outbox` | Credentials, delivery policy, records, retries and deployment |
| Digest presentation | `digest-core` | Newsletter selection, templates, recipients and sending |
| Local Markdown links and ATX anchors | `test-core/documentation` (Node only) | File discovery, required guides, content checks, malformed-link and root-boundary policy |
| SQLite-backed D1 unit tests | `test-core/sqlite-d1` (injected SQLite connection) | Runtime, migrations, foreign keys, fixtures, connection lifetime and real D1 integration tests |
| Immutable consumer pin assertions | `test-core/consumer-pin` (Node only) | Expected commit, exact versions, lockfile entries and rollback |
| Reliable npm audit evidence | `release-core/dependency-audit` (Node only) | Process adapter, directories, scopes, minimum severity and release decision |
| Static site foundations | `design-core`, `site-shell`, `build-core`, `media-core` | Jekyll wiring, layouts, content, routes and publishing |
| Captions, alignment and local product videos | `timed-text`, `product-video-core` | Models, media, transcript policy, app integration and output acceptance |

## Starting a project

For a static site with a Worker, select design/site-shell foundations and only
the Worker/admin entries used by its routes. Keep Jekyll integration in the
separately versioned template repository; do not copy Pool's campaign or Store's
commerce model to obtain shared controls.

For a scheduled digest, combine digest presentation with Worker email and bounded
response helpers. Keep source ingestion, scheduling, recipients, templates and
delivery state in the project. Test database code may inject SQLite into the
optional adapter; do not bundle Node tooling into the Worker.

For a local media tool, begin with timed-text or product-video contracts as
appropriate. Retain native UI, model acquisition, process permissions, signing,
updater integration and live application acceptance in the app.

## Pin checks and upgrades

Use an explicit expected full commit and package-version map in a consumer test:

```js
import { assertConsumerPin } from '@dustwave/test-core/consumer-pin';

assertConsumerPin({
  root: process.cwd(),
  expectedCommit: reviewedCommit, // A literal full SHA recorded by the consumer.
  packages: reviewedPackageVersions, // Exact versions, never ranges or "latest".
  lockfiles: reviewedLockfileEntries
});
```

`lockfiles` is optional and contains `{ path, packages }` records; each `packages`
map uses the exact key under an npm lockfile's `packages` object and its expected
version. Linked file dependencies usually store the version at the link target
key, not the `node_modules` link record. Consumers that import source paths can
call the same helper directly from the pinned test-core source.

The assertion checks both the initialized checkout and **staged gitlink**. Stage
an intentional pointer update before running the test. It never initializes,
fetches, stages or advances a submodule. Check failures throw with the mismatched
contract. Follow [migration and rollback](consumer-adoption.md#migration-and-rollback-evidence)
for the full process; passing this assertion is not deployment evidence.

## Extraction boundary

The first reuse batch adds the Node Markdown engine and newsletter SQLite seam.
It does not centralize Python documentation tools, CI change classification,
Film's broader D1 surface, provider lifecycle policy or an entire new-project
generator. Those require their own consumer characterization before adoption.
