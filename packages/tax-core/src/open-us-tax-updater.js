#!/usr/bin/env node
// Read only COPY data from OpenSalesTax's public dump; never execute upstream SQL/code.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, writeFile, rename, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RELEASE_API = 'https://api.github.com/repos/ejosterberg/open-sales-tax/releases/latest';
const COLUMNS = {
  states: 'id, abbrev, name, sst_member, sst_joined, has_sales_tax, notes',
  tax_authorities: 'id, state_id, name, authority_type, parent_id',
  boundaries: 'id, authority_id, zip5, zip4_low, zip4_high, address_pattern, data_version_id',
  rates: 'id, authority_id, rate_pct, effective_from, effective_to, applies_to_categories, data_version_id'
};
// Upstream documents incomplete local coverage; NM continues using the consumer's existing provider.
const EXCLUDED_STATES = new Set(['AL', 'CO', 'LA', 'NM']);
const date = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export async function buildOpenTaxSnapshot(lines, metadata) {
  const states = new Map(), authorities = {}, zipCodes = new Map(), partial = new Set(), seen = new Set();
  let table = '', bytes = 0;
  for await (const line of lines) {
    bytes += line.length;
    if (line.length > 16384 || bytes > 2_000_000_000) throw new Error('Tax dump exceeds parsing limits');
    if (line.startsWith('COPY ')) {
      const header = line.match(/^COPY public\.(\w+) \((.+)\) FROM stdin;$/);
      table = header?.[1] || '';
      if (COLUMNS[table]) {
        if (header[2] !== COLUMNS[table] || seen.has(table)) throw new Error(`Unexpected ${table} schema`);
        seen.add(table);
      }
      continue;
    }
    if (line === '\\.') { table = ''; continue; }
    if (!COLUMNS[table]) continue;
    const row = line.split('\t').map((s) => s === '\\N' ? null : s.replace(/\\([\\tnr])/g, (_, c) => ({ t: '\t', n: '\n', r: '\r', '\\': '\\' }[c])));
    if (row.length !== COLUMNS[table].split(', ').length) throw new Error(`Malformed ${table} row`);
    if (!/^[1-9]\d*$/.test(row[0])) throw new Error(`Invalid ${table} identifier`);
    if (table === 'states') {
      if (!/^[A-Z]{2}$/.test(row[1]) || states.size >= 60) throw new Error('Invalid state');
      states.set(row[0], row[1]);
    } else if (table === 'tax_authorities') {
      if (!states.has(row[1]) || !['state', 'county', 'city', 'district'].includes(row[3])) throw new Error('Invalid authority');
      authorities[row[0]] = { state: states.get(row[1]), name: row[2], type: row[3], rates: [] };
    } else if (table === 'boundaries') {
      if (!/^\d{5}$/.test(row[2]) || !authorities[row[1]]) throw new Error('Invalid ZIP boundary');
      if (row[3] !== null || row[4] !== null || row[5] !== null) partial.add(row[2]);
      if (!zipCodes.has(row[2])) zipCodes.set(row[2], new Set());
      zipCodes.get(row[2]).add(row[1]);
    } else if (table === 'rates') {
      if (!authorities[row[1]] || !date(row[3]) || (row[4] && !date(row[4]))) throw new Error('Invalid rate dates');
      if (row[5] !== null && row[5] !== 'null') continue; // General rates only; no product rules inferred.
      if (!/^\d+(?:\.\d{1,5})?$/.test(row[2])) throw new Error('Invalid rate');
      const rate = Math.round(Number(row[2]) * 10000); // Percent -> integer parts per million.
      if (!Number.isSafeInteger(rate) || rate < 0 || rate > 250000) throw new Error('Invalid rate');
      if (!EXCLUDED_STATES.has(authorities[row[1]].state) && Math.abs(rate - Number(row[2]) * 10000) > 0.000001) throw new Error('Unsupported rate precision');
      authorities[row[1]].rates.push([rate, row[3], row[4]]);
    }
  }
  if ((table && COLUMNS[table]) || Object.keys(COLUMNS).some((name) => !seen.has(name))) throw new Error('Incomplete tax dump');
  const selectedZips = {}, selectedAuthorities = {};
  for (const [zip, ids] of [...zipCodes].sort(([a], [b]) => a.localeCompare(b))) {
    const entries = [...ids].map((id) => authorities[id]);
    if (partial.has(zip) || new Set(entries.map((a) => a.state)).size !== 1 ||
        entries.some((a) => EXCLUDED_STATES.has(a.state) || !a.rates.length) ||
        !entries.some((a) => a.type !== 'state' && a.rates.some(([rate]) => rate > 0))) continue;
    selectedZips[zip] = [...ids].sort((a, b) => Number(a) - Number(b));
    for (const id of selectedZips[zip]) selectedAuthorities[id] = authorities[id];
  }
  for (const authority of Object.values(selectedAuthorities)) authority.rates.sort((a, b) => a[1].localeCompare(b[1]) || a[0] - b[0]);
  return { schemaVersion: 1, ...metadata, license: 'Apache-2.0',
    excludedStates: [...EXCLUDED_STATES], authorities: selectedAuthorities, zipCodes: selectedZips };
}

