#!/usr/bin/env node
import path from 'node:path';

import {
  DEFAULT_NM_GRT_API_BASE,
  updateNmGrtStarter
} from '../src/nm-grt-updater.js';

function outputArgument(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--output') return argv[index + 1] || '';
    if (argv[index].startsWith('--output=')) {
      return argv[index].slice('--output='.length);
    }
  }
  return '';
}

const output = outputArgument(process.argv.slice(2));
if (!output) {
  console.error('Usage: dustwave-update-nm-grt-starter --output <consumer-owned-path>');
  process.exitCode = 1;
} else {
  const outputPath = path.resolve(output);
  try {
    const result = await updateNmGrtStarter({
      apiBase: process.env.NM_GRT_API_BASE || DEFAULT_NM_GRT_API_BASE,
      outputPath
    });
    console.log(`Wrote ${result.entries.length} New Mexico starter locations to ${outputPath}`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
