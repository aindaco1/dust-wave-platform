import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const SHIPPING_PATH = new URL('../src/shipping-option-utils-browser.js', import.meta.url);
const DEFERRED_STYLES_PATH = new URL('../src/deferred-stylesheets-browser.js', import.meta.url);
const FORM_IDENTITY_PATH = new URL('../src/form-control-identity-browser.js', import.meta.url);
const CART_ICON_PATH = new URL('../src/cart-icon-browser.js', import.meta.url);

async function runClassicScript(path, globals) {
  const source = await readFile(path, 'utf8');
  vm.runInNewContext(source, globals, { filename: path.pathname });
}

function domGlobals(window, extras = {}) {
  return {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    Document: window.Document,
    DocumentFragment: window.DocumentFragment,
    MutationObserver: window.MutationObserver,
    ...extras
  };
}

test('shipping option utilities preserve Pool and Store quote selection semantics', async () => {
  const window = {};
  await runClassicScript(SHIPPING_PATH, { window });
  const utils = window.DustWaveShippingOptionUtils;
  const availableOptions = [
    { id: 'standard', label: 'Standard', shippingCents: 700, priceDeltaCents: 0 },
    { id: 'signature_required', label: 'Signature', shippingCents: 1095, priceDeltaCents: 395 }
  ];

  assert.equal(utils.normalizeSelection(availableOptions, 'SIGNATURE_REQUIRED', 'standard'), 'signature_required');
  assert.equal(utils.normalizeSelection(availableOptions, 'missing', 'standard'), 'standard');
  const resolved = utils.resolveQuote({
    quotes: [{ source: 'usps_live', shippingCents: 700, shipment: { hasPhysical: true }, availableOptions }]
  }, 'signature_required', 300);
  assert.equal(resolved.shippingCents, 1095);
  assert.equal(resolved.source, 'usps_live');
  assert.equal(resolved.availableOptions, availableOptions);
  assert.equal(resolved.defaultOption, 'standard');
  assert.equal(resolved.selectedOption, 'signature_required');
  assert.equal(utils.shouldShowOptions({ source: 'usps_live', shippingCents: 700, availableOptions }), true);
  assert.equal(utils.formatChoice(availableOptions[1], () => 'Signature', (cents) => `$${(cents / 100).toFixed(2)}`), 'Signature (+$3.95)');
});

test('deferred stylesheet activation remains dependency-free and idempotent', async () => {
  const { window } = parseHTML('<html><head><link media="print" data-deferred-stylesheet="true"><link media="screen"></head></html>');
  await runClassicScript(DEFERRED_STYLES_PATH, domGlobals(window));

  const links = window.document.querySelectorAll('link');
  assert.equal(links[0].media, 'all');
  assert.equal(links[0].hasAttribute('data-deferred-stylesheet'), false);
  assert.equal(links[1].media, 'screen');
});

test('form control identities use bounded consumer policy without replacing explicit identity', async () => {
  const { window } = parseHTML(`<html><head>
    <script data-dustwave-form-control-identity="true"
      data-form-control-id-prefix="example-form-control"
      data-identity-dataset-keys="exampleAction,action"></script>
    </head><body>
      <button data-example-action="Launch copy">Copy</button>
      <input aria-label="Search">
      <select id="existing"></select>
      <textarea name="notes"></textarea>
    </body></html>`);
  delete window.DustWaveFormControlIdentity;
  await runClassicScript(FORM_IDENTITY_PATH, domGlobals(window));
  window.DustWaveFormControlIdentity.start(window.document);

  assert.match(window.document.querySelector('button').id, /^example-form-control-launch-copy-/);
  assert.match(window.document.querySelector('input').id, /^example-form-control-search-/);
  assert.equal(window.document.querySelector('select').id, 'existing');
  assert.equal(window.document.querySelector('textarea').id, '');
  assert.deepEqual(
    Array.from(window.DustWaveFormControlIdentity.policy.identityDatasetKeys),
    ['exampleAction', 'action']
  );
});

test('invalid form identity policy falls back to safe generic names', async () => {
  const { window } = parseHTML(`<html><head>
    <script data-dustwave-form-control-identity="true"
      data-form-control-id-prefix="../../bad prefix"
      data-identity-dataset-keys="__proto__,bad key"></script>
    </head><body><button data-action="Save">Save</button></body></html>`);
  delete window.DustWaveFormControlIdentity;
  await runClassicScript(FORM_IDENTITY_PATH, domGlobals(window));
  window.DustWaveFormControlIdentity.start(window.document);

  assert.match(window.document.querySelector('button').id, /^dustwave-form-control-save-/);
  assert.equal(window.DustWaveFormControlIdentity.policy.idPrefix, 'dustwave-form-control');
});

test('cart icon policy injects only provider, event, and cache identity', async () => {
  const { window } = parseHTML(`<html><head>
    <script data-dustwave-cart-icon="true"
      data-cart-cache-key="example_cart_cache"
      data-cart-provider-global="ExampleCartProvider"
      data-cart-provider-ready-event="examplecart.provider.ready"
      data-cart-ready-event="examplecart.ready"></script>
    </head><body>
      <button id="header-cart-btn">
        <span class="site-header__cart-count"></span>
        <span class="site-header__cart-price"></span>
      </button>
    </body></html>`);
  const storage = new Map();
  const localStorage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value)
  };
  var openCount = 0;
  window.ExampleCartProvider = {
    activeRuntime: 'first_party',
    getDisplaySummary: () => ({ total: 12.98, count: 1 }),
    getApi: () => ({ api: { theme: { cart: { open: () => { openCount += 1; } } } } }),
    store: { getState: () => ({}), subscribe: () => () => {} },
    events: { on: () => () => {} }
  };
  await runClassicScript(CART_ICON_PATH, domGlobals(window, { localStorage }));

  const button = window.document.getElementById('header-cart-btn');
  assert.equal(window.document.querySelector('.site-header__cart-price').textContent, '$12.98');
  assert.equal(window.document.querySelector('.site-header__cart-count').textContent, '1');
  assert.equal(button.getAttribute('aria-label'), 'Open cart. 1 item, $12.98 total.');
  assert.deepEqual(JSON.parse(storage.get('example_cart_cache')), { total: 12.98, count: 1 });
  button.click();
  assert.equal(openCount, 1);
});
