import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInventoryStateMechanics, getReservedCounts } from '../src/index.js';

const jarUrl = 'https://github.com/tlaplus/tlaplus/releases/download/v1.7.4/tla2tools.jar';
const jarHash = '936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88';

async function runModel(directory) {
  let jar;
  if (process.env.TLA2TOOLS_JAR) {
    jar = await readFile(process.env.TLA2TOOLS_JAR);
  } else {
    const response = await fetch(jarUrl, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error('TLC download failed: HTTP ' + response.status);
    jar = Buffer.from(await response.arrayBuffer());
  }
  assert.equal(createHash('sha256').update(jar).digest('hex'), jarHash, 'TLC checksum mismatch');
  await writeFile(join(directory, 'tla2tools.jar'), jar);
  for (const name of ['ReservationExpiry.tla', 'ReservationExpiry.cfg']) {
    await copyFile(new URL(name, import.meta.url), join(directory, name));
  }
  const result = spawnSync('java', ['-cp', 'tla2tools.jar', 'tlc2.TLC', 'ReservationExpiry'], {
    cwd: directory, encoding: 'utf8'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stdout + result.stderr); // Include TLC's counterexample.
    throw new Error('TLC failed: ' + (result.signal ?? result.status));
  }
  return result.stdout;
}

const policies = [
  ['Store', 'merge'],
  ['Pool', 'replace']
].map(([name, bootstrapStrategy]) => [name, createInventoryStateMechanics({
  defaultReservationTtlSeconds: 600, bootstrapStrategy
})]);

function compareWithJavaScript(output) {
  const states = new Set();
  const epoch = Date.UTC(2026, 0, 1);
  for (const line of output.split(/\r?\n/)) {
    if (!line.startsWith('<<"expiry",')) continue;
    const row = /^<<"expiry", ([0-3]), ([0-3]), ([0-4]), (\d+)>>$/.exec(line);
    assert.ok(row, 'Unexpected TLC case: ' + line);
    const [first, second, tick, expectedTotal] = row.slice(1).map(Number);
    const key = [first, second, tick].join(',');
    states.add(key);

    // Start from raw persisted data, as each coordinator does on a read.
    const reservations = {};
    for (const [id, deadline, units] of [['first', first, 2], ['second', second, 3]]) {
      if (deadline === 0) continue;
      reservations[id] = {
        counts: { ticket: units },
        expiresAt: new Date(epoch + deadline).toISOString()
      };
    }
    for (const [name, mechanics] of policies) {
      const state = mechanics.normalizeState({ reservations }, {}, epoch + tick);
      const expected = expectedTotal ? { ticket: expectedTotal } : {};
      assert.deepEqual(getReservedCounts(state.reservations), expected,
        name + ' reserved total differs from TLC at [first deadline, second deadline, tick] = [' + key + ']');
    }
  }
  // All four choices for each deadline at each of five clock ticks must be seen.
  assert.equal(states.size, 4 * 4 * 5, 'Incomplete TLC state coverage');
  console.log('Verified ' + states.size + ' TLC states against each of Store and Pool.');
}

const directory = await mkdtemp(join(tmpdir(), 'dustwave-expiry-'));
try {
  compareWithJavaScript(await runModel(directory));
} finally {
  await rm(directory, { recursive: true, force: true });
}
