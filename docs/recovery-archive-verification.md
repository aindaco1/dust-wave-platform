# Read-only recovery archive verification

`scripts/verify-recovery-archive.py` checks the latest encrypted Store or Pool
snapshot in a configured private S3-compatible archive. Consumers pin this
operator script by immutable Git commit separately from their runtime package
pin. It requires Python 3.11+, age, and AWS CLI v2.

Consumer-owned protected environments provide `RECOVERY_ARCHIVE_URI`,
`RECOVERY_ARCHIVE_ENDPOINT`, `RECOVERY_ARCHIVE_NAME`, `RECOVERY_AGE_IDENTITY`,
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_DEFAULT_REGION`.
`RECOVERY_MAX_AGE_HOURS` is the consumer's RPO (default 4 hours).
`RECOVERY_EVIDENCE_OUTPUT` is a private path outside the checkout.

The script lists the configured prefix, downloads the newest receipt and its
encrypted archive, verifies size and SHA-256, decrypts in private temporary
storage, and checks every internal file against the snapshot checksum inventory.
No extraction, provider write, restore, or payment request occurs. Temporary
plaintext and the key file are removed on exit. Logs and evidence contain only
aggregate counts, timestamps, fixed error categories, and verification results.

Missing, stale, incomplete, corrupt, oversized, or undecryptable snapshots fail
the check. Inventory is bounded to 1,000 objects and archive expansion to 2 GiB;
exceeding either limit requires a reviewed operator follow-up. Passing proves
the latest archived snapshot's current integrity and decryptability with the
configured identity. It does not prove application restore, historical retention
coverage, bucket lock policy, or independent key escrow.

## Capture and publish

`capture-recovery-archive.py` accepts the consumer's existing snapshot command as
arguments. The consumer owns its data inventory, command flags and identity
variable name (`RECOVERY_IDENTITY_VARIABLE`). The shared runner creates private
staging, supplies the identity file, requires captured KV families and a Git
bundle, verifies the encrypted snapshot locally, uploads ciphertext to a unique
prefix, publishes the receipt last, then downloads and verifies that exact R2
copy. Store additionally sets `RECOVERY_REQUIRE_R2=true` to require its complete
object inventory. Provider command output stays private and temporary staging is
removed on failure as well as success. Only sanitized verification JSON is
retained by GitHub. No production restore, payment, email, pruning or deletion
command is part of this path.

Required configuration extends the audit environment with
`RECOVERY_ARCHIVE_ACCOUNT_ID`, `CLOUDFLARE_ACCOUNT_ID`, and
`RECOVERY_IDENTITY_VARIABLE`. The destination must be the configured separate
Cloudflare R2 account. Existing consumer encryption-recipient variables are
passed through. `RECOVERY_EVIDENCE_OUTPUT` is a sanitized JSON file outside the
checkout. The provider read token belongs to the consumer. Commands are passed
as an argument array, never shell-evaluated.

Archive verification follows up to ten pages of 1,000 objects, enough for the
400-day lock window at six two-file snapshots per day. A missing/repeated cursor
or an exceeded bound fails rather than silently selecting an older page.

`seal-backup-credentials.py` supports one-time provisioning of an unattended,
main-only `production-backup` environment. It seals five explicit backup values
to the target environment's GitHub public key using LibSodium. The resulting
envelopes can only be decrypted by GitHub and must be installed with the matching
key ID through the environment-secrets API. The protected source remains
`production-recovery`; its reviewer rule is unchanged. No source-provider,
admin, payment, or restore credential is included in these envelopes. Requires
PyNaCl (Ubuntu `python3-nacl`) only for this one-time operation.
