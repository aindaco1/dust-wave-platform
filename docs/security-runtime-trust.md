# Runtime TLS trust

Reviewed October 21, 2026. Platform does not distribute a TLS root store.
Updating a Platform package or gitlink does not replace a consumer's embedded
Node, Rust verifier, Python CA bundle, browser, or operating-system trust data.

## Ownership

| Entry | Certificate verifier owner | Required acceptance |
| --- | --- | --- |
| Worker primitives and injected JS `fetch` | Hosting runtime or caller | Test the deployed runtime or exact local executable, including custom CA configuration. |
| JavaScript desktop reviewed-report transport | Consumer's Node/runtime | Test the bundled runtime before signing and its permitted execution context after signing. |
| `support/` and `desktop/` Foundation networking | Apple trust services | Test default URLSession on supported devices; a version number alone is insufficient. |
| `qt/` report transport | Consumer's Qt TLS backend | Identify and test the active backend; helpers may use different CA files. |
| `native/` | No networking | Retain the offline boundary; do not add trust-store or download policy. |

Consumer endpoints, credentials, trust configuration, report consent and release
authority stay in the consumer. A shared transport must never suppress a
certificate error or retry by disabling certificate validation.

## October 2026 eMudhra response

The disclosed weak keys include six TLS intermediates, with direct and AAA
cross-signed test paths, plus two code-signing intermediates. Acceptance of a
test TLS chain demonstrates exposure; it does not establish intercepted traffic
or compromise of a consumer's signing key. See the [primary incident record](https://bugzilla.mozilla.org/show_bug.cgi?id=2083449)
and [disclosure and test hosts](https://emudhra.we-have-a-problem.com/).

The workspace development baseline is Node 22.23.4+, 24.22.1+, or 26.12.1+ on
those supported major lines. CI uses explicit fixed patches. This is a tooling
baseline, not a new runtime requirement added to already-published packages.
Keep immutable package releases and independent consumer rollback pins.

Consumer runtime repairs must follow the applicable upstream release:

- [Node 24.22.1](https://github.com/nodejs/node/releases/tag/v24.22.1),
  [22.23.4](https://github.com/nodejs/node/releases/tag/v22.23.4), or
  [26.12.1](https://github.com/nodejs/node/releases/tag/v26.12.1).
- [rustls-webpki 0.103.16](https://github.com/rustls/webpki/releases/tag/v%2F0.103.16)
  and [webpki roots 1.0.10](https://github.com/rustls/webpki-roots/releases/tag/v%2F1.0.10).
  Lock the verifier as well as root data; removing a root alone may leave
  cross-signed paths trusted.
- [certifi 2026.10.19](https://github.com/certifi/python-certifi/releases/tag/2026.10.19)
  and [Deno 2.9.8](https://github.com/denoland/deno/releases/tag/v2.9.8).
  A standalone helper may bundle its own certifi file even when the host Python
  has been updated. Pin downloaded sources and verify their checksums.

[Cloudflare's mitigation](https://blog.cloudflare.com/emudhra-certificate-compromise/)
covers its managed services. It is provider evidence, not a claim that every
consumer deployment, GitHub runner or customer-managed container was tested.

## Acceptance contract

Use the exact runtime and trust configuration that will ship. Make unauthenticated
requests with default validation, no application data, bounded timeouts, and no
redirect following. First require a valid HTTPS control. Then require certificate
rejection for all twelve hosts formed from:

```text
issuers: dv-g3b, dv-g3c, ov-g3b, ov-g3c, ev-g3b, ev-g3c
https://<issuer>-emudhra.we-have-a-problem.com/
https://<issuer>-aaa-emudhra.we-have-a-problem.com/
```

For patched Rust/Deno require the explicit `CertDistrusted` cause. For Node,
record the certificate error code through both `https` and `fetch`. A timeout,
DNS failure, unsupported-media error, HTTP failure, expired leaf, process crash,
or a missing runtime is not proof of distrust. Public-host tests are opt-in
release acceptance and must not make offline unit tests depend on a third party.

After signing, exercise executable behavior, not only `--version`. V8-based
macOS helpers require the reviewed JIT entitlement. An inherited-sandbox helper
must be tested from a suitable signed parent; do not remove its sandbox to make
a test pass. Verify the final manifest, app signature, notarization and package
separately. A locally installed repair is not a public release or updater hop.

## Apple and local tool stores

A fresh default Foundation probe on one macOS 27.0.1 machine accepted the
DV-G3B direct test chain while rejecting the other eleven paths. No proxy or
custom authentication-challenge override was involved. Explicit user-level
SSL distrust of the twelve published intermediate certificates made all twelve
fail. This is local containment, not proof of a completed Apple-wide rollout;
other Macs, other users and physical iOS devices require independent checks.

Legacy command-line clients may use `/etc/ssl/cert.pem` instead of Apple trust
services. On the same machine, Apple's bundled Python/LibreSSL reported an
environment CA path while still loading the old default store. Test the actual
handshake after configuration changes. Back up trust settings and CA files
before changing them; operating-system updates may replace local files. Keep
machine-specific certificates, trust exports and rollback evidence outside this
repository.
