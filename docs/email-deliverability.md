# Email deliverability

This policy applies to application-generated mail. Content, templates, recipients, sender identity and marketing consent remain owned by each product. It is not a promise of inbox placement.

## Authentication and transport

Use a verified sending domain with aligned SPF and DKIM, a valid DMARC policy, and TLS. Inspect a received message as well as provider verification: DNS status alone does not prove authentication on the actual delivery path. Provider-managed IPs own forward/reverse DNS. Keep the sending domain related to the product's real website; use purpose-specific subdomains when introducing a new stream. Do not rotate domains to evade filtering.

Do not tighten an existing shared root domain's DMARC policy until every legitimate sender has been checked. Start with monitoring and progress to enforcement with evidence. Resend's default 1024-bit DKIM meets its supported provider requirements; rotating only DNS cannot upgrade the provider's signing key.

## Preserve content and make replies work

Supply both HTML and plain text when the product has HTML, preserving its authored content and localization. Plain-text-only operational mail is also valid. Keep existing sender names, subjects, attachments and unsubscribe controls. Use a monitored reply address supplied by consumer configuration; do not invent an address in a shared package.

Worker Core's `prepareResendEmail(payload, { replyTo })` adds missing delivery headers while preserving content, explicit reply addresses and list-unsubscribe headers. Cloudflare senders can use `automaticEmailHeaders(headers)` without changing transports. Apply preparation before the first attempt is frozen in durable storage. Never alter an already attempted payload under the same provider idempotency key.

Open/click tracking should be disabled unless a product has a specific justified requirement. Prefer full direct URLs; preserve legitimate meeting and external-reference links instead of disguising them with redirects. Keep transactional messages about the requested transaction. Marketing requires consent, visible unsubscribe controls, the applicable one-click headers, and suppression; a header helper cannot supply those policies.

## Suppression and retries

Reuse provider suppression for hard bounces and spam complaints. Never clear suppression automatically. Products with campaign/global preferences must continue enforcing them before enqueueing. Resend maintains its suppression list automatically; Cloudflare senders retain their binding restrictions and delivery-event handling.

Classify permanent rejections separately from temporary/network failures. Honor Retry-After, use bounded retries, and preserve the original payload and idempotency key. After the provider's deduplication window, stop uncertain automatic sends and require reconciliation. API acceptance, recipient-server delivery, inbox placement and reading are separate states.

## Verification and rollout

1. Inventory each consumer's sender, transport, reply address, HTML/text, tracking, suppression, retry and delivery-event behavior using source and live provider configuration.
2. Characterize existing payloads. Prove that a header-only change leaves subjects, bodies, recipients, attachments and unsubscribe behavior unchanged.
3. Pin an immutable compatible Platform release; run the consumer's required checks and retain its rollback pin.
4. Deploy each consumer independently. Send only to explicitly authorized test recipients, and inspect actual received authentication and reply headers. Do not trigger marketing campaigns or live transactions to test infrastructure.
5. Record source/local, CI, deployment, provider and recipient evidence independently. Keep private account inventories and recipient data out of public repositories.

At low sending volumes, reputation dashboards can have insufficient data. Record that limitation; do not manufacture traffic for warm-up. A spam-folder placement with passing authentication requires evidence about sender reputation and recipient filtering, not speculative DNS edits.

## Sources

- [Gmail sender guidelines](https://support.google.com/mail/answer/81126?hl=en)
- [Resend deliverability insights](https://resend.com/docs/dashboard/emails/deliverability-insights)
- [Resend suppression behavior](https://resend.com/docs/knowledge-base/why-are-my-emails-landing-on-the-suppression-list)
- [Resend transactional and marketing unsubscribe guidance](https://resend.com/docs/knowledge-base/should-i-add-an-unsubscribe-link)
- [Resend DMARC rollout](https://resend.com/docs/dashboard/domains/dmarc)
- [Resend supported DKIM key length](https://resend.com/docs/knowledge-base/do-i-need-2048-dkim)
- [Automatic-message headers, RFC 3834](https://datatracker.ietf.org/doc/html/rfc3834)
