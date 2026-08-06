(function() {
  'use strict';

  if (window.DustWaveFormControlIdentity?.start) return;

  var policyScript = document.currentScript || document.querySelector('script[data-dustwave-form-control-identity="true"]');
  var requestedPrefix = String(policyScript?.dataset?.formControlIdPrefix || 'dustwave-form-control').trim().toLowerCase();
  var idPrefix = /^[a-z][a-z0-9-]{0,47}$/.test(requestedPrefix)
    ? requestedPrefix
    : 'dustwave-form-control';
  var requestedDatasetKeys = String(policyScript?.dataset?.identityDatasetKeys || 'action,itemId,scrollTarget')
    .split(',')
    .map(function(value) { return value.trim(); })
    .filter(function(value) { return /^[a-z][A-Za-z0-9]{0,47}$/.test(value); })
    .slice(0, 20);
  var identityDatasetKeys = requestedDatasetKeys.length
    ? requestedDatasetKeys
    : ['action', 'itemId', 'scrollTarget'];
  var controlIdCounter = 0;
  var observedRoots = new WeakSet();
  var controlSelector = 'input, select, textarea, button';

  function slugifyControlPart(value, fallback) {
    return String(value || fallback || 'control')
      .trim()
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || fallback || 'control';
  }

  function controlIdentityBase(control) {
    if (!(control instanceof HTMLElement)) return 'control';
    var dataset = control.dataset || {};
    for (var index = 0; index < identityDatasetKeys.length; index += 1) {
      var datasetValue = dataset[identityDatasetKeys[index]];
      if (datasetValue) return datasetValue;
    }
    return control.getAttribute('aria-label') ||
      control.textContent ||
      control.className ||
      control.tagName.toLowerCase();
  }

  function ensureControlIdentity(control) {
    if (!(control instanceof HTMLElement) || !control.matches(controlSelector)) return;
    if (control.id || control.getAttribute('name')) return;
    control.id = idPrefix + '-' + slugifyControlPart(controlIdentityBase(control), control.tagName.toLowerCase()) + '-' + String(++controlIdCounter);
  }

  function ensureControlIdentities(root) {
    if (!(root instanceof Element || root instanceof Document || root instanceof DocumentFragment)) return;
    if (root instanceof Element) ensureControlIdentity(root);
    root.querySelectorAll(controlSelector).forEach(ensureControlIdentity);
  }

  function start(root) {
    var target = root || document;
    var observeTarget = target instanceof Document ? target.documentElement : target;
    ensureControlIdentities(target);
    if (!(observeTarget instanceof Element) || observedRoots.has(observeTarget) || !window.MutationObserver) return;
    observedRoots.add(observeTarget);
    var observer = new MutationObserver(function(records) {
      records.forEach(function(record) {
        record.addedNodes.forEach(function(node) {
          ensureControlIdentities(node);
        });
      });
    });
    observer.observe(observeTarget, { childList: true, subtree: true });
  }

  window.DustWaveFormControlIdentity = {
    start: start,
    policy: Object.freeze({ idPrefix: idPrefix, identityDatasetKeys: identityDatasetKeys.slice() })
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      start(document);
    }, { once: true });
  } else {
    start(document);
  }
})();
