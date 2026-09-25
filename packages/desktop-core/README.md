# Desktop Core

Framework-neutral mechanics for desktop consumers and their reviewed-report
relay. Each entry is independent; importing download progress adds no relay,
GitHub or network implementation to an application.

- `update-progress`: Tauri Started/Progress/Finished byte accounting. The app
  owns launch frequency, busy state, status text, download/install and restart.
- `report-client`: one explicit reviewed JSON POST, no redirects or cookies,
  a bounded response and a receipt matching the submitted ID. Failures throw;
  callers retain the same pending report for explicit retry. Schema validation,
  request size, destination, consent and persistence remain consumer-owned.
- `reviewed-report-group`: serialized provider delivery per fingerprint.
  Pending counts are saved before provider calls; only confirmed delivery
  produces a receipt. Same-ID retries do not increment the count within the
  consumer's retained receipt window. Storage keys and formats are preserved.
- `github-issues`: injected issue writer with indexed/search reconciliation,
  bounded aggregation buckets through the reviewed group, and uncertain-create
  protection. Only a definite invalid-label response permits a second POST.
  Authentication, repository defaults, formatting, fingerprint policy, quotas
  and deployment configuration are injected by the relay owner.

The implementations are characterized in ASCII VJ Remix's relay (including
Paper, Auto Subtitle, CutNotes, Podcast Visualizer and MKV adapters), its Tauri
updater, Social's Tauri updater, and Auto Subtitle's reviewed sender.
The original product contracts and tests remain in those repositories.

The relay remains deployed from its consumer repository. Platform owns no
endpoints, credentials, Durable Object bindings, migrations, report schemas,
automatic reporting or product content. Grouping is deterministic and does
not claim semantic similarity, unique users or a proven common root cause.

Run `node --test packages/desktop-core/test/*.test.js` and root `npm test`.
See [desktop adoption](../../docs/desktop-adoption.md) for ownership and rollback.

Issue reporters may inject validated `markers.state` and `markers.fingerprint`
names to preserve a legacy issue format. Defaults retain the original ASCII
relay markers. A group adapter may implement `initialState(report, fingerprint,
index)` to adopt a provider-confirmed legacy aggregate before its first durable
increment. It runs only when no group state exists; failures propagate and no
new report count is committed. Consumers must verify the exact issue marker,
seed the supplied index, validate legacy counts and preserve maintainer text.
Do not swallow provider errors and create a replacement issue on uncertainty.
