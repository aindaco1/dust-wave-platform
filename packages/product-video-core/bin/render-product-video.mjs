#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import {
  createProductVideoOutputDirectory,
  createProductVideoRenderPlan,
  executeProductVideoRenderPlan,
  normalizeProductVideoFormats,
  resolveExistingProductVideoDirectory
} from '../src/index.js';

function help() {
  process.stdout.write(`Usage: dustwave-product-video-render [options]

Required:
  --manifest <path>      Capture manifest.json
  --output-dir <path>    New render directory below --work-root

Options:
  --work-root <path>     Bounded generated-output root (default: tmp/product-video)
  --name <slug>          Output basename (default: product-demo)
  --format <formats>     prores, webm, or hevc; repeat or comma-separate
  --help                 Show this message
`);
}

function valueAfter(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  return value;
}

function parseArgs(argv) {
  const options = { workRoot: 'tmp/product-video', name: 'product-demo', formats: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--manifest') {
      options.manifestPath = valueAfter(argv, index, arg);
      index += 1;
    } else if (arg === '--output-dir') {
      options.outputDir = valueAfter(argv, index, arg);
      index += 1;
    } else if (arg === '--work-root') {
      options.workRoot = valueAfter(argv, index, arg);
      index += 1;
    } else if (arg === '--name') {
      options.name = valueAfter(argv, index, arg);
      index += 1;
    } else if (arg === '--format') {
      options.formats.push(valueAfter(argv, index, arg));
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    help();
    return;
  }
  if (!options.manifestPath || !options.outputDir) {
    throw new Error('--manifest and --output-dir are required');
  }
  const manifestPath = path.resolve(options.manifestPath);
  const captureManifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const framesDir = await resolveExistingProductVideoDirectory({
    workRoot: options.workRoot,
    targetPath: captureManifest.outputDir
  });
  const outputDir = await createProductVideoOutputDirectory({
    workRoot: options.workRoot,
    targetPath: options.outputDir
  });
  const plan = createProductVideoRenderPlan({
    captureManifest,
    framesDir,
    outputDir,
    formats: normalizeProductVideoFormats(options.formats.length ? options.formats : undefined),
    name: options.name
  });
  const renderManifest = {
    version: 1,
    captureManifest: manifestPath,
    ...(await executeProductVideoRenderPlan(plan))
  };
  await fs.writeFile(path.join(outputDir, 'render-manifest.json'), `${JSON.stringify(renderManifest, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(renderManifest, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
