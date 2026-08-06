import { spawnSync as nodeSpawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function boundedText(value, label, maximum) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > maximum || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error(`${label} is missing or invalid.`);
  }
  return normalized;
}

function normalizedPolicy(policy = {}) {
  const defaultExpectedPhrases = Array.isArray(policy.defaultExpectedPhrases)
    ? policy.defaultExpectedPhrases.map((value) => boundedText(value, 'defaultExpectedPhrases', 200))
    : [];
  if (!defaultExpectedPhrases.length || defaultExpectedPhrases.length > 10) {
    throw new Error('defaultExpectedPhrases is missing or invalid.');
  }
  const tempPrefix = boundedText(policy.tempPrefix, 'tempPrefix', 64);
  if (!/^[a-z0-9][a-z0-9-]*-$/.test(tempPrefix)) throw new Error('tempPrefix is missing or invalid.');
  const defaultUrl = new URL(String(policy.defaultUrl || 'http://127.0.0.1/'));
  if (!['http:', 'https:'].includes(defaultUrl.protocol) || defaultUrl.username || defaultUrl.password) {
    throw new Error('defaultUrl must be an HTTP(S) URL without credentials.');
  }
  return Object.freeze({
    productLabel: boundedText(policy.productLabel, 'productLabel', 64),
    tempPrefix,
    defaultExpectedPhrases: Object.freeze(defaultExpectedPhrases),
    defaultUrl: defaultUrl.href
  });
}

export function optionValue(args, name, fallback = '') {
  const index = args.indexOf(name);
  return index >= 0 ? String(args[index + 1] || '') : fallback;
}

export function optionValues(args, name) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === name && args[index + 1]) values.push(String(args[index + 1]));
  }
  return values;
}

export function evaluateTranscriptExpectations(transcript, expectedPhrases) {
  const normalized = String(transcript || '').toLocaleLowerCase('en-US');
  const phrases = expectedPhrases.map((phrase) => boundedText(phrase, 'expected phrase', 200));
  const missing = phrases.filter((phrase) => !normalized.includes(phrase.toLocaleLowerCase('en-US')));
  return { ok: Boolean(normalized) && missing.length === 0, missing, matched: missing.length ? [] : phrases };
}

