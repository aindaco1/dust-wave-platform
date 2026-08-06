import assert from 'node:assert/strict';
import test from 'node:test';

import {
  redactCommandArgs,
  structuredCommandResult
} from '../src/command-result.js';

test('redacts credential-shaped and explicitly selected command arguments', () => {
  assert.deepEqual(redactCommandArgs([
    'deploy',
    'sk_test_fixture',
    'token=fixture',
    'public-value',
    'selected-value'
  ], { redactedIndexes: [4] }), [
    'deploy',
    '[REDACTED]',
    'token=[REDACTED]',
    'public-value',
    '[REDACTED]'
  ]);
});

test('omits command output by default and bounds failure details', () => {
  const result = structuredCommandResult({
    command: 'wrangler',
    args: ['deploy'],
    status: 1,
    timedOut: true,
    stdout: 'provider output',
    stderr: 'x'.repeat(700)
  });
  assert.equal(result.ok, false);
  assert.equal(result.timedOut, true);
  assert.equal('stdout' in result, false);
  assert.equal('stderr' in result, false);
  assert.equal(result.error.length, 500);
});

test('includes output only through explicit consumer policy', () => {
  assert.deepEqual(structuredCommandResult({
    command: 'node',
    args: ['--version'],
    status: 0,
    stdout: 'v20',
    stderr: ''
  }, { includeOutput: true }), {
    ok: true,
    status: 0,
    timedOut: false,
    command: 'node',
    args: ['--version'],
    stdout: 'v20',
    stderr: '',
    error: ''
  });
});
