// Apply before freezing an outbox payload. Never change a previously attempted message.
export function automaticEmailHeaders(headers = {}) {
  const result = { ...headers };
  for (const [name, value] of Object.entries(result)) {
    if (!/^[A-Za-z0-9-]+$/.test(name) || typeof value !== 'string' || /[\r\n\0]/.test(value)) {
      throw new TypeError('invalid_email_header');
    }
  }
  if (!Object.keys(result).some(name => name.toLowerCase() === 'auto-submitted')) {
    result['Auto-Submitted'] = 'auto-generated';
  }
  return result;
}

// Recipient policy, templates, consent, storage, and delivery remain consumer-owned.
export function prepareResendEmail(payload, { replyTo = '' } = {}) {
  if (typeof replyTo !== 'string' || /[\r\n\0]/.test(replyTo)) throw new TypeError('invalid_email_header');
  const headers = automaticEmailHeaders(payload.headers);
  const hasReplyHeader = Object.keys(headers).some(name => name.toLowerCase() === 'reply-to');
  return {
    ...payload,
    ...(!payload.reply_to && !hasReplyHeader && replyTo.trim() ? { reply_to: replyTo.trim() } : {}),
    headers
  };
}
