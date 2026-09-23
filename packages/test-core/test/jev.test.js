import assert from 'node:assert/strict';
import test from 'node:test';
import { createJevRequest, judgeJevResponse, callCloudflareJev, evaluateJevCases } from '../src/jev.js';

const policy = { minimumMargin: 0.1, models: ['jev-1.13.0'] };
const questions = { meaning: {} };
const raw = (probabilities = { pass: 0.9, fail: 0.09, uncertain: 0.01 }, model = 'jev-1.13.0') => ({
  model, answers: { meaning: { type: 'choice', choice: 'pass', probabilities } }, usage: { input_tokens: 123, output_tokens: 20 }
});
const cases = [{ id: 'synthetic', candidate: 'The operation is pending.', requirements: { meaning: 'Communicates pending state.' } }];

test('atomic request transmits candidate and questions, never consumer metadata', () => {
  const request = createJevRequest(cases[0].candidate, cases[0].requirements);
  assert.deepEqual(request.input.state, { candidate: cases[0].candidate });
  assert.match(request.input.questions.meaning.instructions, /facts appearing only in the reference or question do not count/);
  assert.equal(createJevRequest('Pendiente.', cases[0].requirements, { reference: 'Pending.' }).input.state.reference, 'Pending.');
  assert.throws(() => createJevRequest('Pending.', cases[0].requirements, { reference: '' }));
  assert.throws(() => createJevRequest('x'.repeat(32000), cases[0].requirements), /exceeds/);
  assert.throws(() => createJevRequest('', cases[0].requirements));
});

test('accepts direct, Cloudflare and completed wrapper responses', () => {
  for (const value of [raw(), { success: true, result: raw() }, { result: { state: 'Completed', result: raw() } }]) {
    assert.equal(judgeJevResponse(value, questions, policy).findings.meaning.decision, 'pass');
  }
});

test('near ties, exact ties, uncertainty and unknown models route to review', () => {
  assert.equal(judgeJevResponse(raw({ pass: 0.51, fail: 0.48, uncertain: 0.01 }), questions, policy).findings.meaning.decision, 'review');
  assert.equal(judgeJevResponse(raw({ pass: 0.5, fail: 0.5, uncertain: 0 }), questions, { ...policy, minimumMargin: 0 }).findings.meaning.decision, 'review');
  assert.equal(judgeJevResponse(raw(undefined, 'new-model'), questions, policy).findings.meaning.decision, 'review');
  const value = raw({ pass: 0.1, fail: 0.1, uncertain: 0.8 });
  value.answers.meaning.choice = 'uncertain';
  assert.equal(judgeJevResponse(value, questions, policy).findings.meaning.decision, 'review');
});

test('rejects partial, malformed, contradictory or failed provider evidence', () => {
  const bad = [null, { success: false }, { result: { state: 'Pending' } }, { ...raw(), usage: {} }, { ...raw(), answers: {} },
    raw({ pass: '0.9', fail: 0.09, uncertain: 0.01 }), raw({ pass: NaN, fail: 0.1, uncertain: 0 }),
    raw({ pass: 0.1, fail: 0.8, uncertain: 0.1 }), raw({ pass: 0.9, fail: 0.9, uncertain: 0.1 })];
  for (const value of bad) assert.throws(() => judgeJevResponse(value, questions, policy));
});

test('transport stays on Cloudflare, disables logging/cache and never follows redirects', async () => {
  let calls = 0;
  const options = { accountId: 'a'.repeat(32), token: 'fixture-credential', fetchTarget: async (url, init) => {
    calls++;
    assert.equal(new URL(url).hostname, 'api.cloudflare.com');
    assert.equal(init.redirect, 'manual');
    assert.equal(init.headers['cf-aig-collect-log'], 'false');
    assert.equal(init.headers['cf-aig-skip-cache'], 'true');
    assert.ok(init.signal);
    return new Response('secret provider body', { status: 302, headers: { location: 'https://untrusted.test' } });
  } };
  await assert.rejects(callCloudflareJev({}, options), /^Error: Cloudflare HTTP 302$/);
  assert.equal(calls, 1);
  await assert.rejects(callCloudflareJev({}, { ...options, fetchTarget: async () => { throw Error('fixture-credential'); } }), (error) => !error.message.includes('fixture-credential'));
  await assert.rejects(callCloudflareJev({}, { ...options, fetchTarget: async () => new Response('x'.repeat(1_000_001)) }), /invalid data/);
});

test('batch validates every case and budget before calling; dry runs never pass', async () => {
  let calls = 0;
  const call = async () => { calls++; return raw(); };
  await assert.rejects(evaluateJevCases([...cases, { ...cases[0], id: 'invalid', candidate: '' }], { policy, call }));
  await assert.rejects(evaluateJevCases(cases, { policy, call, maxQuestions: 0 }));
  assert.equal(calls, 0);
  const preview = await evaluateJevCases(cases, { policy });
  assert.equal(preview.complete, false);
  assert.equal(preview.networkAttempts, 0);
  assert.equal(preview.releaseAccepted, false);
});

test('batch keeps raw evidence, stops on error and never retries or reports a partial pass', async () => {
  const complete = await evaluateJevCases(cases, { policy, call: async () => raw() });
  assert.equal(complete.complete, true);
  assert.equal(complete.cases[0].result.findings.meaning.decision, 'pass');
  const partial = await evaluateJevCases([...cases, { ...cases[0], id: 'second' }], { policy, call: async () => ({}) });
  assert.equal(partial.complete, false);
  assert.equal(partial.networkAttempts, 1);
  assert.ok(partial.cases[0].raw);
  assert.ok(partial.error);
});
