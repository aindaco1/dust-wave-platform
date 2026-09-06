# Development

For contributors changing shared packages or repository tooling. Follow the
[repository rules](../AGENTS.md) and preserve characterization coverage before
moving consumer code. Prefer Web Platform APIs to keep Worker packages portable.

## Setup and checks

Use Node.js 20.9 or newer, matching the minimum in the
[workspace manifest](../package.json). [CI](../.github/workflows/ci.yml) uses
Node.js 22. From the repository root, install the locked dependencies:

```bash
npm ci
```

Run the complete check:

```bash
npm run check
```

This runs `security:secrets`, `security:audit`, then `npm test`. The unit suite
also checks manifest/lockfile consistency, the top changelog release, and every
package version in the root README. No secrets are required for these checks.

For individual checks, use `npm test`, `npm run security:secrets`, or
`npm run security:audit`. Consumer migration and release gates are separate;
see [consumer adoption](consumer-adoption.md).

## Secret audit behavior

The [secret-audit script](../scripts/scan-tracked-secrets.mjs) performs a
high-confidence scan of tracked text files, including the prefixed
Cloudflare global-key, user-token, and account-token formats. Findings report
only the file, line, and credential type; suspected secret values are never
echoed. No secrets are required for the shared checks.

Consumers with local `.dev.vars` files may inject those paths and their
test-only allowlist through `runSecretAudit`. The same primitive then verifies
ignore/tracking posture and searches exact local values in the worktree and
history without returning or partially masking the values. Consumer-specific
secret filenames and fixture policy remain in thin local adapters.

## Documentation changes

Use the [documentation index](README.md) to choose the authoritative location.
Update package behavior and failure semantics in the package README, keep
package versions in the root table synchronized with manifests, and preserve
ADRs as decision records. Check relative links after moving content and run
`npm test`, including the existing version/documentation contract checks.
