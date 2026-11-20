// A classic head script can apply a saved appearance before the body is painted.
(() => {
  const key = document.currentScript?.dataset.appearanceKey;
  const sheet = document.querySelector('link[data-appearance-dark]');
  if (!key || !sheet) return;

  const systemMedia = sheet.media;
  let preference = 'system';
  let control;
  let storage;
  try { storage = window.localStorage; } catch { /* Storage can be blocked. */ }

  function apply(value) {
    preference = value === 'light' || value === 'dark' ? value : 'system';
    sheet.media = preference === 'system' ? systemMedia : preference === 'dark' ? 'all' : 'not all';
    document.documentElement.dataset.appearance = preference;
    if (control) control.value = preference;
  }

  function restore() {
    let saved = preference;
    try { if (storage) saved = storage.getItem(key); } catch { /* Use the current page's choice. */ }
    apply(saved);
  }

  restore();
  function bind() {
    control = document.querySelector('select[data-appearance-select]');
    if (!control) return;
    control.value = preference;
    control.addEventListener('change', () => {
      apply(control.value);
      try {
        if (preference === 'system') storage?.removeItem(key);
        else storage?.setItem(key, preference);
      } catch { /* The choice still applies to this page. */ }
    });
    document.documentElement.dataset.appearanceReady = '';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
  window.addEventListener('storage', event => {
    if (event.storageArea === storage && (event.key === key || event.key === null)) restore();
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) restore();
  });
})();
