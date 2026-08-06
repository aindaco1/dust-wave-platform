#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(
  new URL('../data/shipping-countries.yml', import.meta.url)
);
const args = process.argv.slice(2);
const write = args.includes('--write');
const outputArg = args.find((value) => !value.startsWith('--'));

if (!outputArg) {
  throw new Error('An explicit output path is required');
}
if (args.some((value) => value.startsWith('--') && value !== '--write')) {
  throw new Error('Unsupported shipping-country sync option');
}

const outputPath = resolve(process.cwd(), outputArg);
const source = await readFile(sourcePath);
let current = null;
try {
  current = await readFile(outputPath);
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

if (current?.equals(source)) process.exit(0);
if (!write) {
  console.error(`Shipping-country snapshot is stale: ${outputPath}`);
  process.exitCode = 1;
} else {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, source, { mode: 0o644 });
}
