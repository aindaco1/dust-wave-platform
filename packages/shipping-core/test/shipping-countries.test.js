import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(
  new URL('../bin/sync-shipping-countries.mjs', import.meta.url)
);
const source = new URL('../data/shipping-countries.yml', import.meta.url);

test('owns the exact independently characterized Pool/Store registry', () => {
  const text = readFileSync(source, 'utf8');
  const values = [...text.matchAll(/^- value: ([A-Z]{2})$/gm)].map((match) => match[1]);
  assert.equal(values.length, 95);
  assert.equal(values[0], 'US');
  assert.equal(new Set(values).size, values.length);
  assert.match(text, /- value: CA\n  label: Canada/);
  assert.match(text, /- value: GB\n  label: United Kingdom/);
});

test('checks and writes only an explicit consumer snapshot', () => {
  const directory = mkdtempSync(join(tmpdir(), 'shipping-countries-'));
  const output = join(directory, 'shipping.yml');
  const missingOutput = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.notEqual(missingOutput.status, 0);
  assert.match(missingOutput.stderr, /explicit output path/);

  writeFileSync(output, 'stale\n');
  const stale = spawnSync(process.execPath, [script, output], { encoding: 'utf8' });
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /snapshot is stale/);

  execFileSync(process.execPath, [script, output, '--write']);
  assert.deepEqual(readFileSync(output), readFileSync(source));
  execFileSync(process.execPath, [script, output]);
});
