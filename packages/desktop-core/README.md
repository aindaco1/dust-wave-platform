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
- `github-issue-artifacts`: opt-in Markdown mirror of reviewed diagnostics with
  stable identity, bounded reconciliation and uncertain-create protection.
  The consumer supplies the content, authenticated request and durable record.

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

## Optional GitHub issue artifacts

The [Issue Artifacts public preview](https://github.blog/changelog/2026-10-28-issue-artifacts-are-now-in-public-preview/)
can keep a versioned Markdown snapshot alongside each grouped issue. Use it to
retain changes to reviewed diagnostics while leaving the full existing issue
body as the delivery fallback. This is a supplemental snapshot, not a complete
per-report archive: duplicates, disabled periods and failed artifact writes do
not create versions. Platform does not add raw crash files, collect more fields,
generate HTML, or format a product's report.

```js
import { createGitHubIssueArtifactWriter } from '@dustwave/desktop-core/github-issue-artifacts';
import { ReviewedReportGroup } from '@dustwave/desktop-core/reviewed-report-group';

const writeIssueArtifact = createGitHubIssueArtifactWriter({
  request: githubRequest, // Authenticated consumer request; honors headers and signal.
  maxBodyBytes: 65536,
  maxPages: 5,
  timeoutMS: 5000
});
const adapter = {
  ...existingAdapter,
  issueArtifact(report, fingerprint, state) {
    // Return null to decline this report. Select only already-reviewed fields.
    return { name: 'Reviewed diagnostics', body: formatReviewedMarkdown(report, state) };
  }
};
const group = new ReviewedReportGroup(ctx, env, adapter, {
  ...existingDependencies, writeIssueArtifact
});
```

Both the writer and formatter must be supplied; existing consumers make no new
requests or storage writes. The group calls the formatter with the validated
report, fingerprint and a copy of aggregate state. Only `name` and `body` are
used; the destination comes from the fixed consumer adapter and confirmed issue
number. Publication runs inside the existing per-fingerprint queue **after** the
issue receipt is durably saved. Failures log only a fixed code and allowlisted
provider metadata; they do not reject the report, increment its count again or
change its receipt. Duplicate IDs never republish. A later distinct accepted
report retries the latest snapshot. No background retries or backfill are added.

The writer also works independently as
`writeIssueArtifact(env, { owner, repository, issueNumber, key, name, body }, record)`.
The caller must serialize operations per destination/key and supply durable
`record.get()` and `record.put(value)` functions for that identity. A record
stores only destination, artifact number or pending-create intent, never report
content. The group scopes it to `artifact:<issueNumber>:<fingerprint>` within
its existing storage; no new namespace or deployment migration is needed.

The writer uses `generic` Markdown and prepends a stable, hidden identity marker.
Keys allow 1–128 ASCII letters/digits/dots/underscores/hyphens, starting with a
letter or digit. Names are nonblank strings up to 160 UTF-16 code units. The body
budget includes the marker and is measured in UTF-8 bytes. These are local
bounds, not claims about GitHub's limits. Names are not identities: unrelated
documents with the same name are left alone. Indexed artifacts must still have
the exact marker and type. Identical content and names cause no PATCH, avoiding
redundant versions. Edits to this relay-managed artifact may be overwritten by
the next snapshot; maintainer investigation notes belong in a separate artifact.

The [REST contract](https://docs.github.com/en/rest/issues/artifacts), checked
November 18, 2026, uses per-issue artifact numbers, a bare paginated list and an
`artifact` envelope for individual reads. The writer requests API version
`2026-03-10`; the injected transport must preserve that override, honor the abort
signal, bound provider responses, and make one attempt without automatic POST
retries. GitHub App installation tokens require Issues write permission. Preview
availability and actual installation access still need consumer verification.
Each request has its own timeout; consumers must account for multiple requests
in their end-to-end timeout and rate budget.

Only a short page confirms that listing is complete. A failed, malformed,
ambiguous or budget-exhausted listing never authorizes creation. A durable intent
precedes POST. After a timeout, server error, malformed successful response or
lost index save, subsequent calls must recover the exact marker before writing
again. Only explicit 400/401/403/404/410/422/429 rejections clear the intent, with
no retry during the same call. A deleted, repurposed or inaccessible indexed
artifact is not replaced automatically. Operators must reconcile unresolved
intent or deletion before explicitly resetting a record; a missing search result
alone is insufficient. All writer errors propagate to standalone callers; the
group isolates them from already-confirmed issue delivery.

Before adopting, pin the immutable Platform commit and exact package version,
keep full diagnostic content and reconciliation markers in the issue body, and
verify synthetic create/update/unchanged, duplicate receipt, preview rejection,
uncertain create, and existing issue/reopen behavior in the consumer. A compact
issue-only summary needs separate confirmed-fallback and historical-issue
migration work. Rollback removes the opt-in and reverts the consumer pin; retain
artifact records, existing artifacts, receipt history and namespaces. Shared
tests do not establish live GitHub delivery or enable any deployed relay.
