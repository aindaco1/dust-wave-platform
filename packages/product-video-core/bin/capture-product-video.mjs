#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import {
  captureProductVideoFrames,
  createProductVideoOutputDirectory,
  normalizeProductVideoBaseUrl,
  normalizeProductVideoFlow
} from '../src/index.js';

function help() {
  process.stdout.write(`Usage: dustwave-product-video-capture [options]

Required:
  --flow <path>          Consumer-owned product flow JSON
  --output-dir <path>    New frame directory below --work-root

Options:
  --base-url <origin>    Preview origin (default: http://127.0.0.1:4010)
  --work-root <path>     Bounded generated-output root (default: tmp/product-video)
  --allow-remote-origin  Permit an explicit non-loopback preview origin
  --help                 Show this message
`);
}

function valueAfter(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  return value;
}

function parseArgs(argv) {
  const options = {
    baseUrl: 'http://127.0.0.1:4010',
    workRoot: 'tmp/product-video',
    allowRemoteOrigin: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--flow') {
      options.flowPath = valueAfter(argv, index, arg);
      index += 1;
    } else if (arg === '--output-dir') {
      options.outputDir = valueAfter(argv, index, arg);
      index += 1;
    } else if (arg === '--base-url') {
      options.baseUrl = valueAfter(argv, index, arg);
      index += 1;
    } else if (arg === '--work-root') {
      options.workRoot = valueAfter(argv, index, arg);
      index += 1;
    } else if (arg === '--allow-remote-origin') {
      options.allowRemoteOrigin = true;
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
  if (!options.flowPath || !options.outputDir) {
    throw new Error('--flow and --output-dir are required');
  }
  const baseUrl = normalizeProductVideoBaseUrl(options.baseUrl, { allowRemote: options.allowRemoteOrigin });
  const flowPath = path.resolve(options.flowPath);
  const flow = normalizeProductVideoFlow(JSON.parse(await fs.readFile(flowPath, 'utf8')));
  const outputDir = await createProductVideoOutputDirectory({
    workRoot: options.workRoot,
    targetPath: options.outputDir
  });
  let playwright;
  try {
    playwright = await import('@playwright/test');
  } catch {
    throw new Error('@playwright/test is required in the consumer repository to capture product video');
  }
  const manifest = await captureProductVideoFrames({
    chromium: playwright.chromium,
    baseUrl,
    flow,
    outputDir,
    allowRemoteOrigin: options.allowRemoteOrigin
  });
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
