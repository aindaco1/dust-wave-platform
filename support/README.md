# Dust Wave Support 0.1.0

Foundation-only Swift primitives for iOS 17+ and macOS 13+. No Sparkle, Qt,
speech/AI, automatic collection, storage or network request at initialization.

- `BoundedReportTransport`: one explicitly invoked HTTPS POST, bounded response,
  no redirects/cookies/credentials/cache. The caller supplies status validation,
  request/resource timeouts, endpoint and already-reviewed payload.
- `ReportAcknowledgement`: matching-ID receipt validation with injected action,
  issue-number and exact-string/UUID comparison policies.
- `ReviewedReportClient` and `ReportReceipt`: the retained desktop convenience
  API. Existing imports through `DustWaveDiagnostics` continue to work.
- `MetricKitStackProjection`: a bounded projection of caller-provided call-stack
  JSON, retaining only selected app binary UUIDs and relative offsets. It does
  not subscribe to MetricKit, collect files or infer that missing data means no crash.

Consumers own their UI, schemas, allowed fields, consent, subscriptions, journal,
retention, retry persistence, product errors, destinations and release authority.
No iOS updater or camera-database updater is included.

`swift test --package-path support` verifies the projection; the desktop suite
characterizes the compatible transport/receipt API, and Road Notice retains
before/after native transport and golden-contract tests. Build the `DustWaveSupport`
scheme for an iOS simulator to verify the deployment minimum. Complete source
bundles include this directory alongside `desktop/`.

Consumers pin the full Platform gitlink and exact package VERSION. Reverting
their migration restores the earlier pin independently of other apps.
