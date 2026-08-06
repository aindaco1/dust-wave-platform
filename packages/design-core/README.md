# `@dustwave/design-core`

Optional, compile-time Sass components shared by Dust Wave sites. The package
contains no JavaScript, Liquid, Jekyll plugin, content, route, or deployment
behavior.

Consumers must define their own design tokens before importing a component.
The shared mixin and layout partials expose compile-time policy for the
characterized Pool/Store gutter model and brand-title geometry. Consumers set
those variables before import; import order, unused components, CSS budgets,
templates, localization, content, and release authority remain consumer-owned.

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
