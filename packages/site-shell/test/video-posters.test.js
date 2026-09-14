import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../src/video-first-frame-poster-browser.js', import.meta.url), 'utf8');
function fixture({ observer = true, origin = 'https://example.test', baseURI = 'https://example.test/folder/', loading = false, attributes = '' } = {}) {
  const previews        = [], timers = new Map                    (), drawCalls        = [], watched        = [];
  let timerId = 0, observeCallback     , readyCallback     ;
  class Video {
    attrs = new Map                (); listeners = new Map                                              ();
    currentSrc = ''; poster = ''; src = ''; videoWidth = 2560; videoHeight = 1440; loads = 0;
    constructor(src = '/fixture.webm') { this.currentSrc = src; this.setAttribute('data-first-frame-poster', 'true'); }
    getAttribute(n        ) { return this.attrs.get(n) ?? null; } hasAttribute(n        ) { return this.attrs.has(n); }
    setAttribute(n        , v        ) { this.attrs.set(n, v); }
    removeAttribute(n        ) { this.attrs.delete(n); if (n === 'src') this.src = ''; }
    querySelector() { return null; } querySelectorAll() { return []; }
    addEventListener(n        , fn            , opts      = {}) { const list = this.listeners.get(n) || []; list.push({ fn, once: opts.once }); this.listeners.set(n, list); }
    emit(n        ) { for (const item of [...(this.listeners.get(n) || [])]) { if (item.once) this.listeners.set(n, this.listeners.get(n) .filter(x => x !== item)); item.fn(); } }
    load() { this.loads++; }
  }
  const video = new Video();
  const script = { getAttribute: (name        ) => attributes.match(new RegExp(`${name}="([^"]*)"`))?.[1] || null };
  const document = {
    baseURI, readyState: loading ? 'loading' : 'complete', currentScript: script,
    addEventListener: (_n        , fn     ) => { readyCallback = fn; },
    querySelector: () => script, querySelectorAll: () => [video],
    createElement: (tag        ) => {
      if (tag === 'video') { const preview = new Video(''); previews.push(preview); return preview; }
      return { width: 0, height: 0, getContext() { return { drawImage: (...args       ) => drawCalls.push(args) }; }, toDataURL: () => 'data:image/jpeg;base64,fixture' };
    },
  };
  class Observer { constructor(fn     ) { observeCallback = fn; } observe(v     ) { watched.push(v); } unobserve(v     ) { watched.splice(watched.indexOf(v), 1); } }
  const window      = { location: { origin, href: 'https://example.test/page/' }, setTimeout: (fn     ) => { timers.set(++timerId, fn); return timerId; }, clearTimeout: (id        ) => timers.delete(id) };
  if (observer) window.IntersectionObserver = Observer;
  vm.runInNewContext(source, { window, document, HTMLVideoElement: Video, IntersectionObserver: Observer, URL, Date });
  return { window, video, previews, timers, watched, drawCalls, ready: () => readyCallback(), trigger: (visible = true) => observeCallback([{ target: video, isIntersecting: visible, intersectionRatio: visible ? 1 : 0 }]), runTimer: () => { const [id, fn] = timers.entries().next().value ; timers.delete(id); fn(); } };
}


for (const mode of ['page', 'document-base']) {
  test('poster lifecycle preserves ' + mode + ' policy', () => {
    const attributes = 'data-poster-global="ExamplePosters" data-poster-cache-key="example_poster" data-poster-url-base="' + mode + '"';
    const f = fixture({ attributes, loading: true });
    assert.equal(f.watched.length, 0); f.ready(); f.trigger(false);
    assert.equal(f.previews.length, 0); f.trigger();
    assert.ok(new URL(f.previews[0].src).searchParams.has('example_poster'));
    f.previews[0].emit('loadeddata'); f.previews[0].emit('canplay'); f.window.ExamplePosters.init(f.video);
    assert.equal(f.drawCalls.length, 1); assert.deepEqual(f.drawCalls[0].slice(1), [0, 0, 1280, 720]);
    assert.equal(f.video.poster, 'data:image/jpeg;base64,fixture'); assert.equal(f.previews[0].src, ''); assert.equal(f.timers.size, 0);
    const opaque = fixture({ attributes, origin: 'null' }); opaque.trigger();
    assert.equal(opaque.previews.length, mode === 'document-base' ? 1 : 0);
    const alternateBase = fixture({ attributes, baseURI: 'https://other.test/base/' }); alternateBase.video.currentSrc='relative.webm'; alternateBase.trigger();
    assert.equal(alternateBase.previews.length, mode === 'document-base' ? 0 : 1);
  });
}
test('fallback delay, timeout and errors release pending state for retry', () => {
  const f = fixture({ observer: false }); assert.equal(f.previews.length, 0); f.runTimer();
  f.previews[0].emit('error'); assert.equal(f.video.hasAttribute('data-first-frame-poster-pending'), false);
  f.window.DustWaveVideoPosters.init(f.video); f.runTimer(); f.runTimer();
  assert.equal(f.previews.length, 2); assert.equal(f.video.hasAttribute('data-first-frame-poster-ready'), false);
  assert.equal(f.video.hasAttribute('data-first-frame-poster-pending'), false);
});
test('invalid policy falls back and existing posters or foreign origins do not fetch', () => {
  const f = fixture({ attributes: 'data-poster-global="__proto__" data-poster-cache-key="bad key"' }); f.trigger();
  assert.ok(f.window.DustWaveVideoPosters); assert.ok(new URL(f.previews[0].src).searchParams.has('dustwave_first_frame_poster'));
  const existing=fixture(); existing.video.poster='existing.jpg'; existing.trigger(); assert.equal(existing.previews.length,0);
  const external=fixture(); external.video.currentSrc='https://other.test/video.webm'; external.trigger(); assert.equal(external.previews.length,0);
});
