import assert from 'node:assert/strict';
import test from 'node:test';

import { createScopedConsoleFactory } from '../src/logger.js';

function target() {
  const calls = [];
  const consoleTarget = Object.fromEntries(
    ['debug', 'info', 'log', 'warn', 'error'].map((level) => [
      level,
      (...args) => calls.push([level, ...args])
    ])
  );
  return { calls, consoleTarget };
}

test('emits the characterized product/runtime/scope shape and caches per owner policy', () => {
  const { calls, consoleTarget } = target();
  const factory = createScopedConsoleFactory({
    productName: 'Store',
    consoleTarget,
    now: () => new Date('2026-08-06T12:00:00Z')
  });
  const owner = {};
  const first = factory.getScopedConsole(owner, 'checkout', {
    consoleLoggingEnabled: true,
    verboseConsoleLogging: true
  });
  const second = factory.getScopedConsole(owner, 'checkout', {
    consoleLoggingEnabled: true,
    verboseConsoleLogging: true
  });
  assert.equal(first, second);
  first.child('stripe').info('ready');
  assert.deepEqual(calls[0], [
    'info',
    '[Store 2026-08-06T12:00:00.000Z]',
    '[Store Worker:checkout:stripe]',
    '[INFO]',
    'ready'
  ]);
});

test('suppresses disabled and non-verbose low-severity output', () => {
  const { calls, consoleTarget } = target();
  const factory = createScopedConsoleFactory({ productName: 'Pool', consoleTarget });
  const disabled = factory.getScopedConsole({}, 'worker', {
    consoleLoggingEnabled: false,
    verboseConsoleLogging: true
  });
  disabled.error('hidden');
  const normal = factory.getScopedConsole({}, 'worker', {
    consoleLoggingEnabled: true,
    verboseConsoleLogging: false
  });
  normal.debug('hidden');
  normal.warn('visible');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'warn');
});

test('bounds structured errors and rejects control-character scopes', () => {
  const { calls, consoleTarget } = target();
  const factory = createScopedConsoleFactory({ productName: 'Pool', consoleTarget });
  const logger = factory.getScopedConsole({}, 'worker', {
    consoleLoggingEnabled: true
  });
  logger.error(new Error('x'.repeat(3000)));
  assert.equal(calls[0][4].name, 'Error');
  assert.equal(calls[0][4].message.length, 2000);
  assert.throws(() => factory.getScopedConsole({}, 'bad\nscope', {
    consoleLoggingEnabled: true
  }), /scope/i);
});
