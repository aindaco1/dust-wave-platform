# ADR 0003: reusable product-video boundary

- Status: accepted
- Date: 2026-08-06

## Context

Pool had a local-only worktree containing a Playwright frame capturer, FFmpeg alpha-video renderer, Pool selectors, a Jekyll preview launcher, capture CSS, and an optional marketing-repository copy step. The flow was coherent but had no rendered artifact, no tests, no remote branch, and no clean-checkout path. The user requested a reusable way to produce product video for future Dust Wave products.

## Decision

Add `@dustwave/product-video-core` to Platform as a local developer tool. Platform owns only the bounded declarative flow, transparent Playwright stage, frame-capture mechanics, generated-path guardrails, shell-free render plan, decoded alpha verification, and FFprobe evidence contract.

Consumers retain preview startup, framework configuration, product fixtures and selectors, presentation CSS, editorial timing, output names, marketing destinations, generated media, review, publication, and deployment. Playwright is an optional peer so Platform does not install a browser runtime for packages that do not use the tool. FFmpeg and FFprobe remain host tools.

## Consequences

- Future products can adopt one tested capture/render engine with a small local flow and preview adapter.
- Platform receives no product content, generated video, credential, environment ID, Jekyll integration, or publication authority.
- Capture defaults to loopback, remote origins require explicit authorization, navigation stays same-origin, and arbitrary script evaluation is not part of the flow language.
- Output is bounded below an explicit workspace work root. Existing directories fail closed and are never recursively deleted or overwritten.
- Pool can roll back by reverting its Platform gitlink and local adapter without affecting another consumer.