function defaultCommandAvailable(command, env, fsImpl, pathImpl) {
  const candidate = boundedText(command, 'command', 1024);
  const direct = candidate.includes('/') ? [candidate] : String(env.PATH || '').split(pathImpl.delimiter).filter(Boolean).map((directory) => pathImpl.join(directory, candidate));
  return direct.some((file) => {
    try {
      fsImpl.accessSync(file, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

function boundedDiagnostic(result, command) {
  const raw = String(result?.stderr || result?.stdout || `${command} failed`);
  return raw.split(/\r?\n/).filter(Boolean).slice(-3).join(' | ').slice(0, 512) || `${command} failed`;
}

export function runScreenReaderEvidence(inputPolicy, options = {}) {
  const policy = normalizedPolicy(inputPolicy);
  const args = options.args || [];
  const env = options.env || process.env;
  const platform = options.platform || process.platform;
  const spawnSync = options.spawnSync || nodeSpawnSync;
  const fsImpl = options.fsImpl || fs;
  const osImpl = options.osImpl || os;
  const pathImpl = options.pathImpl || path;
  const writeLine = options.writeLine || ((line) => console.log(line));
  const commandAvailable = options.commandAvailable || ((command) => defaultCommandAvailable(command, env, fsImpl, pathImpl));
  const results = [];

  function usage() {
    writeLine(`Usage: npm run release:screen-reader-evidence -- [options]\n\nOptions:\n  --audio-file <path>       Transcribe an existing VoiceOver recording.\n  --record-voiceover        On macOS, open the target URL and record audio with ffmpeg.\n  --url <url>               URL to open before recording.\n  --expect <phrase>         Required transcript phrase. Repeatable.\n  --model <name>            Whisper model. Default: base.\n  --help                    Show this help.`);
  }

  if (args.includes('--help') || args.includes('-h')) {
    usage();
    return { schemaVersion: 1, product: policy.productLabel, results, failCount: 0, warnCount: 0, skipCount: 0, exitCode: 0, help: true };
  }

  function add(status, label, detail = '') {
    const entry = { status, label, detail: String(detail).slice(0, 1024) };
    results.push(entry);
    writeLine(`${status.padEnd(5)} ${label}${entry.detail ? ` - ${entry.detail}` : ''}`);
  }

  function run(command, commandArgs, label, runOptions = {}) {
    const result = spawnSync(command, commandArgs, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...runOptions.spawnOptions
    });
    if (result.status === 0) add('PASS', label, runOptions.successDetail || 'completed');
    else add('FAIL', label, boundedDiagnostic(result, command));
    return result;
  }

  const sleepMs = (milliseconds) => spawnSync('sleep', [String(Math.max(milliseconds, 0) / 1000)], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'ignore'] });
  const voiceOverIsRunning = () => spawnSync('pgrep', ['-x', 'VoiceOver'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).status === 0;
  const closeQuickstart = () => {
    spawnSync('osascript', ['-e', 'tell application "VoiceOver Quickstart" to quit'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    spawnSync('pkill', ['-f', 'VoiceOver Quickstart'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  };
  const toggleVoiceOver = () => spawnSync('osascript', ['-e', 'tell application "System Events" to key code 96 using {command down}'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const stopVoiceOver = () => {
    spawnSync('osascript', ['-e', 'tell application "VoiceOver" to quit'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    sleepMs(1000);
    if (voiceOverIsRunning()) spawnSync('pkill', ['-x', 'VoiceOver'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  };

  function recordVoiceOverAudio(outputFile) {
    if (platform !== 'darwin') {
      add('SKIP', 'VoiceOver audio recording', 'macOS is required for local VoiceOver automation');
      return false;
    }
    for (const command of ['ffmpeg', 'osascript']) {
      if (!commandAvailable(command)) {
        add('SKIP', 'VoiceOver audio recording', `${command} is not available`);
        return false;
      }
    }
    const device = String(env.VOICEOVER_AUDIO_DEVICE || '').trim();
    if (!device || device.length > 256 || /[\u0000-\u001f\u007f]/.test(device)) {
      add('SKIP', 'VoiceOver audio recording', 'set VOICEOVER_AUDIO_DEVICE to an ffmpeg avfoundation audio input');
      return false;
    }

    const control = String(env.VOICEOVER_CONTROL || '').trim() || (String(env.VOICEOVER_TOGGLE || '').trim() === '1' ? 'toggle' : 'none');
    const initiallyRunning = voiceOverIsRunning();
    let startedByScript = false;
    if (control === 'ensure-on') {
      if (initiallyRunning) add('PASS', 'VoiceOver process before recording', 'VoiceOver was already running');
      else {
        const started = spawnSync('open', ['-a', 'VoiceOver'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        sleepMs(1500);
        closeQuickstart();
        if (started.status === 0 && voiceOverIsRunning()) {
          startedByScript = true;
          add('PASS', 'VoiceOver start before recording', 'VoiceOver is running');
        } else add('WARN', 'VoiceOver start before recording', boundedDiagnostic(started, 'open'));
      }
    } else if (control === 'toggle') {
      const toggled = toggleVoiceOver();
      add(toggled.status === 0 ? 'PASS' : 'WARN', 'VoiceOver toggle before recording', toggled.status === 0 ? 'Command+F5 sent' : boundedDiagnostic(toggled, 'osascript'));
      sleepMs(1500);
      closeQuickstart();
    } else {
      add('SKIP', 'VoiceOver control before recording', 'VOICEOVER_CONTROL is not set; expecting VoiceOver to already be running if needed');
    }

    const url = new URL(optionValue(args, '--url', policy.defaultUrl));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('VoiceOver target URL is invalid.');
    const openApp = String(env.VOICEOVER_OPEN_APP || '').trim();
    const openArgs = openApp ? ['-a', boundedText(openApp, 'VOICEOVER_OPEN_APP', 128), url.href] : [url.href];
    run('open', openArgs, 'Open target URL for VoiceOver recording', { successDetail: openApp ? `${url.href} in ${openApp}` : url.href });
    if (openApp) spawnSync('osascript', ['-e', `tell application ${JSON.stringify(openApp)} to activate`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    sleepMs(Number(env.VOICEOVER_OPEN_WAIT_MS || 2500) || 2500);

    const seconds = Math.min(300, Math.max(1, Number(env.VOICEOVER_RECORD_SECONDS || 20) || 20));
    const recorded = run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'avfoundation', '-i', device, '-t', String(seconds), '-y', outputFile], 'VoiceOver audio recording', { successDetail: `${seconds}s to ${outputFile}` });

    if (control === 'ensure-on' && startedByScript) {
      stopVoiceOver();
      add(voiceOverIsRunning() ? 'WARN' : 'PASS', 'VoiceOver restore after recording', voiceOverIsRunning() ? 'VoiceOver is still running' : 'VoiceOver stopped after script-started run');
    } else if (control === 'toggle') {
      const toggled = toggleVoiceOver();
      add(toggled.status === 0 ? 'PASS' : 'WARN', 'VoiceOver toggle after recording', toggled.status === 0 ? 'Command+F5 sent' : boundedDiagnostic(toggled, 'osascript'));
    }
    return recorded.status === 0 && fsImpl.existsSync(outputFile);
  }

  function transcribeAudio(audioFile, outputDir) {
    const whisper = String(env.WHISPER_COMMAND || 'whisper').trim();
    if (!commandAvailable(whisper)) {
      add('SKIP', 'Whisper transcription', `${whisper.slice(0, 128)} is not available`);
      return '';
    }
    const model = boundedText(optionValue(args, '--model', env.WHISPER_MODEL || 'base'), 'Whisper model', 128);
    const result = run(whisper, [audioFile, '--model', model, '--output_format', 'txt', '--output_dir', outputDir], 'Whisper transcription', { successDetail: `model ${model}` });
    if (result.status !== 0) return '';
    const transcriptPath = pathImpl.join(outputDir, `${pathImpl.basename(audioFile, pathImpl.extname(audioFile))}.txt`);
    if (!fsImpl.existsSync(transcriptPath)) {
      add('FAIL', 'Whisper transcript file', `missing ${transcriptPath}`);
      return '';
    }
    const transcript = fsImpl.readFileSync(transcriptPath, 'utf8').trim();
    add('PASS', 'Whisper transcript file', transcriptPath);
    return transcript;
  }

  writeLine(`${policy.productLabel} release screen-reader evidence`);
  writeLine(`Generated: ${(options.now || (() => new Date()))().toISOString()}`);
  writeLine('');
  const whisper = String(env.WHISPER_COMMAND || 'whisper').trim();
  add(commandAvailable(whisper) ? 'PASS' : 'SKIP', 'Whisper availability', commandAvailable(whisper) ? whisper.slice(0, 128) : `${whisper.slice(0, 128)} not found`);
  add(platform === 'darwin' ? 'PASS' : 'SKIP', 'VoiceOver host capability', platform === 'darwin' ? 'macOS host detected' : `current platform is ${platform}`);

  const tempDir = fsImpl.mkdtempSync(pathImpl.join(osImpl.tmpdir(), policy.tempPrefix));
  let audioFile = optionValue(args, '--audio-file', '');
  const recordRequested = args.includes('--record-voiceover');
  if (recordRequested) {
    audioFile = pathImpl.join(tempDir, 'voiceover-evidence.wav');
    if (!recordVoiceOverAudio(audioFile)) {
      audioFile = '';
      add('FAIL', 'Screen-reader transcript evidence', 'VoiceOver recording did not produce an audio file');
    }
  }
  if (audioFile) {
    if (!fsImpl.existsSync(audioFile)) add('FAIL', 'Screen-reader audio file', `${audioFile} does not exist`);
    else {
      add('PASS', 'Screen-reader audio file', audioFile);
      const transcript = transcribeAudio(audioFile, tempDir);
      if (transcript) {
        const expected = optionValues(args, '--expect');
        const expectation = evaluateTranscriptExpectations(transcript, expected.length ? expected : policy.defaultExpectedPhrases);
        add(expectation.ok ? 'PASS' : 'FAIL', 'Screen-reader transcript expectations', expectation.ok ? `matched: ${expectation.matched.join(', ')}` : `missing: ${expectation.missing.join(', ')}`);
      }
    }
  } else if (!recordRequested) add('SKIP', 'Screen-reader transcript evidence', 'pass --audio-file or --record-voiceover to generate transcript evidence');

  const failCount = results.filter((entry) => entry.status === 'FAIL').length;
  const warnCount = results.filter((entry) => entry.status === 'WARN').length;
  const skipCount = results.filter((entry) => entry.status === 'SKIP').length;
  writeLine('');
  writeLine(`Summary: ${failCount} fail, ${warnCount} warn, ${skipCount} skip`);
  return { schemaVersion: 1, product: policy.productLabel, results, failCount, warnCount, skipCount, exitCode: failCount ? 1 : 0, help: false };
}
