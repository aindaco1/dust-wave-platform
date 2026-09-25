# Dust Wave Desktop 0.1.0

A separately scoped macOS 13+ Swift package. No speech, AI, media or Node runtime.

- `DustWaveUpdates`: Record's Sparkle 2.10.0 integration with Auto Subtitle's once-per-launch policy and busy-operation guard. Sparkle owns HTTPS feed retrieval, Ed25519 verification, replacement and relaunch. The consumer supplies its feed, key, signed bundle and explicit startup decision. Installations remain user-driven.
- `DustWaveDiagnostics`: Auto Subtitle's bounded reviewed-send/receipt semantics and allowlisted macOS incident projection, implemented in Swift. Construction never sends a report. Consumers own the report schema, endpoint, repository, preview, file selection, persistence and send action. Redirects/cookies/cache are disabled; reports and replies are bounded; success requires a matching receipt.

Paper is the first consumer of this package. The original Record and Auto Subtitle apps are unchanged. Their MIT notices are retained. Characterization tests preserve their launch-check, busy-defer, reviewed receipt and incident privacy behavior. Server-side GitHub aggregation continues to use the existing crash relay's `ReviewedReportGroup`; it is not duplicated here.

Run `swift test --package-path desktop`, plus `npm test` at the Platform root. Consumers pin the complete Platform commit and retain `Package.resolved`. Rollback is an independent consumer pin change. Only the two products above are public. This package does not own app releases, credentials, log collection, crash discovery or automatic reporting.
