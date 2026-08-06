#!/usr/bin/env node
import { minifySiteAssets } from '../src/site-assets.js';

function parseArgs(argv = []) {
  const args = {
    siteDir: '_site',
    write: false,
    check: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') args.write = true;
    else if (arg === '--check') args.check = true;
    else if (arg === '--site-dir') {
      args.siteDir = argv[index + 1] || '_site';
      index += 1;
    } else if (arg.startsWith('--site-dir=')) {
      args.siteDir = arg.slice('--site-dir='.length) || '_site';
    }
  }

  return args;
}

const args = parseArgs(process.argv.slice(2));
const write = args.write && !args.check;

try {
  const summary = await minifySiteAssets({ siteDir: args.siteDir, write });
  console.log(JSON.stringify(summary, null, 2));
  if (args.check && summary.minifiedCount > 0) process.exitCode = 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
