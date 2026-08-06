import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createStorageShim,
  expectNoHorizontalOverflow,
  syncBrowserStorageGlobals
} from '../src/index.js';

test('provides the characterized browser Storage contract', () => {
  const storage = createStorageShim();
  assert.equal(storage.length, 0);
  assert.equal(storage.getItem('missing'), null);
  storage.setItem('one', 1);
  storage.setItem('two', '2');
  assert.equal(storage.length, 2);
  assert.equal(storage.getItem('one'), '1');
  assert.equal(storage.key(0), 'one');
  storage.removeItem('one');
  assert.equal(storage.key(0), 'two');
  storage.clear();
  assert.equal(storage.length, 0);
});

test('synchronizes fresh or existing browser storage onto the test global', () => {
  const target = { window: {} };
  syncBrowserStorageGlobals(target);
  assert.equal(target.localStorage, target.window.localStorage);
  assert.equal(target.sessionStorage, target.window.sessionStorage);
  target.localStorage.setItem('persisted', 'yes');
  syncBrowserStorageGlobals(target);
  assert.equal(target.window.localStorage.getItem('persisted'), 'yes');
  syncBrowserStorageGlobals({});
});

test('keeps the mobile overflow assertion framework-injected', async () => {
  let callback;
  let tolerance;
  const expectTarget = {
    poll(value) {
      callback = value;
      return {
        async toBeLessThanOrEqual(expected) {
          tolerance = expected;
          assert.equal(await callback(), 1);
        }
      };
    }
  };
  const page = { async evaluate(evaluate) {
    assert.equal(typeof evaluate, 'function');
    return 1;
  } };
  await expectNoHorizontalOverflow(page, { expectTarget });
  assert.equal(tolerance, 1);
});

test('rejects missing test-framework boundaries and unsafe tolerances', async () => {
  await assert.rejects(expectNoHorizontalOverflow({}, { expectTarget: {} }), /page\.evaluate/u);
  await assert.rejects(expectNoHorizontalOverflow({ evaluate() {} }, { expectTarget: {} }), /expectTarget\.poll/u);
  await assert.rejects(expectNoHorizontalOverflow(
    { evaluate() {} },
    { expectTarget: { poll() {} }, tolerancePixels: 101 }
  ), /between zero and 100/u);
});
