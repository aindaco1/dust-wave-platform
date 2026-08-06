# `@dustwave/design-core`

Optional, compile-time Sass components shared by Dust Wave sites. The package
contains no JavaScript, Liquid, Jekyll plugin, content, route, or deployment
behavior.

Consumers must define their own design tokens and mixins before importing a
component. The current contract uses the variables and mixins already present
in Pool and Store. Import order, unused components, CSS budgets, templates,
localization, breakpoints, content, and release authority remain consumer-owned.

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
