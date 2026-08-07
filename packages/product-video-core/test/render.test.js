import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createProductVideoRenderPlan,
  executeProductVideoRenderPlan,
  normalizeProductVideoFormats
} from '../src/render.js';

const CAPTURE_MANIFEST = {
  fps: 24,
  frameCount: 240,
  viewport: { width: 1_920, height: 1_080 },
  shell: { width: 1_480, height: 960 }
};

test('builds deterministic shell-free alpha render commands', () => {
  const plan = createProductVideoRenderPlan({
    captureManifest: CAPTURE_MANIFEST,
    framesDir: '/workspace/tmp/product-video/run/frames',
    outputDir: '/workspace/tmp/product-video/run/output',
    formats: ['webm', 'hevc'],
    name: 'pool-demo'
  });
  assert.deepEqual(plan.crop, { width: 1_480, height: 960, x: 220, y: 60 });
  assert.deepEqual(plan.formats, ['webm', 'hevc']);
  assert.equal(plan.commands[0].command, 'ffmpeg');
  assert.equal(plan.commands[0].args.includes('crop=1480:960:220:60'), true);
  assert.equal(plan.commands[0].args.includes('libvpx-vp9'), true);
  assert.equal(plan.commands[1].args.includes('hevc_videotoolbox'), true);
  assert.equal(plan.commands[1].outputPath.endsWith('/pool-demo.mp4'), true);
  assert.equal('shell' in plan.commands[0], false);
});

test('normalizes formats and rejects unsafe names or malformed capture evidence', () => {
  assert.deepEqual(normalizeProductVideoFormats(['hevc,webm', 'webm']), ['webm', 'hevc']);
  assert.throws(() => normalizeProductVideoFormats(['gif']), /formats/u);
  assert.throws(() => createProductVideoRenderPlan({
    captureManifest: CAPTURE_MANIFEST,
    framesDir: '/frames',
    outputDir: '/output',
    name: '../escape'
  }), /filename-safe/u);
  assert.throws(() => createProductVideoRenderPlan({
    captureManifest: { ...CAPTURE_MANIFEST, frameCount: 0 },
    framesDir: '/frames',
    outputDir: '/output'
  }), /frameCount/u);
});

test('executes each encode and records parsed ffprobe evidence through an injected runner', async () => {
  const plan = createProductVideoRenderPlan({
    captureManifest: CAPTURE_MANIFEST,
    framesDir: '/frames',
    outputDir: '/output',
    formats: ['webm']
  });
  const calls = [];
  const result = await executeProductVideoRenderPlan(plan, {
    async runCommand(command, args, options) {
      calls.push({ command, args, options });
      return command === 'ffprobe'
        ? { status: 0, stdout: '{"streams":[{"codec_name":"vp9"}]}', stderr: '' }
        : { status: 0, stdout: '', stderr: '' };
    }
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].command, 'ffmpeg');
  assert.equal(calls[1].command, 'ffprobe');
  assert.equal(result.outputs[0].probe.streams[0].codec_name, 'vp9');
});
