import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { evaluateTranscriptExpectations, optionValue, optionValues, runScreenReaderEvidence } from '../src/screen-reader-evidence.js';

const policy = {
  productLabel: 'Product',
  tempPrefix: 'product-screen-reader-evidence-',
  defaultExpectedPhrases: ['Product'],
  defaultUrl: 'http://127.0.0.1:4002/'
};

test('screen-reader option and transcript helpers preserve repeated expectations', () => {
  const args = ['--model', 'small', '--expect', 'Hello', '--expect', 'WORLD'];
  assert.equal(optionValue(args, '--model', 'base'), 'small');
  assert.deepEqual(optionValues(args, '--expect'), ['Hello', 'WORLD']);
  assert.deepEqual(evaluateTranscriptExpectations('hello accessible world', ['Hello', 'WORLD']), {
    ok: true,
    missing: [],
    matched: ['Hello', 'WORLD']
  });
  assert.deepEqual(evaluateTranscriptExpectations('hello', ['Hello', 'world']).missing, ['world']);
});

test('screen-reader help has no filesystem or process side effects', () => {
  const lines = [];
  const result = runScreenReaderEvidence(policy, {
    args: ['--help'],
    writeLine: (line) => lines.push(line),
    fsImpl: { mkdtempSync: () => assert.fail('must not create temp directory') },
    spawnSync: () => assert.fail('must not spawn')
  });
  assert.equal(result.help, true);
  assert.equal(result.exitCode, 0);
  assert.match(lines.join('\n'), /--record-voiceover/);
});

test('screen-reader evidence fails explicitly for a missing supplied recording', () => {
  const result = runScreenReaderEvidence(policy, {
    args: ['--audio-file', '/missing/evidence.wav'],
    platform: 'linux',
    commandAvailable: () => false,
    writeLine: () => undefined
  });
  assert.equal(result.exitCode, 1);
  assert.ok(result.results.some((entry) => entry.label === 'Screen-reader audio file' && entry.status === 'FAIL'));
});

test('screen-reader recording fails without invoking host commands off macOS', () => {
  const calls = [];
  const result = runScreenReaderEvidence(policy, {
    args: ['--record-voiceover'],
    platform: 'linux',
    spawnSync: (...args) => { calls.push(args); return { status: 0, stdout: '', stderr: '' }; },
    commandAvailable: () => true,
    writeLine: () => undefined
  });
  assert.equal(result.exitCode, 1);
  assert.equal(calls.length, 0);
  assert.ok(result.results.some((entry) => entry.label === 'VoiceOver audio recording' && entry.status === 'SKIP'));
});

test('screen-reader transcription uses argv without a shell and evaluates default phrase', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'screen-reader-core-test-'));
  const audio = path.join(root, 'voice.wav');
  fs.writeFileSync(audio, 'fixture');
  const commands = [];
  const result = runScreenReaderEvidence(policy, {
    args: ['--audio-file', audio],
    platform: 'linux',
    commandAvailable: () => true,
    writeLine: () => undefined,
    spawnSync: (command, args) => {
      commands.push({ command, args });
      if (command === 'whisper') {
        const outputDir = args[args.indexOf('--output_dir') + 1];
        fs.writeFileSync(path.join(outputDir, 'voice.txt'), 'Welcome to Product');
      }
      return { status: 0, stdout: '', stderr: '' };
    }
  });
  assert.equal(result.exitCode, 0);
  assert.equal(commands.length, 1);
  assert.equal(commands[0].command, 'whisper');
  assert.deepEqual(commands[0].args.slice(0, 3), [audio, '--model', 'base']);
  assert.ok(result.results.some((entry) => entry.label === 'Screen-reader transcript expectations' && entry.status === 'PASS'));
});

test('screen-reader policy rejects control characters and credentialed URLs', () => {
  assert.throws(() => runScreenReaderEvidence({ ...policy, productLabel: 'bad\nlabel' }, { args: ['--help'] }), /productLabel/);
  assert.throws(() => runScreenReaderEvidence({ ...policy, defaultUrl: 'https://user:secret@example.com' }, { args: ['--help'] }), /without credentials/);
});
