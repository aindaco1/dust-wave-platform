import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeProductVideoBaseUrl,
  normalizeProductVideoFlow
} from '../src/config.js';

const VALID_FLOW = {
  name: 'consumer-homepage-flow',
  initialPath: '/',
  presentation: { stylesheetPath: '/assets/capture.css' },
  capture: {
    fps: 24,
    preRollMs: 500,
    postRollMs: 1_000,
    viewport: { width: 1_920, height: 1_080 },
    shell: { width: 1_480, height: 960, radius: 24 },
    cursor: { startX: 1_600, startY: 920, moveDurationMs: 350 }
  },
  actions: [
    { action: 'wait', ms: 300 },
    { action: 'click', selector: '[data-product-id="fixture"]', waitAfterMs: 500 },
    { action: 'waitForURLIncludes', value: '/checkout' }
  ]
};

test('normalizes a consumer-owned capture flow without product policy', () => {
  const flow = normalizeProductVideoFlow(VALID_FLOW);
  assert.equal(flow.name, 'consumer-homepage-flow');
  assert.equal(flow.presentation.stylesheetPath, '/assets/capture.css');
  assert.equal(flow.capture.minimumEffectiveFpsRatio, 0.75);
  assert.equal(flow.actions[1].moveDurationMs, 350);
  assert.equal(flow.actions[2].timeoutMs, 15_000);
  assert.equal(flow.expectedDurationMs, 2_770);
});

test('rejects cross-origin paths, excessive timelines, and unsupported actions', () => {
  assert.throws(() => normalizeProductVideoFlow({ ...VALID_FLOW, initialPath: '//example.com' }), /same-origin/u);
  assert.throws(() => normalizeProductVideoFlow({
    ...VALID_FLOW,
    actions: [{ action: 'wait', ms: 30_000 }, { action: 'wait', ms: 30_000 }, { action: 'wait', ms: 30_000 }, { action: 'wait', ms: 30_000 }],
    capture: { ...VALID_FLOW.capture, preRollMs: 1, postRollMs: 1 }
  }), /expected duration/u);
  assert.throws(() => normalizeProductVideoFlow({ ...VALID_FLOW, actions: [{ action: 'evaluate', script: 'unsafe' }] }), /unsupported/u);
});

test('requires loopback capture unless remote capture is explicitly authorized', () => {
  assert.equal(normalizeProductVideoBaseUrl('http://127.0.0.1:4010'), 'http://127.0.0.1:4010');
  assert.equal(normalizeProductVideoBaseUrl('http://localhost:4000'), 'http://localhost:4000');
  assert.throws(() => normalizeProductVideoBaseUrl('https://pool.example'), /loopback/u);
  assert.equal(
    normalizeProductVideoBaseUrl('https://pool.example', { allowRemote: true }),
    'https://pool.example'
  );
  assert.throws(() => normalizeProductVideoBaseUrl('https://user:secret@pool.example', { allowRemote: true }), /origin/u);
});
