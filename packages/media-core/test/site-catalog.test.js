import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createMediaCatalog,
  mediaPathLabel,
  normalizeMediaRepoPath,
  probableVideoSourcePaths
} from '../src/site-catalog.js';

const catalog = createMediaCatalog({
  scopeForPath: (path) => path.includes('/products/') ? 'product' : 'default',
  entitySlugForPath: (path) => path.match(/\/products\/([^/]+)\//)?.[1] || '',
  entitySlugKey: 'productSlug',
  placementBudgets: {
    product_detail: { maxBytes: 2_000_000 },
    social: { maxBytes: 1_500_000 }
  },
  defaultPlacement: 'product_detail',
  includeBrokenReferences: true
});

test('normalizes bounded media paths and rejects traversal', () => {
  assert.equal(
    normalizeMediaRepoPath('\\assets\\images//products/mug/mug-640.webp'),
    'assets/images/products/mug/mug-640.webp'
  );
  assert.equal(normalizeMediaRepoPath('assets/images/../private/file.jpg'), '');
  assert.equal(mediaPathLabel('assets/images/products/mug/mug-640.webp'), 'mug');
});

test('classifies policy-injected sources and deterministic derivatives', () => {
  const source = 'assets/images/products/mug/mug.jpg';
  const derivative = 'assets/images/products/mug/mug-640.webp';
  assert.deepEqual(catalog.classifyMediaPath(derivative, new Set([source])), {
    path: derivative,
    publicPath: `/${derivative}`,
    name: 'mug-640.webp',
    label: 'mug',
    extension: 'webp',
    type: 'image',
    role: 'derived',
    sourcePath: source,
    derivativeWidth: 640,
    scope: 'product',
    productSlug: 'mug'
  });
  assert.deepEqual(catalog.expectedMediaDerivativePaths(source, { width: 1000 }), [
    'assets/images/products/mug/mug-320.webp',
    'assets/images/products/mug/mug-480.webp',
    'assets/images/products/mug/mug-640.webp',
    'assets/images/products/mug/mug-960.webp'
  ]);
  assert.deepEqual(probableVideoSourcePaths('assets/videos/defaults/trailer.webm'), [
    'assets/videos/defaults/trailer.mp4',
    'assets/videos/defaults/trailer.mov',
    'assets/videos/defaults/trailer.m4v'
  ]);
});

test('preserves manifest and placement policy without owning content', () => {
  assert.deepEqual(catalog.normalizeMediaManifest({ version: 0 }), {
    version: 1,
    assets: [],
    brokenReferences: []
  });
  assert.deepEqual(catalog.mediaPlacementBudget('unknown'), { maxBytes: 2_000_000 });
  assert.deepEqual(catalog.mediaPlacementBudget('social'), { maxBytes: 1_500_000 });
});
