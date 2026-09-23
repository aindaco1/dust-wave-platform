# AGENTS

This repository owns small, versioned, framework-neutral primitives shared by Dust Wave products.

`native/` is the separately scoped SwiftPM exception: local speech and Apple
Foundation Models adapters for macOS consumers. It owns no app, networking,
model installation, storage, or product formatting policy. See
`docs/adr/0004-native-speech-and-apple-generation.md`.

## Boundaries

- Consumer repositories retain their domain models, storage, templates, routes, and deployment authority.
- Extract only code with characterization coverage in every current consumer.
- Exact duplicates move first. Near-duplicates require an injected policy or adapter and independent migration evidence.
- Never put consumer credentials, `.dev.vars`, environment-specific IDs, customer data, generated media, or product content here.
- A package release is immutable. Consumers pin a submodule commit and an exact package version.
- Each consumer must be able to roll back its submodule pointer independently.
- Native consumers pin the full Platform gitlink and retain their characterized
  exact FluidAudio version and Swift lockfile. Run `swift test --package-path native`
  for native changes; live synthetic Jev comparisons remain consumer-owned.

## Workflow

1. Add or preserve behavior-focused tests before moving code.
2. Keep public exports narrow and document failure semantics.
3. Run `npm test`.
4. Record consumer migration and rollback evidence in the consumer pull request.
5. Do not merge a breaking change until all affected consumers have a compatible release branch.

Use Node.js 20 or newer. Prefer Web Platform APIs so Worker packages remain runtime-portable.
