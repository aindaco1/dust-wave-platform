import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildProviderEvidence,
  providerEvidenceShouldFail
} from '../src/provider-evidence.js';

test('builds canonical redacted provider evidence', () => {
  const evidence = buildProviderEvidence([
    { status: 'PASS', label: 'Cloudflare DNS', detail: 'zone resolved', secret: 'must-not-copy' },
    { status: 'SKIP', label: 'Optional provider', detail: 'credential not configured' }
  ], {
    generatedAt: '2026-08-06T00:00:00.000Z',
    strict: false,
    cloudflareDnsOnly: true,
    usedDevVars: false
  });

  assert.deepEqual(evidence, {
    schemaVersion: 1,
    generatedAt: '2026-08-06T00:00:00.000Z',
    strict: false,
    cloudflareDnsOnly: true,
    usedDevVars: false,
    status: 'incomplete',
    failCount: 0,
    warnCount: 0,
    skipCount: 1,
    results: [
      { status: 'PASS', label: 'Cloudflare DNS', detail: 'zone resolved' },
      { status: 'SKIP', label: 'Optional provider', detail: 'credential not configured' }
    ],
    containsCredentials: false,
    containsCustomerData: false
  });
  assert.equal(JSON.stringify(evidence).includes('must-not-copy'), false);
  assert.equal(providerEvidenceShouldFail(evidence), false);
});

test('fails unknown statuses closed and enforces strict warning/skip policy', () => {
  const invalid = buildProviderEvidence([{ status: 'MAYBE', label: 'Unknown result' }]);
  assert.equal(invalid.status, 'fail');
  assert.equal(invalid.failCount, 1);
  assert.equal(providerEvidenceShouldFail(invalid), true);

  const strict = buildProviderEvidence([{ status: 'WARN', label: 'Review' }], { strict: true });
  assert.equal(providerEvidenceShouldFail(strict), true);
});
