import assert from 'node:assert/strict';
import test from 'node:test';

import { transformKvBackupValuesToPutRecords } from '../src/kv-backup-records.js';

test('normalizes raw and structured Wrangler KV bulk-get object formats', () => {
  assert.deepEqual(transformKvBackupValuesToPutRecords({
    one: 'raw',
    two: { value: 'structured', metadata: { version: 1 } },
    three: 0,
    four: null
  }), [
    { key: 'one', value: 'raw' },
    { key: 'two', value: 'structured', metadata: { version: 1 } },
    { key: 'three', value: '0' },
    { key: 'four', value: '' }
  ]);
});

test('normalizes Wrangler array records and drops blank keys', () => {
  assert.deepEqual(transformKvBackupValuesToPutRecords([
    { key: 'one', value: 1, metadata: { source: 'fixture' } },
    { key: '', value: 'drop' },
    null
  ]), [
    { key: 'one', value: '1', metadata: { source: 'fixture' } }
  ]);
});
