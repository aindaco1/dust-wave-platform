import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const script = readFileSync(new URL('../src/appearance-browser.js', import.meta.url), 'utf8');
const system = '(prefers-color-scheme: dark)';

function openPage(storage) {
  const window = new EventTarget();
  Object.defineProperty(window, 'localStorage', { get: storage });
  const document = new EventTarget();
  const sheet = { media: system };
  const select = new EventTarget();
  document.documentElement = { dataset: {} };
  document.currentScript = { dataset: { appearanceKey: 'workspace-theme' } };
  document.readyState = 'loading';
  document.querySelector = selector => selector.startsWith('link') ? sheet : select;
  runInNewContext(script, { document, window });
  function choose(mode) {
    select.value = mode;
    select.dispatchEvent(new Event('change'));
  }
  return { document, window, sheet, select, choose };
}

test('restores before parsing the control, scopes changes, and clears an override for System', () => {
  const values = new Map([['workspace-theme', 'dark'], ['other', 'light']]);
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key) };
  const { document, window, sheet, select, choose } = openPage(() => storage);
  assert.equal(sheet.media, 'all');
  assert.equal(document.documentElement.dataset.appearanceReady, undefined);
  document.dispatchEvent(new Event('DOMContentLoaded'));
  assert.equal(select.value, 'dark');
  assert.equal(document.documentElement.dataset.appearanceReady, '');
  choose('light');
  assert.equal(sheet.media, 'not all');
  assert.equal(values.get('workspace-theme'), 'light');
  choose('system');
  assert.equal(sheet.media, system);
  assert.deepEqual([...values], [['other', 'light']]);
  values.set('workspace-theme', 'dark');
  const notify = key => window.dispatchEvent(Object.assign(new Event('storage'), { key, storageArea: storage }));
  notify('other');
  assert.equal(select.value, 'system');
  notify('workspace-theme');
  assert.equal(select.value, 'dark');
  values.clear();
  notify(null);
  assert.equal(select.value, 'system');
  values.set('workspace-theme', 'light');
  window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
  assert.equal(sheet.media, 'not all');
});

test('invalid preferences and unavailable persistence leave the control usable', () => {
  const denied = () => { throw new Error('Storage unavailable'); };
  for (const storage of [denied, () => ({ getItem: () => 'unknown', setItem: denied, removeItem: denied })]) {
    const { document, sheet, select, choose } = openPage(storage);
    document.dispatchEvent(new Event('DOMContentLoaded'));
    assert.equal(select.value, 'system');
    choose('dark');
    assert.equal(sheet.media, 'all');
    choose('system');
    assert.equal(sheet.media, system);
  }
});
