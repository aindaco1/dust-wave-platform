import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cloneInventory,
  createInventoryStateMechanics,
  getReservationCounts,
  getReservedCounts,
  mergeBootstrapInventory,
  normalizeCountMap
} from '../src/index.js';

test('normalizes count maps with the characterized integer contract', () => {
  assert.deepEqual(normalizeCountMap({ mug: '2.9', shirt: 0, bad: -1, nan: 'x', '': 4 }), {
    mug: 2,
    shirt: 0
  });
  assert.deepEqual(getReservationCounts({ counts: { mug: 2 } }), { mug: 2 });
  assert.deepEqual(getReservationCounts({ mug: 1 }), { mug: 1 });
  assert.deepEqual(getReservationCounts(null), {});
});

test('deep-clones inventory without sharing consumer state', () => {
  const source = { mug: { limit: 5, claimed: 1 } };
  const cloned = cloneInventory(source);
  cloned.mug.claimed = 2;
  assert.equal(source.mug.claimed, 1);
  assert.deepEqual(cloneInventory(null), {});
});

test('totals reservations while excluding an updated reservation', () => {
  const reservations = {
    first: { counts: { mug: 1, shirt: 2 } },
    second: { counts: { mug: 3 } },
    empty: { counts: {} }
  };
  assert.deepEqual(getReservedCounts(reservations), { mug: 4, shirt: 2 });
  assert.deepEqual(getReservedCounts(reservations, 'first'), { mug: 3 });
});

test('builds and expires reservations from injected TTL and time policy', () => {
  const mechanics = createInventoryStateMechanics({
    defaultReservationTtlSeconds: 600
  });
  const now = Date.parse('2026-08-06T12:00:00.000Z');
  assert.deepEqual(mechanics.buildReservationEntry({ mug: 1 }, now), {
    counts: { mug: 1 },
    expiresAt: '2026-08-06T12:10:00.000Z'
  });
  assert.deepEqual(mechanics.buildReservationEntry({ mug: 1 }, now, 30), {
    counts: { mug: 1 },
    expiresAt: '2026-08-06T12:00:30.000Z'
  });
  assert.equal(
    mechanics.normalizeReservationExpiry({ expiresAt: '2026-08-06T11:59:59Z' }, now),
    null
  );
  assert.equal(
    mechanics.normalizeReservationExpiry({}, now),
    '2026-08-06T12:10:00.000Z'
  );
});

test('normalizes legacy reservations and reports expired cleanup', () => {
  const mechanics = createInventoryStateMechanics({
    defaultReservationTtlSeconds: 600
  });
  const result = mechanics.normalizeReservations({
    current: { mug: 1 },
    stale: {
      counts: { mug: 2 },
      expiresAt: '2026-08-06T11:59:59Z'
    },
    empty: { counts: {} }
  }, Date.parse('2026-08-06T12:00:00Z'));
  assert.deepEqual(result, {
    reservations: {
      current: {
        counts: { mug: 1 },
        expiresAt: '2026-08-06T12:10:00.000Z'
      }
    },
    cleanedExpiredReservations: true
  });
});

test('keeps replacement and merge bootstrap strategies explicit', () => {
  const state = {
    inventory: { mug: { limit: 5, claimed: 1, label: 'Old' } },
    reservations: {},
    updatedAt: '2026-08-06T12:00:00.000Z'
  };
  const bootstrap = {
    mug: { limit: 4, claimed: 0, label: 'Current' },
    shirt: { limit: 3, claimed: 0 }
  };
  const replace = createInventoryStateMechanics({
    defaultReservationTtlSeconds: 600,
    bootstrapStrategy: 'replace'
  });
  const merge = createInventoryStateMechanics({
    defaultReservationTtlSeconds: 600,
    bootstrapStrategy: 'merge'
  });
  assert.deepEqual(replace.normalizeState(state, bootstrap).inventory, state.inventory);
  assert.deepEqual(merge.normalizeState(state, bootstrap).inventory, {
    mug: { limit: 4, claimed: 1, label: 'Current' },
    shirt: { limit: 3, claimed: 0 }
  });
  assert.deepEqual(mergeBootstrapInventory({}, bootstrap), bootstrap);
});

test('rejects missing or invalid consumer state policy', () => {
  assert.throws(() => createInventoryStateMechanics(), /defaultReservationTtlSeconds/);
  assert.throws(
    () => createInventoryStateMechanics({ defaultReservationTtlSeconds: 600, bootstrapStrategy: 'other' }),
    /bootstrapStrategy/
  );
});
