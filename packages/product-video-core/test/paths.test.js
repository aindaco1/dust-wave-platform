import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createProductVideoOutputDirectory,
  resolveExistingProductVideoDirectory,
  resolveProductVideoPathPolicy
} from '../src/paths.js';

test('bounds generated output below an explicit workspace root and never overwrites it', async (t) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'product-video-paths-'));
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  const output = await createProductVideoOutputDirectory({
    cwd,
    workRoot: 'tmp/product-video',
    targetPath: 'tmp/product-video/run-1/frames'
  });
  assert.equal(output, path.join(cwd, 'tmp/product-video/run-1/frames'));
  await fs.writeFile(path.join(output, 'preserved.txt'), 'preserved');
  await assert.rejects(() => createProductVideoOutputDirectory({
    cwd,
    workRoot: 'tmp/product-video',
    targetPath: 'tmp/product-video/run-1/frames'
  }), /never overwritten/u);
  assert.equal(await fs.readFile(path.join(output, 'preserved.txt'), 'utf8'), 'preserved');
  assert.equal(await resolveExistingProductVideoDirectory({
    cwd,
    workRoot: 'tmp/product-video',
    targetPath: output
  }), await fs.realpath(output));
});

test('rejects broad, escaping, and symlinked output targets', async (t) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'product-video-bounds-'));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'product-video-outside-'));
  t.after(() => Promise.all([
    fs.rm(cwd, { recursive: true, force: true }),
    fs.rm(outside, { recursive: true, force: true })
  ]));
  assert.throws(() => resolveProductVideoPathPolicy({ cwd, workRoot: '.', targetPath: 'frames' }), /child of cwd/u);
  assert.throws(() => resolveProductVideoPathPolicy({ cwd, workRoot: 'tmp/product-video', targetPath: '../frames' }), /child of workRoot/u);

  await fs.mkdir(path.join(cwd, 'tmp/product-video'), { recursive: true });
  await fs.symlink(outside, path.join(cwd, 'tmp/product-video/linked'));
  await assert.rejects(() => createProductVideoOutputDirectory({
    cwd,
    workRoot: 'tmp/product-video',
    targetPath: 'tmp/product-video/linked/frames'
  }), /outside workRoot/u);
});
