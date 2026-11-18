import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from 'linkedom';
import { createBlockModel, createBlockEditor } from '../src/block-editor.js';
import { captureMediaTarget } from '../src/editor-media.js';

function fixture(initial, overrides = {}) {
  const document = new DOMParser().parseFromString('<html><body><div id="editor"></div></body></html>', 'text/html');
  const root = document.getElementById('editor');
  let blocks = initial;
  const editor = createBlockEditor(root, {
    getBlocks: () => blocks, setBlocks: value => { blocks = value; },
    renderBody: (card, block) => { const body = document.createElement('p'); body.textContent = block.body || block.text || ''; card.append(body); },
    ...overrides
  });
  editor.render();
  return { root, document, editor, blocks: () => blocks };
}

test('model preserves authored schema and dynamically restricted block/provider choices', () => {
  let email = false;
  const model = createBlockModel({ getTypes: () => email ? ['text', 'image', 'video'] : ['text', 'image', 'video', 'gallery'], getVideoProviders: () => email ? ['youtube', 'vimeo'] : ['youtube', 'vimeo', 'local'] });
  assert.equal(model.defaultBlock('/GALLERY').type, 'gallery');
  assert.equal(model.normalize({ type: 'video', provider: 'LOCAL' }).provider, 'local');
  email = true;
  assert.equal(model.defaultBlock('/gallery').type, 'text');
  assert.equal(model.normalize({ type: 'video', provider: 'local' }).provider, 'youtube');
  assert.throws(() => model.parse('{'), SyntaxError);
  assert.deepEqual(createBlockModel({ invalidJson: 'empty' }).parse('{'), []);
  assert.deepEqual(model.parse('{}'), []);
  const image = { type: 'image', src: '/image.png', alt: 'Preserve', decorative: 'true' };
  assert.equal(model.normalize(image).decorative, false);
  const store = createBlockModel({ normalizeDecorative: value => value === true || value === 'true', clearDecorativeAlt: true });
  assert.equal(store.normalize(image).alt, '');
  assert.equal(image.alt, 'Preserve');
});

test('reorder/render retain object identities used by outstanding media operations', () => {
  const first = { type: 'image', src: '/one.png' };
  const second = { type: 'gallery', images: [{ src: '/two.png', alt: 'Two' }] };
  const f = fixture([first, second]);
  const target = captureMediaTarget({ item: second, target: second.images[0], getItems: f.blocks, isAttached: () => true, contains: (block, image) => block.images.includes(image) });
  assert.equal(target.index(), 1);
  f.editor.mutate('up', 1);
  assert.equal(f.blocks()[0], second);
  assert.equal(target.index(), 0);
  f.editor.render();
  assert.equal(f.blocks()[0], second);
  f.editor.mutate('delete', 0);
  assert.equal(target.index(), -1);
  assert.equal(f.editor.mutate('delete', 0), false);
});

test('commands retain text, alignment and undo hooks without owning history or storage', () => {
  const changes = [];
  const f = fixture([{ type: 'text', body: 'Before\n\n/quote\n\nAfter', align: 'right' }], { beforeMutation: change => changes.push(change) });
  assert.equal(f.editor.insertSlash({ dataset: { contentIndex: '0', contentField: 'body' } }, f.blocks()[0].body), true);
  assert.deepEqual(f.blocks().map(b => b.type), ['text', 'quote', 'text']);
  assert.deepEqual(changes[0], { action: 'slash', index: 0, before: 'Before', after: 'After', align: 'right' });
  f.editor.mutate('type', 0, 'quote');
  assert.equal(f.blocks()[0].text, 'Before');
  assert.equal(f.blocks()[0].align, 'right');
  f.editor.mutate('type', 0, 'text');
  assert.equal(f.blocks()[0].body, 'Before');
  assert.equal(f.editor.mutate('up', -1), false);
  assert.equal(f.editor.mutate('down', 100), false);
  assert.equal(f.editor.mutate('up', NaN), false);
});

test('toolbar accessibility, localization and event rebinding are shared across instances', () => {
  const f = fixture([{ type: 'text', body: 'Words' }], { t: (key, fallback) => key === 'content_block_insert' ? 'Añadir bloque' : fallback });
  assert.equal(f.root.querySelector('.admin-content-insert__button').getAttribute('aria-label'), 'Añadir bloque');
  const card = f.root.querySelector('.admin-content-block');
  const chrome = card.querySelector('[data-content-chrome]');
  assert.equal(chrome.getAttribute('aria-hidden'), 'true');
  assert.equal(chrome.querySelector('button').getAttribute('tabindex'), '-1');
  f.editor.activate(card);
  assert.equal(chrome.getAttribute('aria-hidden'), 'false');
  assert.equal(chrome.querySelector('button').hasAttribute('tabindex'), false);
  const previous = f.editor.bind();
  f.editor.bind(); // only one set of handlers survives rebinding
  previous();
  previous();
  f.root.querySelector('[data-content-action="insert-block"]').click();
  assert.equal(f.blocks().length, 2);
  f.editor.destroy();
  f.root.querySelector('[data-content-action="insert-block"]').click();
  assert.equal(f.blocks().length, 2);
  const other = fixture([{ type: 'quote', text: 'Independent' }]);
  other.editor.mutate('insert-block', 1);
  assert.equal(f.blocks().length, 2);
});
