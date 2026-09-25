# Dust Wave Desktop 0.2.0

A separately scoped macOS 13+ Swift package. No speech, AI, media or Node runtime.

- `DustWaveUpdatePolicy`: framework-free launch-check policy for consumer core targets.
- `DustWaveUpdates`: Record's Sparkle integration with Auto Subtitle's once-per-launch policy and busy-operation guard. Consumers retain exact Sparkle 2.9.5, 2.9.6 or 2.10.0 declarations and lockfiles. Sparkle owns HTTPS feed retrieval, Ed25519 verification, replacement and relaunch. The consumer supplies its feed, key, signed bundle and explicit startup decision. Installations remain user-driven.
- `DustWaveDiagnostics`: Auto Subtitle's bounded reviewed-send/receipt semantics and allowlisted macOS incident projection, implemented in Swift. Construction never sends a report. Consumers own the report schema, endpoint, repository, preview, file selection, persistence and send action. Redirects/cookies/cache are disabled; reports and replies are bounded; success requires a matching receipt.

Paper is the first consumer; the [adoption guide](../docs/desktop-adoption.md) covers the remaining native apps. The original Record and Auto Subtitle MIT notices are retained. Characterization tests preserve launch-check, busy-defer, reviewed receipt and incident privacy behavior. Server-side serialization and GitHub reconciliation are shared in Desktop Core; product adapters and deployment stay in the existing relay.

`checkingOnLaunch` defaults to false, preserving Paper's explicit launch call and MKV Magic's manual policy. Busy errors are injectable so consumer-facing recovery text is retained. `BoundedReportTransport` performs one HTTPS POST with a caller-selected response limit and timeout; it never follows redirects. It returns status and bytes for consumer-specific error handling. `ReportAcknowledgement` preserves exact-string or UUID matching, allowed actions and issue-number bounds. Consumer schemas, pending-report storage and send consent remain local.

Run `swift test --package-path desktop`, plus `npm test` at the Platform root. Consumers pin the complete Platform commit and retain `Package.resolved`. Rollback is an independent consumer pin change. Only the three products above are public. This package does not own app releases, credentials, log collection, crash discovery or automatic reporting.

Transport callers may reject response status, URL or declared length through
`validateResponse` before any body is accumulated. This preserves each app's
failure precedence and avoids waiting for an already-rejected response body.
