# `@dustwave/design-core`

Optional, compile-time Sass components shared by Dust Wave sites. The package
contains no JavaScript, Liquid, Jekyll plugin, content, route, or deployment
behavior.

Consumers must define their own design tokens before importing a component.
The shared mixin and layout partials expose compile-time policy for the
characterized Pool/Store gutter model and brand-title geometry. Consumers set
those variables before import; import order, unused components, CSS budgets,
templates, focus behavior, localization, content, Jekyll configuration,
deployment, and rollback remain consumer-owned.

With Jekyll Sass Converter 3, a pinned Platform submodule can be added as a
load path:

```yaml
sass:
  sass_dir: assets/partials
  load_paths:
    - shared/dust-wave-platform/packages/design-core/styles
```

The site's existing imports can then resolve local partials and the shared
components by name. New consumers should use explicit component imports and
include only the CSS they need.

The optional policy variables are:

- `$dustwave-fit-layout-gutter-mode`: `padding` or `width`.
- `$dustwave-fit-layout-wide-inline-gutter` and
  `$dustwave-fit-layout-xsm-inline-gutter`: consumer-owned gutter dimensions.
- `$dustwave-brand-title-letter-spacing`,
  `$dustwave-brand-title-animation-name`,
  `$dustwave-brand-title-xsm-font-size`, and
  `$dustwave-brand-title-xsm-max-width`: consumer-owned brand-title geometry.

These values produce CSS at build time only. No JavaScript or request-time
design configuration is added.

## Architecture and validation

The [design-system and Jekyll ADR](../../docs/adr/0002-design-system-and-jekyll-boundary.md)
records why Liquid includes and Ruby plugins remain outside Platform and why
the Jekyll Template has its own ownership and explicit upgrade workflow.
See the [characterization tests](test/styles.test.js) and the
[consumer adoption guide](../../docs/consumer-adoption.md).


## Admin editor containment (0.3.0)

Import `admin-editor` for opt-in mixins derived from Pool's editor fixes:
`admin-editor-contained-control`, `admin-editor-fluid-grid`,
`admin-editor-wrap-text`, `admin-editor-wrap-button`,
`admin-editor-open-panel-layer($layer: 10)`,
`admin-editor-block-spacing($gap: 8px)`, and `admin-editor-preview-media`.
They emit declarations only where included. Consumers choose selectors, panel
state, stacking context, typography, color, and spacing policy. This keeps long
filenames and form controls contained, open settings panels above adjacent media,
and preview images within the viewport without introducing shared product CSS.
Pool's English/Spanish browser tests cover desktop, tablet, and mobile geometry.
