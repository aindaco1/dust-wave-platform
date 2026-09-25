# ADR 0005: Desktop update and diagnostics mechanics

Accepted for source migration on 2026-09-25. App releases and relay deployment
retain their existing consumer-owned acceptance procedures.

Paper already consumes a separate desktop Swift package. Other macOS apps
duplicate Sparkle lifecycle, launch policy and bounded reviewed-report clients.
The existing relay shares serialization internally, but its reusable mechanics
are housed with one product. Tauri apps share event and manifest mechanics while
their UI, startup frequency and native installation flows differ.

Extend the existing desktop package with framework-free launch policy and
bounded transport/acknowledgement primitives. Retain every consumer's exact
Sparkle version; accepting a bounded range does not upgrade a consumer.
Add independent Desktop Core JavaScript entries for shared report and progress
mechanics and a Release Core entry for Tauri manifest construction.

Product schemas, report selection, fingerprints, status text, persistence,
consent, endpoints, credentials and release authority remain in consumers.
The relay injects authentication and issue formatting into the shared writer;
its deployment classes, bindings, keys and migrations remain unchanged.
No automatic reporting, cross-product data store or universal app shell is added.

Before/after consumer tests and shared failure tests establish the extraction.
Each app pins the full Platform commit and exact package versions, packages its
runtime dependencies and may revert independently. Signed updater installation
and deployed GitHub delivery remain separate acceptance gates.
