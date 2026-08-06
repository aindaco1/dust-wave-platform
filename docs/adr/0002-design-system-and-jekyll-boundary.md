# ADR 0002: design-system and Jekyll boundary

- Status: accepted
- Date: 2026-08-06

## Context

Pool and Store contain five byte-identical substantive Sass partials covering
base typography, buttons, content blocks, modals, and utilities. They also
contain exact or near-exact Liquid includes and Ruby plugins. Future sites
should benefit from shared visual and accessibility improvements without
turning Platform into a Jekyll application or coupling product content and
build hooks.

## Decision

Publish the exact Sass component overlap as the optional, compile-time
`@dustwave/design-core` package. It contains only framework-neutral Sass source.
Consumers inject tokens and mixins, explicitly select imports, pin the Platform
commit and package version, characterize generated CSS, and retain independent
rollback.

Do not move Liquid includes or Ruby plugins into Platform. They remain Jekyll
integration code and currently depend on consumer templates, data shapes,
localization, content-safety policy, or post-build behavior. An eventual golden
Jekyll project must be a separately owned template with its own versioning and
upgrade workflow, not part of the Platform runtime or an implicit consumer
sync.

## Consequences

- Shared component fixes have one source while consumers retain their visual
  tokens, responsive policy, template markup, content, and CSS budget.
- Platform tests lock the initial sources to the independently characterized
  Pool/Store hashes. Consumer migrations must prove byte-equivalent generated
  CSS and run their complete accessibility, mobile, build, and pre-merge gates.
- New design components require evidence from at least two consumers or a
  clearly reusable primitive; consumer-specific selectors remain local.
- Jekyll includes/plugins may still be compared by tooling, but exact equality
  alone does not override the framework-neutral repository boundary.
