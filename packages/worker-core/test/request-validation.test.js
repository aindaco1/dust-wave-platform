import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RequestValidationError,
  boundedPageSize,
  isTruthy,
  optionalText,
  positiveInteger,
  readBoundedBytes,
  readBoundedText,
  readJsonObject,
  readOptionalJsonObject,
  requiredText,
  safeFilename,
  validDateTime,
  validIdentifier,
  validSlug
} from '../src/request-validation.js';

test('bounds streamed request bytes and cancels after crossing the limit', async () => {
  const encoder = new TextEncoder();
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('{"value":"'));
      controller.enqueue(encoder.encode('x'.repeat(100)));
    },
    cancel() {
      cancelled = true;
    }
  });
  const request = new Request('https://worker.example', {
    method: 'POST',
    body,
    duplex: 'half'
  });
  request.headers.delete('content-length');

  await assert.rejects(readBoundedText(request, 20), {
    name: 'RequestValidationError',
    message: 'Request body is too large',
    code: 'body_too_large',
    status: 413
  });
  assert.equal(cancelled, true);
});

test('rejects an oversized declared length without consuming the body', async () => {
  const request = new Request('https://worker.example', {
    method: 'POST',
    headers: { 'content-length': '21' },
    body: new Uint8Array([1])
  });
  await assert.rejects(readBoundedBytes(request, 20, 'Upload'), {
    message: 'Upload is too large',
    code: 'body_too_large',
    status: 413
  });
  assert.equal(request.bodyUsed, false);
});

test('returns exact binary bytes and measures UTF-8 bytes', async () => {
  const expected = new Uint8Array([0, 255, 1, 128]);
  assert.deepEqual(
    await readBoundedBytes(new Request('https://worker.example', {
      method: 'PUT',
      body: expected
    }), expected.byteLength),
    expected
  );
  const unicode = new Request('https://worker.example', {
    method: 'POST',
    body: '🌊'
  });
  unicode.headers.delete('content-length');
  await assert.rejects(readBoundedText(unicode, 3), { status: 413 });
  await assert.rejects(readBoundedBytes(unicode, -1), TypeError);
});

test('reads required and optional JSON objects with stable failures', async () => {
  assert.deepEqual(
    await readJsonObject(new Request('https://worker.example', {
      method: 'POST',
      body: '{"ok":true}'
    })),
    { ok: true }
  );
  assert.deepEqual(
    await readOptionalJsonObject(new Request('https://worker.example', {
      method: 'POST',
      body: '  '
    })),
    {}
  );
  await assert.rejects(
    readJsonObject(new Request('https://worker.example', {
      method: 'POST',
      body: '[]'
    })),
    { message: 'A JSON object is required', code: 'invalid_request', status: 400 }
  );
});

test('preserves scalar normalization and failure semantics', () => {
  assert.equal(requiredText(' title ', 'title', 5), 'title');
  assert.equal(optionalText(null, 'summary'), '');
  assert.throws(() => requiredText(' ', 'title'), /title is required/);
  assert.throws(() => optionalText('long', 'summary', 3), /summary is too long/);
  assert.equal(validSlug(' My-Episode '), 'my-episode');
  assert.throws(() => validSlug('two words'), /slug must be URL-safe/);
  assert.equal(validIdentifier('Episode_12', 'episodeId'), 'Episode_12');
  assert.throws(() => validIdentifier('-bad', 'episodeId'), /episodeId is invalid/);
  assert.equal(
    validDateTime('2026-08-06T10:30:00-07:00', 'publishAt'),
    '2026-08-06T17:30:00.000Z'
  );
  assert.equal(validDateTime('', 'publishAt'), null);
  assert.throws(() => validDateTime('tomorrow-ish', 'publishAt'), /ISO date-time/);
  assert.equal(safeFilename('Ｆoo / bar?.mp3'), 'Foo-bar-.mp3');
  assert.throws(() => safeFilename('..'), /filename is invalid/);
  assert.equal(positiveInteger('4', 'count', 5), 4);
  assert.throws(() => positiveInteger(6, 'count', 5), /positive integer/);
  assert.equal(boundedPageSize(null, 25, 100), 25);
  assert.equal(boundedPageSize('100', 25, 100), 100);
  assert.throws(() => boundedPageSize('101', 25, 100), /between 1 and 100/);
  assert.deepEqual(
    ['1', 'true', 'TRUE', ' yes ', 'on', undefined, 'off'].map(isTruthy),
    [true, true, true, true, true, false, false]
  );
});

test('exposes a stable validation error class', () => {
  const error = new RequestValidationError('Nope', 'custom', 422);
  assert.equal(error.name, 'RequestValidationError');
  assert.equal(error.message, 'Nope');
  assert.equal(error.code, 'custom');
  assert.equal(error.status, 422);
});
