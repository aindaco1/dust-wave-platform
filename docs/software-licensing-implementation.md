# Licensing implementation record

## November 9: free ASCII VJ Remix distribution release

The separately authorized free [ASCII VJ Remix 1.3.3 release](https://github.com/aindaco1/ascii-vj-remix/releases/tag/v1.3.3)
publishes offline component notices and four corresponding-source archives with
hash records. [PR #54](https://github.com/aindaco1/ascii-vj-remix/pull/54) merged after
all four PR jobs passed; exact-main CI passed before tag creation. The
[15-job release workflow](https://github.com/aindaco1/ascii-vj-remix/actions/runs/42543256824)
passed signing/notarization, platform source/notice gates and public 1.3.2 → 1.3.3
installer/updater tests on macOS, Windows and Linux. The immutable release source
is `45f8f1a8e7b8cbec9e21bbf3a8d2ba2bf8c713c3`.

The consumer's [release record](https://github.com/aindaco1/ascii-vj-remix/blob/main/docs/releases/RELEASE_1.3.3.md)
owns artifact hashes, independent local acceptance, cleanup and remaining
physical-hardware limits. This free release keeps public updates and offline
rendering; it does not activate the licensing service or require a license.
The VCR font's paid-redistribution evidence remains pending. **Paid Entitle sales,
production licensing and scheduled licensing capture remain disabled.** Ordinary
encrypted backups retain their existing schedule. No Platform runtime package or
consumer submodule pin changed. The licensing execution sequence remains
capacity/abuse limits, peak-memory profiling and retention/recovery objectives.

## November 8: signed native rotation acceptance and merged groundwork

The compatible ASCII VJ Remix pilot passed signed native acceptance using the
established Volver Health Developer ID identity, hardened runtime and a unique
disposable bundle ID. The visible form activated a synthetic license, its legacy
token survived signer overlap and was denied after retirement, and explicit
reactivation issued a compatible versioned token without changing the occupied
seat or installation/revision digest. Rendering continued after retirement.

The signed 1.3.2 → 1.3.3 update installed 99,120,657 bytes in 7.14 seconds. The
replaced executable matched the signed target and retained activation on restart
without receiving the key again. After the local service stopped, the packaged
UI smoke and visible offline preset rendering passed. Test Keychain credentials,
Worker state, license files and ephemeral updater signing material were removed.
These disposable builds were neither notarized nor published. The app's configured
release gate passed, including 96 Rust tests with two existing opt-in tests ignored.

The previously uncommitted ASCII notice/source/distribution and opt-in licensing
work merged in [ASCII VJ Remix PR #53](https://github.com/aindaco1/ascii-vj-remix/pull/53)
at `df6000435a8001140d5db25bed64b9fe76d45e51`, including canonical sanitized native evidence in
`docs/release-evidence/2026-11-08-native-rotation.json`. The local probe's optional
stdin rotation/status/quit controls are in
[licensing PR #4](https://github.com/aindaco1/dust-wave-licensing/pull/4); all 15 local
authority tests/build and real probe transition/cleanup checks pass. Its hosted CI
[passed](https://github.com/aindaco1/dust-wave-licensing/actions/runs/42523561680)
and it merged at `ed90bcf86beaccab54c5755b5afc5c01132e278b`; the merged tree
matches the tested head. ASCII's four hosted Desktop CI jobs (macOS 26, Xcode 27,
Windows and Linux) [passed](https://github.com/aindaco1/ascii-vj-remix/actions/runs/42523521434),
including Windows/Linux test packages and native Pop Out checks. Its merged tree
also matches the tested head. The original app checkout is clean at the merge;
its 49 former changed/new files are retained in recovery stash
`1019d5334db42f349b20b9bf80c608e18cbe3fe7` after verifying 511 source hashes.
The [automatic version workflow](https://github.com/aindaco1/ascii-vj-remix/actions/runs/42525608844)
confirmed existing tag `v1.3.2` and skipped tagging/release dispatch. No production
route or Platform runtime package was added.

A fresh locked source archive verified 420 dependency packages. A separate local
rebundle corrected the copied debug fixture's stale generated catalog and verified
732 embedded license files against current Cargo/npm lockfile digests. Platform
tests and consumer recipes also passed.

Next: capacity/abuse limits, peak-memory profiling and retention/recovery objectives.
Public release still requires distribution/source/font, notarized-artifact and
platform acceptance. **Paid Entitle sales and scheduled licensing capture stay
disabled.** Ordinary encrypted backups retain their existing schedule.

## November 8: server-secret hardening and protected recovery

Server-secret hardening is merged in private [licensing PR #3](https://github.com/aindaco1/dust-wave-licensing/pull/3)
(`5b5f398a95a7b03ba14a8a51981064ea973432b3`) and
[Store PR #128](https://github.com/aindaco1/store/pull/128)
(`de0f0ea9295267a604c0f31d8b325f23fd1baa7f`). Review found no blocking issues,
comments or unresolved threads. Both merged trees match their passing CI heads
(`e84e61090de73c921096c0a86449e9265229d98b` and
`9779d6ebbbd2ae528fd5e8718105aec6415d8a36`). It adds one expiring previous service/capture
credential and one previous activation-token verification key. Current tokens
identify their signer; old tokens still require the current grant generation and
active device revision. Rotation never enables installed-use enforcement.

The original Store derivation root stays stable. Existing encrypted restore now
compares checkpoint-specific proofs for the complete signing set, key IDs and
original retirement deadline before importing. Synthetic checks reject wrong or
missing roots and altered deadlines while the target remains empty, then recover
both signers, retire old service/token credentials and preserve customer-key
recovery, seats, refunds, revocations and administration receipts. Raw server
secrets remain excluded from data snapshots; protected custody of the original
roots is a separate requirement. No production roots were created or rotated.

Store's new `preview:licensing-admin` command runs its real dashboard/auth and
Workers on loopback with synthetic paid/complimentary licenses, payment/refund
history, an active device and private releases. The visible UI was inspected;
provider requests are blocked and mail stays dry-run. No alternate admin UI or
Platform runtime package was introduced. The follow-up gives **Licenses** its own
dashboard tab and mobile navigation entry. It reuses the dashboard cards, field
stacks, checkboxes and info bugs, with English/Spanish help for update coverage,
devices, refunds and private releases. Escape dismisses help while retaining focus.
Disabled licensing shows an unavailable message with no controls. The preview
remains local and synthetic; no production admin deployment is implied.

ASCII VJ Remix's local pilot receipt validator now accepts four-, five- and
six-part tokens while retaining size/character/installation bounds. Its 96 Rust
tests and Tauri policy check passed (two existing environment-specific tests stay
ignored). This narrow compatibility change remains in the existing local pilot
work; no app was rebuilt for distribution, installed or released. Signing-key
retirement needs explicit reactivation with the customer key; the app does not
retain that key for silent retries.

Authority tests/build and hosted [Feasibility checks](https://github.com/aindaco1/dust-wave-licensing/actions/runs/42455294576)
passed. Store's full pre-merge gate passed 874 unit tests, seven payment contracts,
22 security tests and 115 browser tests after the Licenses-tab follow-up, plus all audit/build/resource/Worker
checks. Four final focused suites passed 14 tests; Platform passed 397 tests and
both clean-checkout recipes. The updated local encrypted rehearsal passed: 50 Store records, 41
licensing rows, two objects, no external requests, payments or emails. Store's
release evidence records its complete gate and final focused checks. A direct
deployed attempt stopped on local Wrangler authentication before allocating any
resource. The updated protected off-account rehearsal
[42461224009](https://github.com/aindaco1/store/actions/runs/42461224009) ran against the merged revisions after normal `production-recovery` reviewer
approval. Its digest-verified receipt confirms remote archive/restore and source/
target cleanup, but a post-restore authorization assertion failed (403 vs 200).
Independent reads found no leftover rehearsal resources. The narrow follow-up
[Store PR #129](https://github.com/aindaco1/store/pull/129) activates bulk-secret
updates through the existing immediate Durable Object deployment and labels
acceptance failures. Fourteen focused tests pass, including a regression that
failed on the previous helper. Its full hosted
[Merge Smoke gate](https://github.com/aindaco1/store/actions/runs/42461977205) passed,
and it merged as `7bb1f44a6e5a8ed99840043607c3c01a09a355d1`; the merged tree matches
the tested head `641cd36853fcb93d216c4dba39e4e2ac566eca8a`.

Protected retry [42462794992](https://github.com/aindaco1/store/actions/runs/42462794992)
passed against that Store commit and licensing `5b5f398a95a7b03ba14a8a51981064ea973432b3`
after normal `production-recovery` reviewer approval. The downloaded sanitized
artifact matches GitHub's SHA-256 digest
`2989a968052daa347a47e2bbdcde6be8dc807c8ca11af549093f2b79b4179b8c`.
It confirms deployed-source drain/freeze/resume, encrypted off-account archive
round trip, separate target restore, full logical/KV/R2 readback and signed
downloads. Both signers were recovered; previous/current service credentials
worked during overlap, then the previous service credential and signer were
denied while the current signer and Store customer-key recovery still worked.
The same archive passed local wrong/missing-key rejection before import,
refund/revocation, replacement-key, withdrawal and administration-receipt checks.
The synthetic capture contained 50 Store records, 41 authority rows and two
objects. The rehearsal took 221 seconds; this is not a production RTO. No live
payment or real email was sent. Source and target cleanup passed, and independent
Cloudflare reads found no leftover rehearsal Workers, KV namespaces or R2 buckets.

The signed native activation/reactivation follow-up is recorded above. Remaining
work includes capacity/abuse limits, peak-memory profiling and retention/recovery
objectives.
**Paid Entitle sales and scheduled licensing capture remain disabled.** Independent
final reads found no production licensing bindings or licensing capture opt-ins;
the existing ordinary backup schedule remains enabled. Production Worker metadata
is unchanged from this review-and-rehearsal task's baseline. No production writes,
secret rotation, paid launch or capture enablement were performed.

## November 7: provider follow-up and license administration

The administration phase is merged in
[Store PR #127](https://github.com/aindaco1/store/pull/127) at
`53f2bd03b56dacc3cb57c704502cbe0812160f4e` and
[private licensing PR #2](https://github.com/aindaco1/dust-wave-licensing/pull/2)
at `d224d6475144b80439b3f44f9bf93eb28aada324`. Review found no blocking issues;
there were no comments or unresolved review threads. Both merged trees match their
tested heads (`609cf0e3142b57c231159d2db88953c10a756d96` and
`a7af5349458bd533ddb97213cc4e1f7a6444f8f3`). Production has not been deployed.
The [Store Merge Smoke run](https://github.com/aindaco1/store/actions/runs/42441774011)
passed all phases on the reviewed Store head; the
[licensing Feasibility checks](https://github.com/aindaco1/dust-wave-licensing/actions/runs/42441748936)
also passed on the reviewed authority head. Protected recovery run
[42453190850](https://github.com/aindaco1/store/actions/runs/42453190850)
passed against both merged commits using the existing protected environment and
its normal reviewer approval. The downloaded evidence artifact's SHA-256 matched
GitHub's published digest. It confirms `remoteArchive:true`, deployed-source
drain/freeze/resume, encrypted off-account upload/download and verification,
separate empty-target restore, full logical/KV/R2 readback and retry safety.
The same downloaded archive passed the local old-key/token denial, replacement-key
recovery, withdrawal and administration-receipt checks. The deployed target also
passed acceptance-lock, activation/seat, coverage/refund/revocation, signed-download
and duplicate-mail checks. The synthetic capture contained 50 Store records,
41 authority rows and two artifact objects; no live payment or email was sent.

The rehearsal itself took 224 seconds (synthetic timing, not a production RTO).
Both source and target cleanup passed. Independent Cloudflare reads found no
rehearsal Workers, KV namespaces or R2 buckets. Production Worker metadata and
disabled licensing bindings were unchanged; repository/production-backup licensing
capture opt-ins remained unset. Existing ordinary backups and archive retention
were untouched. The sanitized receipt is retained as workflow artifact
`software-recovery-42453190850` and in the local review/rehearsal task evidence.
**Paid Entitle sales, production licensing and scheduled licensing
capture remain disabled.** No Platform runtime package or pin changed.

The full sandbox acceptance now observes a fresh signed paid-event replay receipt,
then verifies no duplicate fulfillment or mail. Three approved-recipient Resend
messages were verified delivered. It also reproduced the early declined-payment
409 as a stale pre-provider KV checkpoint. Store now resolves a missing payment
identity from its existing checkout Durable Object, preserving strict identity,
amount and currency validation. A fresh deployed checkout-only run verified the
patched decline handler returned 200, authenticated 3DS settled once, and a later
signed decline replay returned 200 without additional fulfillment or emails.
Temporary resources were cleaned; production metadata and disabled opt-ins stayed
unchanged. Receipt visibility still uses bounded polling rather than assuming KV
read-after-write consistency.

Schema 4 adds authority-owned atomic key replacement, per-device revision
tombstones, all-seat resets, release withdrawal and immutable operation receipts.
Store reuses its key derivation secret, order capabilities, admin roles/CSRF,
audit and localized UI. Customer invoices and operator/authority histories use
bounded cursor pages. Withdrawal blocks lists, feeds, GET/HEAD/range delivery while
retaining artifacts. Installed software remains usable when coverage ends.

The local encrypted restore rehearsal now preserves replacement keys, device
revocations, withdrawn releases and receipts. It passed archive verification,
empty-target quarantine, artifact readback and provider reconciliation using
synthetic data: 50 Store records, 41 authority rows, two artifacts, zero external
requests/payments/emails. Schema 3 archives remain importable. Deploy the schema 4
reader before the Store changes; retain that reader on rollback once upgraded.

Store's full pre-merge gate passed (872 unit tests, seven payment contracts,
22 security tests, 111 browser tests and all build/resource/Worker checks), followed
by 74 final focused tests. Licensing passed 14 Worker/SQLite tests and its dry-run
build. All nine final management UI tests passed, including withdrawal retries and
invoice/operator pagination. Platform passed 397 tests and both clean-checkout
recipes; these execution-doc changes remain local. Store's
`docs/release-evidence/2026-11-07-license-administration.md` and JSON
record the diagnostic/fixed provider runs, restore evidence and rollback limits.
Original dirty Store work remains preserved (105 file hashes unchanged).

Next: complete production secret recovery/rotation and capacity/retention
acceptance while keeping both opt-ins disabled. Dispute policy, pricing/support decisions and
ASCII distribution/source/font/release-signing acceptance remain separate gates.
Keep VCR OSD Mono retained pending redistribution evidence. No paid launch or
scheduled licensing capture is authorized by completion of this phase.

## November 7: Stripe browser/webhook and Resend acceptance

An isolated private Cloudflare fixture exercised Store's real checkout, billing,
customer-management renderer and existing Resend outbox against Stripe test mode.
The browser displayed an initial decline, completed a provider-authenticated 3DS
challenge for one $60 merch/ticket/software purchase, saved replacement cards on
Stripe Checkout, and paid the original declined $11 renewal on its hosted invoice
page. Public signed webhook handling added coverage once; Store showed both
invoices paid and the additional coverage period. Renewal tax was recalculated,
and one-time items were excluded.

Three approved-recipient messages (license, failure, renewal) were independently
verified as delivered in Resend, with test labels, HTML/text, existing sender and
reply-to, and private management links. This proves provider delivery; inbox
rendering/opening was not observed. Stripe accepted paid-event redelivery and
subsequent payment/mail counts did not increase. The final harness adds a stronger
fresh-receipt timestamp assertion, covered by focused tests but added after the
provider run; the evidence preserves that distinction.

All disposable Workers/KV and the test webhook/clock/customer were removed; owned
provider catalog entries were deactivated. Production Worker metadata and licensing
flags were unchanged, and repository/production-backup licensing opt-ins remained
unset. No shared runtime release, package pin, production deployment, production
catalog or schedule changed. **Paid Entitle sales, production licensing and
scheduled licensing capture remain disabled.**

Store's `experiments/software-licensing/ACCEPTANCE.md` is the repeatable manual
procedure; `docs/release-evidence/2026-11-07-licensing-provider-acceptance.md` records
the observed scope, transient declined-webhook rejection, receipt visibility,
cleanup and remaining boundaries. It uses the existing preview lifecycle with an
optional no-R2 fixture and no second billing/email implementation. Work is in the
isolated `licensing-provider-acceptance/store` checkout; original dirty Store work
remains preserved. Store changes are merged in [PR #126](https://github.com/aindaco1/store/pull/126)
at `982e165a9f04fea868d35a5697a60426af592d29`. The [hosted Merge Smoke run](https://github.com/aindaco1/store/actions/runs/42437544370)
passed every pre-merge phase on head `4bd84683519443411f55693ca8a68d7872fd7b95`;
there were no review comments or CI failures requiring changes. The isolated Store
checkout now tracks merged main. This merge does not trigger production deployment.
Production Worker metadata and disabled licensing/backup opt-ins were rechecked.
Local validation passed: the full Store pre-merge gate including 109 browser/22 security tests,
final 865 unit tests/seven contracts, 31 focused tests and encrypted local restore;
Platform passed 397 tests and two clean-checkout recipes. These Platform execution
doc changes remain local.

At this earlier checkpoint, next work was bounded key/device/release controls, operator-history and dispute
policy, pricing/support decisions, production recovery/capacity acceptance, and
ASCII VJ distribution/source/signing gates. Keep VCR OSD Mono retained pending
redistribution evidence. Neither paid launch nor scheduled licensing capture is
authorized by completing these acceptance tests.

## November 7: deployed-source recovery completed

The consumer changes are merged in [Store PR #125](https://github.com/aindaco1/store/pull/125)
and [private licensing PR #1](https://github.com/aindaco1/dust-wave-licensing/pull/1).
The [protected deployed-source rehearsal](https://github.com/aindaco1/store/actions/runs/42433946666)
passed on Store `eb9ed3e60d2feb840536b2e873490dd9e14f4bab` and reviewed licensing
`6776d36718f26aee3b03a725986fd9b3bd20cd38`. This supersedes earlier publication,
archive and deployed-source prerequisites below. The earlier stopped-source
[protected run](https://github.com/aindaco1/store/actions/runs/42430004952) remains
baseline evidence, not the result for these new controls.

Dedicated test sources now use bounded persistent admissions. Store stops new
requests and scheduled/alarm work, waits for admitted work including deferred
writes, then licensing stops its intake. Capture requires matching frozen
checkpoints and unchanged source generations. Freeze survives redeployment;
resume opens licensing before Store and is idempotent. Orphaned admissions fail
closed and require investigation; they never expire into a false checkpoint.

The protected run captured deployed fixture KV/downloads, Store journals,
licensing authority and signed artifacts, then verified the existing encrypted
off-account upload/download, checksums, decryption, separate-target restore and
license/access/replay rules. Source resume and both cleanup phases passed.
Independent provider reads confirmed no rehearsal Workers, KV namespaces or R2
buckets remained, and production Worker metadata/configuration was unchanged.
The run recorded zero live payments, real emails or production writes.
Measured source drain was 3.2 seconds, archive round trip 4.5 seconds, target
restore/readback 38.0 seconds and total exercise 206.2 seconds. These synthetic
fixture measurements do not establish production RPO/RTO.

Validation passed: Store's complete local gate (855 unit, seven payment contracts,
22 security and 109 browser tests plus audit/build/Worker checks), final GitHub
merge gate, licensing's 11 tests/build and CI, and Platform's 397 tests/two
clean-checkout recipes. Store's
`docs/release-evidence/2026-11-07-deployed-source-recovery.md` records the pre-merge
preview; PR #125 links final protected acceptance and exact revisions.
The existing fixture, export/import, encryption, archive and resource lifecycle
owners are reused. No shared Platform runtime release or consumer pin changed.

**Paid Entitle sales, production licensing and scheduled licensing capture remain
disabled.** Repository, production-backup and recovery-environment licensing
opt-ins were unset after the run. The manual workflow retains its required
reviewer and main-only boundary. Original dirty Store work remains preserved in
iCloud; merged Store work is in the isolated checkout. The clean licensing
checkout was fast-forwarded to its reviewed merge. These Platform execution docs
are local changes, with no production deployment implied.

At the deployed-source checkpoint, next work without paid enablement was:

1. Complete Stripe browser/webhook and approved-recipient Resend acceptance.
   The newer record above now supplies that sandbox evidence and its limits.
2. Finish bounded key/device/release operator controls and history/dispute policy,
   source-key recovery arrangements and capacity/abuse measurements. A guarded
   synthetic source does not prove safe production drain or general transactional
   KV/inventory capture; those require their own reviewed scope and acceptance.
3. Close ASCII VJ distribution/source/signing gates. Volver Health Developer ID
   credential-retention acceptance already passed; VCR OSD Mono remains retained
   pending redistribution evidence. Paid sales and scheduled licensing capture
   each require separate authorization and remain off throughout this work.

## Earlier November 7 checkpoint: preview recovery continuation

Store now extends the existing logical restore with an explicitly isolated
Cloudflare preview target, dedicated bindings/origins, provider namespace ownership
and authenticated identity checks before writes. The local and deployed synthetic
rehearsals share the same fixture, capture, encryption, verifier and restore code.
Production software restore and paid checkout remain disabled.

The manual `Rehearse Software Recovery` workflow uses Store's existing protected
`production-recovery` environment, age identity and separate-account archive bucket.
Synthetic ciphertext/receipts use a sibling rehearsal prefix and are retrieved
before restoration; they cannot replace the latest production-backup selection.
The user explicitly chose the protected GitHub environment for archive credentials.
No new scheduler, encryption implementation, bucket or credential store was added.

At this earlier checkpoint, the protected archive leg required the reviewed
Store workflow on main and an accessible immutable licensing-consumer commit.
The licensing consumer then had no remote/committed release; publication/review
and environment approval were still open. The current result above supersedes
those prerequisites.
The final Cloudflare preview-only rehearsal passed with complete logical/KV/R2
readback, locked redeployment, explicit synthetic acceptance, unchanged license
access rules, no payment/email replay and verified resource cleanup. Store's full
pre-merge gate passed (848 unit tests, 109 browser tests and all remaining phases),
as did licensing's 10 tests/build and Platform's 397 tests/two recipes. This does
not close the protected remote-archive leg.
See Store's `docs/release-evidence/2026-11-07-software-recovery-preview.md` for final
local/deployed results and limitations. Production capture remains opt-in off.

## Prior task: management UI and merge gates

Requested November 4: resolve Store's gate findings and implement customer
license management/payment recovery plus operator issuance/refund/recovery UI.
Reuse private order access, admin sessions, billing authority and Resend. Keep
ASCII VJ paid offers unpublished and all licensing runtime test-only. Preserve
existing work; no production deployment, live charges or real email sends.

Acceptance: narrow secret-audit remediation with credential regression tests;
customer ownership/origin/expiry and admin role/CSRF checks; accessible English/
Spanish management UI; provider-verified recovery of the original invoice;
bounded status/download projections; full pre-merge attempt and actual browser
checks. Keep outstanding launch acceptance explicit.

### Implementation outcome

Local test-only customer license/library/download/payment recovery and operator
complimentary/paid-order/refund controls are implemented in Store. They reuse
private order capabilities, admin sessions/CSRF, the per-order billing owner,
existing styles/i18n and Resend. Licensing shares its existing entitlement check
across app and customer downloads. The public-key secret-audit false positive,
duplicate CSS budget cost, mobile order-token overflow and heading semantics were
remediated without weakening credential detection or increasing budgets.

Focused browser and access/retry tests pass. Store has 838 passing unit tests,
seven payment contracts and 22 runtime security tests. The actual-Worker Stripe
test-mode probe passed with no cleanup errors, including setup-session ownership
and stale customer-download denial after refund. The complete Store pre-merge gate passed, including all 109 browser tests.
Licensing passed nine workerd tests and its dry-run build; Platform passed 397
tests and both clean-checkout recipes. Final evidence is recorded in Store's `docs/release-evidence/2026-11-04-license-management.md`.
No paid catalog product, production enablement, live payment or real email was
introduced. Historical gate/UI statements below describe prior checkpoints;
this section and the newest Store evidence supersede them.

## November 4 completed slice: existing backup integration

The owner requested reuse of Store's existing capture workflow, snapshot tool
and pinned Platform archive runner. The completed scope adds logical exports of
Store billing/complimentary Durable Objects, licensing SQLite state and artifacts,
plus consumer-specific restore/reconciliation in an isolated rehearsal. Raw
inventory Durable Object imports remain excluded. No second scheduler, encryption
implementation, destination or credential store was added. See the backup scope
in `software-licensing-plan.md`.

Implemented locally November 4: versioned Store/authority exports and isolated
imports now extend the existing encrypted snapshot/restore path. The actual
Worker rehearsal restored mixed purchase/renewal/refund/activation state, verified
signed artifacts and retained seats/revocations without charges or emails. Capture
uses read-only credentials; mutation credentials stay outside scheduled capture.
Checkpoint capture requires drained source Workers; restored targets stay locked
until explicit acceptance. Paid checkout and production licensing remain disabled.
Store owns the operator procedure and `docs/release-evidence/2026-11-04-software-backup.md`.
Remote archive upload and deployed restore were not exercised at that local
checkpoint; the current November 7 results above supersede it. Future live
quiescence/RPO acceptance and the other launch gates remain separate.

The completed results were reconciled into this restored checkout on November 5.
The outside-iCloud recovery copies are retained; no Platform runtime, package
release or consumer submodule pointer changed.

## Prior task: Store paid fulfillment

Requested November 4: wire Store combined checkout, paid licenses, renewals and
item-scoped refunds. Keep canonical catalog, billing, durable financial records,
notification retries and authorization in Store; keep release eligibility in the
licensing consumer. Reuse the existing checkout/inventory and Resend owners.
Preserve all prior uncommitted work and unrelated configuration. No live charges,
production deployment, real-recipient email or public app release is in scope.

Acceptance: canonical catalog snapshots and totals; one initial payment; no
one-time fulfillment on renewal; duplicate/out-of-order settlement and refund
recovery; independent coverage revocation; failed email independent of grants;
existing checkout regression checks, real workerd coverage checks, guarded Stripe
test-mode verification and the required repository gates. Current work is local
and test-mode guarded until the documented production gates close.

### Paid runtime outcome

Implemented locally on November 4. Store now routes repository-authored paid
offers through its existing cart, inventory coordinator, Stripe client and
Resend outbox. It owns per-order immutable receipts, balanced cent postings,
invoice tax snapshots, durable coverage commands and scoped refund allocation.
Licensing schema 3 owns the union of non-refunded periods under a stable key.
No new Platform runtime package or Entitle compatibility claim was introduced.

The owner confirmed recalculation of tax at each renewal. Future provider
invoices stay in draft even during an outage; Store verifies tax before
finalizing and paying that specific invoice. A four-day outage/missed-notification
probe passed, followed by bounded invoice discovery and collection. Installed
use remains independent of update coverage. Coupons on the first payment only
and separate refund/cancellation actions remain provisional defaults.

- Store: 818 unit tests plus seven payment contracts passed; two desktop/mobile
  browser cases and screenshot inspection passed. Jekyll, localization and
  storage inventory checks passed.
- Actual local Workers + Stripe test mode: all three one-time policies, a
  $167.80 mixed monthly/annual + merch + ticket payment, an $11 monthly renewal
  including recalculated tax, missed-event recovery, duplicate/stale events,
  scoped refund/private-download denial and declined/SCA-required cancellation
  passed. Resend dry-run sent eight messages and zero on replay. Provider cleanup
  reported no errors. No real email or live payment occurred.
- Licensing: nine workerd tests and dry-run bundle passed. Platform: 397 tests
  and both clean-checkout recipes passed. Platform changes remain documentation.
- Store's full pre-merge gate still stops on existing test publishable-key
  matches in three unrelated Wrangler configuration files. No gate bypass or
  configuration cleanup was performed. Actual browser SCA, public webhook
  delivery, customer/admin recovery UI, dunning/disputes, independent encrypted
  restore and the existing app distribution/launch gates remain open.

The consumer's `docs/release-evidence/2026-11-04-paid-software-billing.md` and
`docs/SOFTWARE_LICENSING.md` own executable commands and rollout/rollback details.
This completes the requested local paid-runtime slice, not all phase-3 UI or
production launch. No commit, deployment or public app release was performed.

## Earlier implementation history

Started November 4, 2026. Scope: ASCII VJ distribution remediation; Resend plan;
isolated Cloudflare and Store combined-payment feasibility. No production
checkout changes, live payments or app publication. Isolated test deployment
and verified cleanup are included in the continuation below.

Baseline: Platform d33b417; ASCII VJ eebf5bd; Store 5e8d27f.
Preserve existing draft docs and unrelated Store generated/config changes.

Acceptance: behavior tests for missing/tampered notices and source bundles;
local packaging validation; real workerd SQLite/R2 concurrency, restart and
private-download tests; combined initial payment and recurring-only renewal
probe; existing repository checks appropriate to changes. Distinguish local
runtime and Stripe test-mode evidence from production acceptance.

Consumer ownership: app resources/build/release code stays in ASCII VJ;
checkout experiments stay in Store; licensing Worker stays in the separate
dust-wave-licensing consumer. Extract no uncharacterized Platform module.

Current continuation (November 4): complete remaining feasibility probes and
implement a test-mode complimentary license through Store, Resend and the
ASCII VJ Rust updater. Isolated synthetic Cloudflare deployment is in scope;
production checkout, paid publication and real-recipient emails remain gated.
The restored R2 write permission and existing Wrangler login enabled the
isolated deployed probe. Signed 160 MiB streaming, actual PITR/revocation replay,
R2 recovery and the feed burst passed; temporary Worker/bucket absence is verified.
See the licensing consumer's `docs/FEASIBILITY.md` and redacted evidence files.

Status at the start of this continuation: the first local implementation slice is in place. No commit, deployment,
email delivery or app release was performed. Phases 1 and 1b remain open until
their remaining consumer/provider acceptance gates pass.

## Implemented

- ASCII VJ: one generated legal-resource collection, original app/font/FFmpeg/
  NDI/Syphon/Platform notices, conservative locked Cargo/npm dependency notices
  and source snapshots, exact FFmpeg source/build records, per-target source
  archives with manifests/hashes, offline legal panel, packaged-byte checks and
  release workflow integration. Public-domain footage attestation is recorded.
  Linux captures distro sources and requires separate AppImage runtime source
  provenance. VCR OSD Mono remains, per user decision, pending redistribution
  evidence. See the consumer's `docs/RELEASING.md` for commands and open gates.
- New local `dust-wave-licensing` consumer: SQLite Durable Object authority,
  atomic seats, idempotent grants, term/major/lifetime coverage, activation,
  revocation, R2 version/ETag-bound private GET/HEAD/range delivery and a strict
  test-mode guard. It pins Platform's full commit and worker-core 0.16.0. It is a
  feasibility API; no Entitle server code/protocol has been adopted yet.
- Store: isolated canonical-snapshot-to-subscription-invoice experiment and a
  test-only Stripe probe using the existing pinned client. The production
  checkout is unchanged. Real provider tests found that recurring invoice lines
  require a persisted subscription-item-to-order-line mapping; the experiment
  now enforces it instead of assuming item metadata appears on invoice lines.
- Execution plan: existing Resend account, verified Store sender and Store-owned
  templates/outbox/receipts; durable licensing event handoff, no parallel SMTP
  stack, duplicate-send handling beyond Resend's 24-hour key window, and email
  failure independent of paid fulfillment. No messages sent.

## Observed checks

| Owner | Evidence on November 4, 2026 |
| --- | --- |
| Platform | `npm test`: 397 tests plus both clean-checkout recipe checks passed on Node 26.12.1. |
| Licensing | Four tests passed against local workerd SQLite/R2: 24 concurrent final-seat attempts yield one winner; retry/restart, stopped-snapshot restore, coverage boundaries, wrong-product/tampered-token denial, revocation and changed-artifact denial. Wrangler dry-run bundle passed. |
| Store | Four isolated contract tests and 56 existing focused Stripe, inventory-hold, webhook-resume, email/outbox tests passed. Monthly and annual Stripe test-clock probes each produced one $50 initial payment for $25 merch + $15 ticket + $10 software, followed by a $10 software-only renewal. Duplicate create/refund calls reused IDs; partial refund succeeded; final cleanup had no errors. |
| ASCII VJ | `npm run check:release` passed its configured checks, including 93 Rust tests (two pre-existing opt-in tests remained ignored). Offline browser legal-panel smoke passed. An ad-hoc signed macOS development app built; 732 packaged legal files and FFmpeg source manifest matched. The 420-package macOS corresponding-source archive passed extracted digest/identity checks. This is not notarized/released/installed-app acceptance. |

Stripe connector reauthentication remained unavailable; the provider tests used
Store's existing local **test** key with a live-key rejection guard. No key or
real customer data was written to evidence. Detailed synthetic provider IDs are
in Store's `experiments/software-licensing/stripe-{month,year}-result.json`.

The complete Store `test:premerge` attempt stopped at its first secret-audit phase
on an existing test publishable-key match in the already-modified
`worker/wrangler.toml`. That unrelated change was preserved. The full gate has
not passed; the focused checks do not substitute for it.

## Next execution steps

1. Close distribution gates: retain VCR pending redistribution evidence; pin and
   rebuild/review the actual AppImage runtime and statically linked sources;
   exercise Windows/Linux extraction and notice/source checks on those hosts;
   verify public source URLs and signed/notarized release bytes before selling.
2. Finish Cloudflare feasibility: representative largest-artifact streaming,
   bounded package/signature validators, deployment CPU/memory/load measurement,
   production PITR/R2 restore and schema migrations. Local stopped-snapshot
   restore is not production disaster-recovery acceptance.
3. Finish combined-checkout feasibility in Store: Elements/SCA and declines,
   mixed monthly+annual items, shipping/tax/coupons, scarce inventory reservation
   and non-payable cancellation before release, replay/out-of-order webhooks,
   durable fulfillment intents and item refund/revocation accounting. Do not
   infer fulfillment behavior from Stripe's successful billing-only probe.
4. Implement the complimentary vertical slice, including durable Store/Resend
   event delivery and a real Rust activation/signed private-update journey.
   Keep installed functionality independent of coverage/network state.

No shared extraction, live prices or paid feed switch is appropriate yet. Each
consumer retains its own implementation, release authority and rollback path.

## Continuation: feasibility and complimentary slice

Implemented on November 4, 2026:

- Licensing: additive SQLite migrations (version table, legacy-row preservation,
  prior-schema revoke query, future-schema refusal); bounded semantic-version
  update feeds; explicit range validation; Worker streaming SHA-256/BLAKE2b and
  Ed25519 Minisign verification against an independent Tauri CLI fixture;
  160 MiB signed multipart-object delivery; verified R2 restoration/rebinding;
  isolated deployed multipart/PITR probe entry point.
- Store: authenticated/CSRF-protected test-only complimentary grant/recovery API;
  existing DO class in a distinct named object, durable intent/lease/due index,
  deterministic keys, lost-response replay and scheduled recovery; existing
  Resend outbox/templates/receipts with localized HTML/text and no real sends.
  Email failures retain grants. Wrong derivation secrets fail closed.
- Combined checkout: mixed monthly/annual real Stripe test invoice ($153.87,
  including fixture discount/shipping/tax), $10 monthly-only renewal; declined
  and SCA-required invoice PaymentIntents with cancellation to nonpayable state;
  injected subscription provider in the existing Store hold coordinator;
  stable invoice/line intent and item-refund contracts. Stripe seconds convert
  explicitly to licensing milliseconds. Production paid dispatch is not wired.
- ASCII: opt-in compile-time endpoint, Rust activation and private updater,
  Keychain token/installation persistence, no frontend tokens or token URLs,
  redirect/origin restrictions, prompt-free status/update checks, activation UI,
  existing update controller/install consent/progress/relaunch integration.
  Default public updater and installed-use policy are preserved. Debug-only
  synthetic-key smoke hook; no production credential or endpoint changes.

### Verification

| Check | Observed result |
| --- | --- |
| Platform | 397 tests and both clean-checkout recipes passed. |
| Licensing | Eight local workerd/signature/pin tests passed; final focused feed/migration/signature checks and Wrangler dry-run passed. Bundle 45.36 KiB before compression. |
| Store | 803 unit tests passed; seven isolated payment/fulfillment contract tests passed and are now part of `test:unit`; six complimentary and three subscription/hold tests included in the unit suite. |
| Stripe test mode | Monthly/annual prior probes, new mixed-cadence and decline/SCA probes passed; final probe cleanup has no errors. Existing local test key used because connector still requests reauthentication. No live payment or real customer data. |
| Cross-consumer runtime | Real local Store and licensing Workers passed admin/CSRF denial, repeated issuance, recovered key, R2 signature publication and one Resend dry-run handoff; second mail drain sent zero. |
| ASCII configured release checks | `npm run check:release` passed, including 95 Rust tests; two pre-existing opt-in native/TLS cases remained ignored. Final focused Rust endpoint/origin tests also passed. |
| Native signed install | Established Volver Health Developer ID identity: disposable app updated 1.3.2 → 1.3.3; 99,080,386 signed bytes installed in 7.89 s. Restart without resupplying a key asserted persisted activation and completed the authenticated feed check (161 ms). Expired-update denial and offline UI passed. New pilot packages were not notarized/published. |
| Cloudflare deployed | Signed 160 MiB publish/download/hash/HEAD/range, 24 final-seat attempts with one winner, 100 feed requests at concurrency eight, actual PITR/revocation reapplication and R2 tamper/restore passed. Large validation used 15,857 ms CPU; client feed p95 352 ms. Temporary Worker and bucket removed and absence verified. |

### Remaining acceptance and handoff

- Cloudflare pilot feasibility passed. Peak-memory profiling, sustained/abusive
  traffic, independent encrypted backups and retained source/artifact operations
  remain production gates. The validator now shares one measured 160 MiB bound
  and explicit 30,000 ms CPU limit; all eight local tests/build passed afterward.
  Live-tail metrics are sampled (93 captured invocations), not a complete ledger.
- Native credential-retention gate closed with the established **Developer ID
  Application: Volver Health LLC** identity, confirmed by the installed
  public 1.3.2 signature/Gatekeeper result and the owner. The original local
  certificate failed the standalone changed-binary Keychain test; Developer ID
  passed it and the actual app's install/restart test. Added a debug-only smoke
  assertion requiring persisted activation, with no key resupplied on restart.
  No Keychain controls were weakened. Redacted reports retain both attempts in
  ASCII's `docs/release-evidence/2026-11-04-private-update-pilot.json`.
  New pilot packages were not notarized; public release acceptance remains open.
  `check:desktop` and updater-policy tests passed again after this test change.
- Keychain status now runs off the WebView main thread so an explicit activation
  waiting on OS access cannot freeze rendering. Final `check:release` passed again
  (95 Rust tests; two existing opt-in tests ignored).
- Store: full `test:premerge` still stops at secret audit on the existing test
  publishable key in `worker/wrangler.toml` and the iCloud duplicate
  `worker/wrangler 2.toml`. Unrelated configuration was preserved. Unit tests do
  not substitute for that complete gate.
- Paid launch: real email recipient acceptance, native/platform signing,
  distribution rights/source gates, rate limits, credential rotation, release
  withdrawal, encrypted independent backups and paid fulfillment/refund
  reconciliation remain required. VCR OSD Mono is retained pending evidence.

No commit, production deployment, live price, real email or paid app release was
performed. Store and licensing flags fail closed outside test mode. Platform
has documentation changes only; no shared extraction or package release occurred.


Final local validation: Store's complete pre-merge gate passed (844 unit tests,
seven payment contracts, 22 security tests, 109 browser tests and all build/runtime
checks). Licensing passed 10 tests and its dry-run build. Platform passed 397 tests
and both recipes before the checkout disappeared. Final focused export/privacy
checks and the encrypted actual-Worker rehearsal passed after the final changes.
See Store's November 4 software-backup evidence for boundaries and retained logs.