export async function verifyDigest(file, expected) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  if (!/^[a-f0-9]{64}$/.test(expected) || hash.digest('hex') !== expected) throw new Error('Tax source SHA-256 mismatch');
}

async function fetchPublic(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120000), headers: { 'User-Agent': 'DustWave-open-tax-updater' } });
  if (!response.ok) throw new Error(`Tax download failed (${response.status})`);
  return response;
}

export async function updateOpenTax({ dump, manifest, output } = {}) {
  if (!output) throw new Error('An explicit output path is required');
  const temp = await mkdtemp(path.join(tmpdir(), 'dustwave-tax-'));
  try {
    let metadata = manifest;
    if (!metadata) {
      const release = await (await fetchPublic(RELEASE_API)).json();
      const asset = release.assets?.find((item) => /^opensalestax-dump-[\w.-]+-postgres\.sql\.gz$/.test(item.name));
      if (!asset || !/^sha256:[a-f0-9]{64}$/.test(asset.digest || '') ||
          !asset.browser_download_url.startsWith('https://github.com/ejosterberg/open-sales-tax/releases/download/')) throw new Error('Unrecognized tax release');
      metadata = { release: release.tag_name, sourceUrl: asset.browser_download_url,
        sha256: asset.digest.slice(7), sourceUpdatedAt: asset.updated_at };
    }
    const age = Date.now() - Date.parse(metadata.sourceUpdatedAt);
    if (!Number.isFinite(age) || age < 0 || age >= 90 * 86400000) throw new Error('Tax source is older than 90 days or has an invalid date');
    const sourceFile = dump || path.join(temp, 'source.sql.gz');
    if (!dump) {
      const { createWriteStream } = await import('node:fs');
      let bytes = 0;
      await pipeline(Readable.fromWeb((await fetchPublic(metadata.sourceUrl)).body), new Transform({
        transform(chunk, encoding, callback) {
          bytes += chunk.length;
          callback(bytes > 100_000_000 ? new Error('Tax download exceeds 100 MB') : null, chunk);
        }
      }), createWriteStream(sourceFile));
    }
    await verifyDigest(sourceFile, metadata.sha256);
    const stream = createReadStream(sourceFile).pipe(createGunzip());
    const lines = createInterface({ input: stream, crlfDelay: Infinity });
    let streamError;
    stream.on('error', (error) => { streamError = error; lines.close(); });
    let data;
    try { data = await buildOpenTaxSnapshot(lines, metadata); }
    finally { lines.close(); stream.destroy(); }
    if (streamError) throw streamError;
    if (Object.keys(data.zipCodes).length < 1000) throw new Error('Unexpected tax coverage loss');
    const previous = await readFile(output, 'utf8').then(JSON.parse).catch((error) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (previous && Object.keys(data.zipCodes).length < Object.keys(previous.zipCodes).length * 0.8) throw new Error('Tax coverage fell by more than 20%; review the source');
    // One authority/ZIP per line keeps refresh diffs reviewable and the bundle small.
    const serialized = JSON.stringify(data).replace(/,"(\d+)":/g, ',\n"$1":') + '\n';
    await mkdir(path.dirname(output), { recursive: true });
    const temporaryOutput = `${output}.tmp`;
    await writeFile(temporaryOutput, serialized);
    await rename(temporaryOutput, output); // Replace only after download, digest and schema validation pass.
    return { output, zipCodes: Object.keys(data.zipCodes).length, sourceUpdatedAt: metadata.sourceUpdatedAt };
  } finally { await rm(temp, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const value = (name) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
  updateOpenTax({ dump: value('--dump'), output: value('--output'),
    manifest: value('--manifest') ? JSON.parse(await readFile(value('--manifest'), 'utf8')) : undefined
  }).then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
