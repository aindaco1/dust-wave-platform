import assert from 'node:assert/strict';
import test from 'node:test';
import { readBoundedBytes, readBoundedJson, readBoundedText } from '../src/response-body.js';
import { timingSafeEqual, timingSafeEqualText, sha256BytesHex, sha256Hex } from '../src/crypto.js';

test('response readers preserve byte boundaries, UTF-8 chunks, empty bodies and JSON errors', async () => {
  const body = new ReadableStream({ start(c) { c.enqueue(new Uint8Array([0xc3])); c.enqueue(new Uint8Array([0xa9])); c.close(); } });
  assert.equal(await readBoundedText(new Response(body), 2), 'é');
  await assert.rejects(readBoundedText(new Response('é'), 1), /Response exceeded 1 byte cap/);
  assert.deepEqual(await readBoundedBytes(new Response(null), 0), new Uint8Array());
  assert.deepEqual(await readBoundedJson(new Response('[]'), 2), []);
  await assert.rejects(readBoundedJson(new Response('x'), 1), SyntaxError);
});

test('response declaration policy accepts fractional numbers and propagates early cancellation failures', async () => {
  let cancelled = 0;
  const body = new ReadableStream({ cancel() { cancelled++; } });
  await assert.rejects(readBoundedBytes({ body, headers: new Headers({ 'content-length': '2.5' }) }, 2), /Response declared 2.5 bytes; cap is 2/);
  assert.equal(cancelled, 1);
  const failing = () => new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1, 2])); }, cancel() { throw new Error('cancel failed'); } });
  await assert.rejects(readBoundedBytes({ body: failing(), headers: new Headers({ 'content-length': '2' }) }, 1), /cancel failed/);
  await assert.rejects(readBoundedBytes(new Response(failing()), 1), /Response exceeded 1 byte cap/);
  const error = new Error('read failed');
  const broken = new ReadableStream({ start(c) { c.error(error); } });
  await assert.rejects(readBoundedBytes(new Response(broken), 4), candidate => candidate === error);
});

test('digest text comparison preserves newsletter semantics without changing synchronous token comparisons', async () => {
  for (const [left, right, expected] of [['', '', true], ['é', 'é', true], ['é', 'e', false], ['a', 'aa', false]]) {
    assert.equal(await timingSafeEqualText(left, right), expected);
  }
  assert.equal(timingSafeEqual('', ''), false);
  assert.equal(await sha256BytesHex(new TextEncoder().encode('café').buffer), await sha256Hex('café'));
});
