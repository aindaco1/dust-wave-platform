# `@dustwave/release-core`

Shared release primitives for consumer-owned release adapters.

The `tauri-updater` entry shares GitHub asset-name normalization and Tauri
manifest assembly. Callers supply exact versions, notes, publication dates and
signed platform entries; artifact selection, signature verification and
publication remain consumer-owned. ASCII VJ Remix and Social retain their
independent updater-manifest characterization tests.

## Normalization and failure semantics

`@dustwave/release-core` contains small release mechanisms with injected consumer
policy. Wrangler parsing propagates malformed TOML errors and strips
non-primitive binding fields from normalized evidence. KV transforms preserve
only key, string value, and optional metadata. Checksum verification rejects
duplicate, missing, escaping, modified, unlisted, symlink, and unsupported
entries. Provider evidence strips undeclared fields, fails unknown statuses
closed, and never claims to contain credentials or customer data. Command
results redact known credential-shaped arguments and omit stdout/stderr unless
the consumer explicitly opts in. Consumers still own every process execution,
secret lookup, filesystem destination, provider call, deployment, traffic
change, and rollback decision.

## Cache, Cloudflare, and screen-reader evidence

The cache-policy entry accepts only explicit HTTP(S) site/Worker origins and
bounded same-origin paths, rejects redirects, and cancels response bodies after
header evidence. The Cloudflare admin-response entry requires an HTTPS origin,
bounded consumer rule identity, a dedicated token, and an exact 32-hex zone ID;
its returned evidence contains neither credentials nor response bodies. The
screen-reader entry keeps product text, URL, expected phrases, and temporary
prefix injected, passes every command argument without a shell, bounds
diagnostics, restores VoiceOver when it started the process, and fails missing
recordings or transcript expectations explicitly. Consumers retain target
selection, credentials, recording consent, evidence retention, release gates,
provider mutation approval, deployment, and rollback.

## Dependency audit evidence

The Node-only `dependency-audit` entry validates npm audit v2 report structure,
severity counts, findings and process status before declaring success. Findings
at the injected threshold return `findings`; missing, contradictory or interrupted
evidence returns `incomplete`. Below-threshold findings remain visible. The
default threshold is moderate; Platform explicitly chooses high.

Consumers supply the process runner and directory/scope policy. The runner must
honor the requested 45-second deadline and SIGKILL termination, returning captured
status/stdout/stderr and a timeout flag. The helper requests lockfile-only audit,
disables npm retries/scripts, uses a 30-second fetch timeout, and retries only
recognized transient failures at most three times with 5/10-second backoff.
Authentication/configuration failures and findings are not retried. Raw transport
diagnostics are not logged; completed vulnerability reports are. No dependency
fix, process implementation, deployment or provider action is performed here.

## Reference

See the [public exports](package.json), [source contracts](src/), and
[behavior tests](test/). Follow the shared
[consumer adoption guide](../../docs/consumer-adoption.md) when updating a pin.

## Backup planning and receipt inspection

`backup-planning` exports `planSnapshotRetention` and `evidenceAgeCheck`. Supply
consumer-verified records with unique snapshot names, valid `Date` instances,
archive sizes and an explicit retention policy. The planner preserves the newest
snapshot, then one snapshot per UTC day, ISO week and month; ties preserve input
order. Release snapshots are retained unless explicitly disabled. Inputs are not
mutated. Plans contain no execution authority and never read or delete files.

Evidence classification accepts an injected clock, uses the first present
timestamp field, treats an invalid timestamp as failure, and clamps future
timestamps to age zero. Missing/stale optional evidence warns; required evidence
fails. This preserves existing consumers and does not certify a receipt itself.

`backup-receipts` is an explicit **Node-only, read-only** entry reusing
`file-integrity` hashing. `readRetentionReceipt(directory)` returns an `ok` union
with the original reason codes for missing/invalid/unencrypted/date-invalid,
unsafe-path, symlink or checksum failures. It requires a timestamp but permits
any basename archive extension. `inspectEncryptedSnapshot(directory)` requires
a real directory, a safe output name and `.tar.gz.age` or `.tar.gz.gpg`, but
does not require a timestamp; it throws descriptive errors. Unexpected filesystem
errors and structurally invalid parsed JSON can throw in both profiles, as in
the characterized consumers. `requireBackupDirectory(value, label)` validates
and resolves a real non-symlinked directory.

These checks are observations, not race-free capabilities. Consumers retain
root/discovery policy, acknowledgement text, encryption/decryption, device
separation, copy/delete execution and immediate revalidation before mutation.
No shared helper uploads, copies, removes, decrypts or restores a snapshot.
