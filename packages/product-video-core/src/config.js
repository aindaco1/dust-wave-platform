const DEFAULT_CAPTURE = Object.freeze({
  fps: 24,
  timingMultiplier: 1,
  preRollMs: 500,
  postRollMs: 1_000,
  minimumEffectiveFpsRatio: 0.75,
  viewport: Object.freeze({ width: 1_920, height: 1_080 }),
  shell: Object.freeze({ width: 1_480, height: 960, radius: 24 }),
  cursor: Object.freeze({ startX: 1_600, startY: 920, moveDurationMs: 500 })
});

const ACTION_TYPES = new Set(['click', 'goto', 'wait', 'waitForURLIncludes']);
const MAX_ACTIONS = 64;
const MAX_EXPECTED_DURATION_MS = 120_000;

function objectValue(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function boundedString(value, label, { min = 1, max = 2_048 } = {}) {
  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new RangeError(`${label} is outside its allowed bounds`);
  }
  return normalized;
}

function boundedNumber(value, fallback, label, { min, max, integer = false }) {
  const candidate = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(candidate) || candidate < min || candidate > max || (integer && !Number.isInteger(candidate))) {
    throw new RangeError(`${label} is outside its allowed bounds`);
  }
  return candidate;
}

function relativeSitePath(value, label) {
  const normalized = boundedString(value, label);
  if (!normalized.startsWith('/') || normalized.startsWith('//')) {
    throw new RangeError(`${label} must be a same-origin absolute path`);
  }
  const parsed = new URL(normalized, 'https://product-video.invalid');
  if (parsed.origin !== 'https://product-video.invalid') {
    throw new RangeError(`${label} must be a same-origin absolute path`);
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function optionalDuration(value, fallback, label, { min = 0, max = 30_000 } = {}) {
  return boundedNumber(value, fallback, label, { min, max, integer: true });
}

function normalizeAction(value, index, defaultCursorMoveDurationMs) {
  const action = objectValue(value, `actions[${index}]`);
  const type = boundedString(action.action, `actions[${index}].action`, { max: 32 });
  if (!ACTION_TYPES.has(type)) {
    throw new RangeError(`actions[${index}].action is unsupported`);
  }

  if (type === 'wait') {
    return {
      action: type,
      ms: optionalDuration(action.ms, undefined, `actions[${index}].ms`, { max: 30_000 })
    };
  }

  if (type === 'waitForURLIncludes') {
    return {
      action: type,
      value: boundedString(action.value, `actions[${index}].value`),
      timeoutMs: optionalDuration(action.timeoutMs, 15_000, `actions[${index}].timeoutMs`, { min: 100 })
    };
  }

  if (type === 'goto') {
    return {
      action: type,
      url: relativeSitePath(action.url, `actions[${index}].url`),
      waitAfterMs: optionalDuration(action.waitAfterMs, 0, `actions[${index}].waitAfterMs`)
    };
  }

  return {
    action: type,
    selector: boundedString(action.selector, `actions[${index}].selector`),
    timeoutMs: optionalDuration(action.timeoutMs, 15_000, `actions[${index}].timeoutMs`, { min: 100 }),
    moveDurationMs: optionalDuration(action.moveDurationMs, defaultCursorMoveDurationMs, `actions[${index}].moveDurationMs`, { max: 10_000 }),
    delayMs: optionalDuration(action.delayMs, 40, `actions[${index}].delayMs`, { max: 2_000 }),
    waitAfterMs: optionalDuration(action.waitAfterMs, 0, `actions[${index}].waitAfterMs`)
  };
}

function expectedDurationMs(flow) {
  let duration = flow.capture.preRollMs + flow.capture.postRollMs;
  for (const action of flow.actions) {
    if (action.action === 'wait') duration += action.ms;
    if (action.action === 'click') duration += action.moveDurationMs + action.delayMs + action.waitAfterMs + 80;
    if (action.action === 'goto') duration += action.waitAfterMs;
  }
  return Math.round(duration * flow.capture.timingMultiplier);
}

export function normalizeProductVideoBaseUrl(value, { allowRemote = false } = {}) {
  const normalized = boundedString(value, 'baseUrl');
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new RangeError('baseUrl must be an absolute HTTP(S) origin');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new RangeError('baseUrl must be an absolute HTTP(S) origin');
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new RangeError('baseUrl must not include a path');
  }
  const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
  if (!allowRemote && !loopbackHosts.has(parsed.hostname)) {
    throw new RangeError('baseUrl must use a loopback host unless remote capture is explicitly allowed');
  }
  return parsed.origin;
}

export function normalizeProductVideoFlow(value) {
  const input = objectValue(value, 'flow');
  const captureInput = objectValue(input.capture || {}, 'capture');
  const viewportInput = objectValue(captureInput.viewport || {}, 'capture.viewport');
  const shellInput = objectValue(captureInput.shell || {}, 'capture.shell');
  const cursorInput = objectValue(captureInput.cursor || {}, 'capture.cursor');
  const presentationInput = input.presentation === undefined
    ? {}
    : objectValue(input.presentation, 'presentation');

  const viewport = {
    width: boundedNumber(viewportInput.width, DEFAULT_CAPTURE.viewport.width, 'capture.viewport.width', { min: 320, max: 4_096, integer: true }),
    height: boundedNumber(viewportInput.height, DEFAULT_CAPTURE.viewport.height, 'capture.viewport.height', { min: 240, max: 2_160, integer: true })
  };
  const shell = {
    width: boundedNumber(shellInput.width, DEFAULT_CAPTURE.shell.width, 'capture.shell.width', { min: 240, max: viewport.width, integer: true }),
    height: boundedNumber(shellInput.height, DEFAULT_CAPTURE.shell.height, 'capture.shell.height', { min: 180, max: viewport.height, integer: true }),
    radius: boundedNumber(shellInput.radius, DEFAULT_CAPTURE.shell.radius, 'capture.shell.radius', { min: 0, max: 200, integer: true })
  };
  const cursor = {
    startX: boundedNumber(cursorInput.startX, DEFAULT_CAPTURE.cursor.startX, 'capture.cursor.startX', { min: 0, max: viewport.width, integer: true }),
    startY: boundedNumber(cursorInput.startY, DEFAULT_CAPTURE.cursor.startY, 'capture.cursor.startY', { min: 0, max: viewport.height, integer: true }),
    moveDurationMs: optionalDuration(cursorInput.moveDurationMs, DEFAULT_CAPTURE.cursor.moveDurationMs, 'capture.cursor.moveDurationMs', { max: 10_000 })
  };
  if (!Array.isArray(input.actions) || input.actions.length === 0 || input.actions.length > MAX_ACTIONS) {
    throw new RangeError(`actions must contain between 1 and ${MAX_ACTIONS} entries`);
  }

  const normalized = {
    name: boundedString(input.name, 'name', { max: 120 }),
    initialPath: relativeSitePath(input.initialPath || '/', 'initialPath'),
    presentation: {
      stylesheetPath: presentationInput.stylesheetPath === undefined
        ? null
        : relativeSitePath(presentationInput.stylesheetPath, 'presentation.stylesheetPath')
    },
    capture: {
      fps: boundedNumber(captureInput.fps, DEFAULT_CAPTURE.fps, 'capture.fps', { min: 1, max: 60, integer: true }),
      timingMultiplier: boundedNumber(captureInput.timingMultiplier, DEFAULT_CAPTURE.timingMultiplier, 'capture.timingMultiplier', { min: 0.1, max: 10 }),
      preRollMs: optionalDuration(captureInput.preRollMs, DEFAULT_CAPTURE.preRollMs, 'capture.preRollMs'),
      postRollMs: optionalDuration(captureInput.postRollMs, DEFAULT_CAPTURE.postRollMs, 'capture.postRollMs'),
      minimumEffectiveFpsRatio: boundedNumber(captureInput.minimumEffectiveFpsRatio, DEFAULT_CAPTURE.minimumEffectiveFpsRatio, 'capture.minimumEffectiveFpsRatio', { min: 0.25, max: 1 }),
      viewport,
      shell,
      cursor
    },
    actions: input.actions.map((action, index) => normalizeAction(action, index, cursor.moveDurationMs))
  };
  const expected = expectedDurationMs(normalized);
  if (expected > MAX_EXPECTED_DURATION_MS) {
    throw new RangeError(`flow expected duration exceeds ${MAX_EXPECTED_DURATION_MS}ms`);
  }
  return { ...normalized, expectedDurationMs: expected };
}
