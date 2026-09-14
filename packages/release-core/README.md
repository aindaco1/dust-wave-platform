# `@dustwave/release-core`

Shared release primitives for consumer-owned release adapters.

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
