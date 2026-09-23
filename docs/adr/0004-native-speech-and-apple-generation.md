# ADR 0004: Native speech and Apple generation

Accepted for implementation on 2026-09-23; no release authorized by this ADR.

## Context

Four macOS products use RecordSpeech from another consumer repository. Apple
Foundation Models session and SDK-compatibility code has also spread across their
formatters. A common improvement requires repeated edits and separate validation.
Platform previously kept all model inference with consumers and owned only
framework-neutral timed-text utilities.

## Decision

Add a separately scoped `native/` SwiftPM package. It owns the existing local
speech implementation and small Apple generation mechanics. Node/Worker packages
remain framework-neutral and gain no dependency on Swift or model inference.
Record keeps compatibility library exports; the other native apps depend directly
on Platform. Existing timed-text and Jev implementations are reused unchanged.

The consumer retains all input/output formats, storage, source preservation,
speaker identity, model installation, process permissions, UI, and release authority.
Formatting policies remain distinct: faithful transcript cleanup, editorial notes,
verbatim subtitle presentation, and podcast boundaries/chapters. The extraction
does not change prompts, corpus, response limits, model use cases, or per-consumer
FluidAudio versions. Record's network entitlements remain unchanged.

## Validation and consequences

Shared tests cover offline enforcement, typed timing contracts, model verification,
speaker constraints, bounded generation, cancellation and error propagation.
Consumers characterize their adapters and compare native synthetic outputs with
fixed deterministic and Jev checks. Jev cannot override exact failures, incomplete
native inference, or controls needing review. Runtime provenance follows the
Platform pin; earlier signed artifacts retain their original source identity.

A single Platform implementation can be rolled out through coordinated pinned
consumer upgrades. Installed applications still require independent signed
updates. No automatic runtime code/prompt download or shared daemon is introduced.
Each consumer can revert its dependency and adapter changes without altering
another app or migrating user data.
