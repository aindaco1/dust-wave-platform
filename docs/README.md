# Documentation

For Platform contributors and consumer maintainers. Start with the
[root README](../README.md) for the project boundary, package versions, and
quick-start commands.

## Guides and references

- [Development](development.md): local checks, CI, and secret-audit behavior.
- [Consumer adoption](consumer-adoption.md): immutable pins, migration and
  rollback evidence, and the dated adoption snapshot.
- [Package references](../README.md#packages): the catalog links to each
  package's README, behavior/failure semantics, public exports, and tests.
- [Changelog](../CHANGELOG.md): versioned release history.
- [Repository rules](../AGENTS.md): contribution boundaries and workflow.
- [License](../LICENSE): MIT terms.

## Architecture decisions

- [ADR 0001: shared repository boundary](adr/0001-shared-repository-boundary.md)
- [ADR 0002: design-system and Jekyll boundary](adr/0002-design-system-and-jekyll-boundary.md)
- [ADR 0003: reusable product-video boundary](adr/0003-product-video-boundary.md)

Each ADR records a distinct decision. Preserve its historical context and link
implementation guidance to the appropriate package or consumer guide.

## Where documentation belongs

| Location | Responsibility |
|---|---|
| Root README | Project overview, boundaries, package/version catalog, quick start, and navigation |
| Root AGENTS | Repository-wide contributor and agent instructions |
| Root CHANGELOG | Versioned release history; keep the existing test-backed path |
| Root LICENSE | Repository license |
| Package README | Package behavior, failure semantics, ownership, and usage; merge related material here |
| Documentation guides | Cross-package development and consumer adoption workflows |
| Architecture decisions | Reasons for accepted boundaries and their consequences |
| Consumer repository | Product-specific adapters, migration/rollback evidence, deployments, and acceptance |

Maintain one detailed reference for each subject and link to it from overviews.
Keep package versions in the root catalog and release changes in the changelog;
do not duplicate those tables in package references. Date consumer-adoption
snapshots and cite their evidence when refreshing them.
