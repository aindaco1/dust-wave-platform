export function createStorageShim() {
  const backingStore = new Map();
  return {
    get length() {
      return backingStore.size;
    },
    clear() {
      backingStore.clear();
    },
    getItem(key) {
      return backingStore.has(String(key))
        ? backingStore.get(String(key)) ?? null
        : null;
    },
    key(index) {
      return Array.from(backingStore.keys())[index] ?? null;
    },
    removeItem(key) {
      backingStore.delete(String(key));
    },
    setItem(key, value) {
      backingStore.set(String(key), String(value));
    }
  };
}

export function syncBrowserStorageGlobals(target = globalThis) {
  if (!target?.window) return;
  installStorageShim(target, 'localStorage');
  installStorageShim(target, 'sessionStorage');
}

export async function expectNoHorizontalOverflow(page, {
  expectTarget,
  tolerancePixels = 1
} = {}) {
  if (!page || typeof page.evaluate !== 'function') {
    throw new TypeError('page.evaluate is required');
  }
  if (!expectTarget || typeof expectTarget.poll !== 'function') {
    throw new TypeError('expectTarget.poll is required');
  }
  if (!Number.isFinite(tolerancePixels) || tolerancePixels < 0 || tolerancePixels > 100) {
    throw new RangeError('tolerancePixels must be between zero and 100');
  }
  await expectTarget
    .poll(() => page.evaluate(() => {
      const root = document.scrollingElement || document.documentElement;
      return Math.ceil(root.scrollWidth - window.innerWidth);
    }))
    .toBeLessThanOrEqual(tolerancePixels);
}

function installStorageShim(target, name) {
  const browserWindow = target.window;
  const existing = browserWindow?.[name];
  const usableExisting = existing
    && typeof existing.clear === 'function'
    && typeof existing.getItem === 'function';
  const storage = usableExisting ? existing : createStorageShim();
  defineStorage(target, name, storage);
  if (browserWindow) defineStorage(browserWindow, name, storage);
}

function defineStorage(target, name, storage) {
  Object.defineProperty(target, name, {
    configurable: true,
    enumerable: true,
    writable: true,
    value: storage
  });
}
