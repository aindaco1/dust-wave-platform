import assert from 'node:assert/strict';
import test from 'node:test';
import { automaticEmailHeaders, prepareResendEmail } from '../src/email.js';

test('preserves message content, recipients, attachments and list-unsubscribe behavior', () => {
  const payload = { from: 'Brand <updates@example.test>', to: ['reader@example.test'], subject: 'Original subject', html: '<p>Original content</p>', text: 'Original content', attachments: [{ filename: 'receipt.pdf', content: 'fixture' }], headers: { 'List-Unsubscribe': '<https://example.test/unsubscribe>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } };
  const snapshot = JSON.stringify(payload);
  const result = prepareResendEmail(payload, { replyTo: 'support@example.test' });
  assert.equal(JSON.stringify(payload), snapshot);
  for (const key of ['from','to','subject','html','text','attachments']) assert.deepEqual(result[key], payload[key]);
  assert.deepEqual(result.headers, { ...payload.headers, 'Auto-Submitted': 'auto-generated' });
  assert.equal(result.reply_to, 'support@example.test');
  assert.deepEqual(prepareResendEmail(result, { replyTo: 'other@example.test' }), result);
});

test('respects explicit reply addresses and case-insensitive existing headers', () => {
  assert.equal(prepareResendEmail({ reply_to: ['creator@example.test'] }, { replyTo: 'support@example.test' }).reply_to[0], 'creator@example.test');
  const headers = { 'auto-submitted': 'auto-replied', 'Reply-To': 'creator@example.test' };
  assert.deepEqual(automaticEmailHeaders(headers), headers);
  assert.equal(prepareResendEmail({ headers }, { replyTo: 'support@example.test' }).reply_to, undefined);
  assert.equal(prepareResendEmail({}).reply_to, undefined);
});

test('rejects multiline header defaults without rewriting authored content', () => {
  assert.throws(() => prepareResendEmail({}, { replyTo: 'support@example.test\r\nBcc: other@example.test' }), /invalid_email_header/);
  assert.throws(() => automaticEmailHeaders({ 'X-Test': 'value\nBcc: other@example.test' }), /invalid_email_header/);
});
