const LOW_SEVERITY_LEVELS = new Set(['debug', 'info', 'log']);
const MAX_SCOPE_LENGTH = 160;
const MAX_ERROR_MESSAGE_LENGTH = 2000;
const MAX_ERROR_STACK_LENGTH = 8000;

function boundedLabel(value, label, maxLength = 80) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new TypeError(`${label} must be a bounded printable string`);
  }
  return normalized;
}

function normalizeScope(value) {
  const normalized = String(value || 'worker').trim();
  if (!normalized || normalized.length > MAX_SCOPE_LENGTH || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new TypeError('Log scope must be a bounded printable string');
  }
  return normalized;
}

function normalizeArg(arg) {
  if (!(arg instanceof Error)) return arg;
  return {
    name: String(arg.name || 'Error').slice(0, 160),
    message: String(arg.message || '').slice(0, MAX_ERROR_MESSAGE_LENGTH),
    stack: arg.stack ? String(arg.stack).slice(0, MAX_ERROR_STACK_LENGTH) : null
  };
}

export function createScopedConsoleFactory({
  productName,
  runtimeName = 'Worker',
  consoleTarget = globalThis.console,
  now = () => new Date()
} = {}) {
  const product = boundedLabel(productName, 'Product name');
  const runtime = boundedLabel(runtimeName, 'Runtime name');
  if (!consoleTarget || typeof consoleTarget.log !== 'function') {
    throw new TypeError('A console-compatible target is required');
  }
  if (typeof now !== 'function') throw new TypeError('Logger time source must be a function');

  const ownerCache = new WeakMap();
  const getMethod = (level) => typeof consoleTarget[level] === 'function'
    ? consoleTarget[level].bind(consoleTarget)
    : consoleTarget.log.bind(consoleTarget);
  const timestamp = () => {
    try {
      return now().toISOString();
    } catch {
      return 'unknown-time';
    }
  };
  const shouldLog = (config, level) => config.consoleLoggingEnabled === true
    && (config.verboseConsoleLogging === true || !LOW_SEVERITY_LEVELS.has(level));

  function createConsole(config, scope) {
    const normalizedScope = normalizeScope(scope);
    const scoped = {
      child(childScope) {
        return createConsole(config, `${normalizedScope}:${normalizeScope(childScope)}`);
      }
    };
    for (const level of ['debug', 'info', 'log', 'warn', 'error']) {
      scoped[level] = (...args) => {
        if (!shouldLog(config, level)) return;
        getMethod(level)(
          `[${product} ${timestamp()}]`,
          `[${product} ${runtime}:${normalizedScope}]`,
          `[${level.toUpperCase()}]`,
          ...args.map(normalizeArg)
        );
      };
    }
    return Object.freeze(scoped);
  }

  function getScopedConsole(owner, scope = 'worker', config = {}) {
    const normalizedConfig = {
      consoleLoggingEnabled: config.consoleLoggingEnabled === true,
      verboseConsoleLogging: config.verboseConsoleLogging === true
    };
    if (!owner || typeof owner !== 'object') {
      return createConsole(normalizedConfig, scope);
    }
    let scopedCache = ownerCache.get(owner);
    if (!scopedCache) {
      scopedCache = new Map();
      ownerCache.set(owner, scopedCache);
    }
    const normalizedScope = normalizeScope(scope);
    const cacheKey = `${normalizedScope}:${normalizedConfig.consoleLoggingEnabled}:${normalizedConfig.verboseConsoleLogging}`;
    if (!scopedCache.has(cacheKey)) {
      scopedCache.set(cacheKey, createConsole(normalizedConfig, normalizedScope));
    }
    return scopedCache.get(cacheKey);
  }

  return Object.freeze({ getScopedConsole });
}
