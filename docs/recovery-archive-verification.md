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
