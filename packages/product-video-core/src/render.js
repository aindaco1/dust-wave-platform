import { spawn } from 'node:child_process';
import path from 'node:path';

const FORMAT_ORDER = ['prores', 'webm', 'hevc'];
const FORMAT_SET = new Set(FORMAT_ORDER);

function integer(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < min || normalized > max) {
    throw new RangeError(`${label} is outside its allowed bounds`);
  }
  return normalized;
}

function outputName(value) {
  if (typeof value !== 'string' || !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u.test(value)) {
    throw new RangeError('name must be a lowercase filename-safe slug');
  }
  return value;
}

export function normalizeProductVideoFormats(values = FORMAT_ORDER) {
  const input = Array.isArray(values) ? values : [values];
  const formats = [...new Set(input.flatMap((value) => String(value).split(',')).map((value) => value.trim()).filter(Boolean))];
  if (formats.length === 0 || formats.some((format) => !FORMAT_SET.has(format))) {
    throw new RangeError('formats may contain only prores, webm, and hevc');
  }
  return FORMAT_ORDER.filter((format) => formats.includes(format));
}

export function createProductVideoRenderPlan({ captureManifest, framesDir, outputDir, formats, name = 'product-demo' }) {
  if (!captureManifest || typeof captureManifest !== 'object' || Array.isArray(captureManifest)) {
    throw new TypeError('captureManifest must be an object');
  }
  const fps = integer(captureManifest.fps, 'captureManifest.fps', { min: 1, max: 60 });
  const frameCount = integer(captureManifest.frameCount, 'captureManifest.frameCount', { min: 1, max: 100_000 });
  const viewportWidth = integer(captureManifest.viewport?.width, 'captureManifest.viewport.width', { min: 320, max: 4_096 });
  const viewportHeight = integer(captureManifest.viewport?.height, 'captureManifest.viewport.height', { min: 240, max: 2_160 });
  const shellWidth = integer(captureManifest.shell?.width, 'captureManifest.shell.width', { min: 240, max: viewportWidth });
  const shellHeight = integer(captureManifest.shell?.height, 'captureManifest.shell.height', { min: 180, max: viewportHeight });
  const cropX = Math.floor((viewportWidth - shellWidth) / 2);
  const cropY = Math.floor((viewportHeight - shellHeight) / 2);
  const cropFilter = `crop=${shellWidth}:${shellHeight}:${cropX}:${cropY}`;
  const normalizedName = outputName(name);
  const selectedFormats = normalizeProductVideoFormats(formats);
  const inputArgs = ['-y', '-framerate', String(fps), '-i', path.join(framesDir, 'frame-%05d.png'), '-vf', cropFilter, '-an'];

  const definitions = {
    prores: {
      outputPath: path.join(outputDir, `${normalizedName}-master.mov`),
      codec: 'prores_ks',
      args: ['-c:v', 'prores_ks', '-profile:v', '4', '-pix_fmt', 'yuva444p10le']
    },
    webm: {
      outputPath: path.join(outputDir, `${normalizedName}.webm`),
      codec: 'libvpx-vp9',
      args: ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-row-mt', '1', '-tile-columns', '2', '-auto-alt-ref', '0', '-crf', '30', '-b:v', '0']
    },
    hevc: {
      outputPath: path.join(outputDir, `${normalizedName}.mp4`),
      codec: 'hevc_videotoolbox',
      args: ['-c:v', 'hevc_videotoolbox', '-pix_fmt', 'bgra', '-alpha_quality', '0.75', '-allow_sw', '1', '-tag:v', 'hvc1', '-movflags', '+faststart']
    }
  };

  return {
    fps,
    frameCount,
    crop: { width: shellWidth, height: shellHeight, x: cropX, y: cropY },
    formats: selectedFormats,
    commands: selectedFormats.map((format) => ({
      format,
      codec: definitions[format].codec,
      command: 'ffmpeg',
      args: [...inputArgs, ...definitions[format].args, definitions[format].outputPath],
      outputPath: definitions[format].outputPath
    }))
  };
}

function boundedDiagnostic(value) {
  return String(value || '').replace(/\s+/gu, ' ').trim().slice(0, 1_000);
}

export function runProductVideoCommand(command, args, { captureOutput = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      if (captureOutput && stdout.length < 1_000_000) stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      if (stderr.length < 8_000) stderr += chunk;
    });
    child.on('error', (error) => reject(new Error(`${command} could not start: ${boundedDiagnostic(error.message)}`)));
    child.on('close', (status) => {
      if (status !== 0) {
        reject(new Error(`${command} exited with status ${status}: ${boundedDiagnostic(stderr)}`));
        return;
      }
      resolve({ status, stdout, stderr });
    });
  });
}

export async function executeProductVideoRenderPlan(plan, { runCommand = runProductVideoCommand } = {}) {
  const outputs = [];
  for (const entry of plan.commands) {
    await runCommand(entry.command, entry.args);
    const probe = await runCommand('ffprobe', [
      '-v', 'error',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      entry.outputPath
    ], { captureOutput: true });
    let evidence;
    try {
      evidence = JSON.parse(probe.stdout);
    } catch {
      throw new Error(`ffprobe returned invalid JSON for ${entry.format}`);
    }
    outputs.push({ format: entry.format, codec: entry.codec, path: entry.outputPath, probe: evidence });
  }
  return { fps: plan.fps, frameCount: plan.frameCount, crop: plan.crop, outputs };
}
