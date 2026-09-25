import test from 'node:test';
import assert from 'node:assert/strict';
import { createUpdateProgress } from '../src/update-progress.js';
import { sendReviewedReport, validateReportReceipt } from '../src/report-client.js';

test('Tauri progress handles known and unknown lengths, restart and completion without installing', () => {
  const update = createUpdateProgress();
  assert.deepEqual(update({ event: 'Started', data: {} }), { downloadedBytes: 0, totalBytes: 0, percentage: 0 });
  assert.equal(update({ event: 'Progress', data: { chunkLength: 42 } }).downloadedBytes, 42);
  update({ event: 'Started', data: { contentLength: 100 } });
  assert.equal(update({ event: 'Progress', data: { chunkLength: 25 } }).percentage, 25);
  assert.equal(update({ event: 'Progress', data: { chunkLength: 100 } }).percentage, 100);
  assert.equal(update({ event: 'Finished' }).downloadedBytes, 125);
});

test('reviewed send uses the same ID and accepts only matching bounded receipts', async () => {
  const report = { id: 'synthetic-report' };
  const good = { ok: true, reportId: report.id, issueNumber: 1, action: 'duplicate' };
  const receipt = await sendReviewedReport('/reports', report, { fetcher: async (url, options) => {
    assert.equal(url, '/reports');
    assert.equal(options.redirect, 'error');
    assert.equal(options.credentials, 'omit');
    assert.deepEqual(JSON.parse(options.body), report);
    return Response.json(good);
  } });
  assert.equal(receipt.action, 'duplicate');
  for (const changed of [{ ok: false }, { reportId: 'other' }, { issueNumber: 0 },
    { issueNumber: 1.5 }, { issueNumber: true }, { action: 'pending' }]) {
    assert.throws(() => validateReportReceipt({ ...good, ...changed }, report.id));
  }
  await assert.rejects(sendReviewedReport('/reports', report,
    { fetcher: async () => new Response(' '.repeat(4097)) }), /receipt/);
  await assert.rejects(sendReviewedReport('/reports', report,
    { fetcher: async () => new Response('', { status: 503 }) }), /not confirmed/);
});
