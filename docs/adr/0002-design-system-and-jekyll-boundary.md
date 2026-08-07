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

Publish exact Sass component overlap and characterized near-overlap with
bounded compile-time policy as the optional `@dustwave/design-core` package.
It contains only framework-neutral Sass source. Consumers inject tokens and
select gutter/brand-title policy, explicitly select imports, pin the Platform
commit and package version, characterize generated CSS, and retain independent
rollback.

Do not move Liquid includes or Ruby plugins into Platform. They remain Jekyll
integration code and currently depend on consumer templates, data shapes,
localization, content-safety policy, or post-build behavior. At decision time,
the planned golden Jekyll project was required to be a separately owned
template with its own versioning and upgrade workflow, not part of the
Platform runtime or an implicit consumer sync.

## Implementation status

The separately owned
[`dust-wave-jekyll-template`](https://github.com/aindaco1/dust-wave-jekyll-template)
implemented that boundary at `v0.1.0`. Pool `v1.2.19` and Store `v1.1.22` pin
its exact `351281a5` commit and retain checked-in runtime copies. Its manifest
check/write workflow is explicit and independently reversible; no Liquid or
Ruby code was added to Platform.

## Consequences

- Shared component fixes have one source while consumers retain their visual
  tokens, selected layout policy, template markup, content, and CSS budget.
- Platform tests lock the initial sources to the independently characterized
  Pool/Store hashes. Consumer migrations must prove byte-equivalent generated
  CSS and run their complete accessibility, mobile, build, and pre-merge gates.
- New design components require evidence from at least two consumers or a
  clearly reusable primitive. Near-duplicates require explicit Sass policy and
  generated-CSS equivalence in every current consumer; consumer-specific
  selectors remain local.
- Jekyll includes/plugins may still be compared by tooling, but exact equality
  alone does not override the framework-neutral repository boundary.
