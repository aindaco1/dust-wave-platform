import test from 'node:test';
import assert from 'node:assert/strict';
import { githubReleaseAssetName, githubReleaseAssetUrl, createTauriUpdateManifest } from '../src/tauri-updater.js';

test('Tauri manifests preserve platform keys and signatures and use GitHub asset naming', () => {
  assert.equal(githubReleaseAssetName('Example App.app.tar.gz'), 'Example.App.app.tar.gz');
  const entry = { signature: 'signed-value', url: githubReleaseAssetUrl('https://example.invalid/v1', 'Example App.app.tar.gz') };
  const manifest = createTauriUpdateManifest({ version: '1.0.0', notes: 'notes', pubDate: 'date', platforms: { 'darwin-aarch64': entry } });
  assert.deepEqual(manifest, { version: '1.0.0', notes: 'notes', pub_date: 'date', platforms: { 'darwin-aarch64': entry } });
  assert.equal(entry.url, 'https://example.invalid/v1/Example.App.app.tar.gz');
});
