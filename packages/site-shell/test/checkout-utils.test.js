import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidEmail, isPostalComplete, createDebouncedAction, createLatestCheck, createPaymentReveal, readDetailsSignature } from '../src/checkout-utils.js';
function clock() {
  let id = 0; const tasks = new Map();
  return { schedule(fn) { tasks.set(++id, fn); return id; }, cancel(id) { tasks.delete(id); },
    async tick() { const queue = [...tasks.values()]; tasks.clear(); await Promise.all(queue.map(fn => fn())); },
    get size() { return tasks.size; } };
}
test('email readiness rejects partial domains and overlong addresses, accepts plus aliases', () => {
  for (const value of ['', 'a@', 'a@example', 'a@example.', 'a b@example.com', 'a'.repeat(243) + '@example.com']) assert.equal(isValidEmail(value), false, value);
  for (const value of ['a@example.com', 'a+test@example.co.uk', 'a'.repeat(242) + '@example.com']) assert.equal(isValidEmail(value), true, value);
});
test('US ZIP readiness waits for complete ZIP5 or ZIP+4; international forms retain their own policy', () => {
  for (const zip of ['', '1046', '1046x', '10467-', '10467-1']) assert.equal(isPostalComplete('US', zip), false);
  for (const zip of ['10467', '10467-1234']) assert.equal(isPostalComplete('US', zip), true);
  assert.equal(isPostalComplete('CA', 'H2X 1Y4'), true);
});
test('preparation coalesces readiness checks and rechecks after edits; failures do not automatically retry', async () => {
  const time = clock(); let ready = true, calls = 0;
  const task = createDebouncedAction({ ...time, ready: () => ready, run: () => { calls++; ready = false; } });
  task.sync(); task.sync(); assert.equal(time.size, 1);
  ready = false; await time.tick(); assert.equal(calls, 0);
  ready = true; task.sync(); task.clear(); assert.equal(time.size, 0);
  task.sync(); await time.tick(); task.sync(); await time.tick(); assert.equal(calls, 1);
});
test('latest address check discards late replies, including A to B to A and resets', async () => {
  const time = clock(); const pending = []; const changes = [];
  const check = createLatestCheck({ ...time, request: () => new Promise(resolve => pending.push(resolve)), changed: state => changes.push(state) });
  check.update('A', {}); const first = time.tick();
  check.update('B', {}); check.update('A', {}); const last = time.tick();
  pending[0]({ stale: true }); await first; assert.equal(changes.length, 0);
  pending[1]({ current: true }); await last; assert.deepEqual(check.state.results, { current: true });
  check.update('B', {}); const reset = time.tick(); check.reset(); pending[2]({ stale: true }); await reset;
  assert.equal(changes.length, 1); assert.equal(check.state.pending, false);
});
test('lookup failure clears pending without inventing an address conflict', async () => {
  const time = clock(); const check = createLatestCheck({ ...time, request: async () => { throw Error('offline'); }, changed() {} });
  check.update('A', {}); await time.tick(); assert.deepEqual(check.state.results, {}); assert.equal(check.state.pending, false);
});
test('payment reveal scrolls only its container once, supports reduced motion, resets on navigation', () => {
  const calls = []; const target = { getBoundingClientRect: () => ({ top: 500 }) };
  const body = { scrollTop: 100, contains: node => node === target, getBoundingClientRect: () => ({ top: 50 }), scrollTo: value => calls.push(value) };
  const reveal = createPaymentReveal();
  assert.equal(reveal.reveal(body, {}), false);
  reveal.reveal(body, target); reveal.reveal(body, target);
  assert.deepEqual(calls, [{ top: 550, behavior: 'smooth' }]);
  reveal.reset(); reveal.reveal(body, target, true); assert.equal(calls[1].behavior, 'auto');
});
test('details signature includes values, consent and consumer-selected context', () => {
  const fields = [{ value: 'first@example.com' }, { type: 'checkbox', checked: false }];
  const before = readDetailsSignature(fields, { shippingOption: 'standard' });
  fields[0].value = 'next@example.com'; assert.notEqual(readDetailsSignature(fields, { shippingOption: 'standard' }), before);
  assert.notEqual(readDetailsSignature(fields, { shippingOption: 'express' }), readDetailsSignature(fields, { shippingOption: 'standard' }));
});
