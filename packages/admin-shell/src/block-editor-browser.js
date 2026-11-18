(function(scope) {
  "use strict";
  if (scope.DustWaveAdminShellBlockEditor) return;

  const blockTypes = Object.freeze(['text', 'quote', 'image', 'gallery', 'video', 'audio', 'embed', 'divider']);
  const alignments = Object.freeze(['left', 'center', 'right', 'justify']);
  const textFormats = Object.freeze(['p', 'h2', 'h3', 'h4']);
  const normalized = value => String(value || '').trim().toLowerCase();
  const alignment = value => alignments.includes(normalized(value)) ? normalized(value) : 'left';
  const galleryLayout = value => normalized(value) === 'carousel' ? 'carousel' : 'grid';
  const galleryCaptionStyle = value => normalized(value) === 'overlay' ? 'overlay' : 'inline';

  // Policy preserves consumers' authored data contracts. No persistence or URL trust here.
  function createBlockModel({ getTypes = () => blockTypes, getVideoProviders = () => ['youtube', 'vimeo', 'local'],
    normalizeDecorative = value => value === true, clearDecorativeAlt = false, invalidJson = 'throw' } = {}) {
    function command(value) {
      const type = normalized(value).replace(/^\/+/, '');
      return getTypes().includes(type) ? type : 'text';
    }
    function videoProvider(value) {
      const provider = normalized(value);
      return getVideoProviders().includes(provider) ? provider : 'youtube';
    }
    function defaultBlock(type) {
      var align = 'left';
      switch (command(type)) {
        case 'quote':
          return { type: 'quote', text: '', author: '', align: align };
        case 'image':
          return { type: 'image', src: '', alt: '', decorative: false, caption: '', align: align };
        case 'gallery':
          return { type: 'gallery', layout: 'grid', caption_style: 'inline', images: [], caption: '', align: align };
        case 'video':
          return { type: 'video', provider: 'youtube', video_id: '', src: '', poster: '', caption: '', align: align };
        case 'audio':
          return { type: 'audio', src: '', title: '', caption: '', align: align };
        case 'embed':
          return { type: 'embed', provider: 'spotify', src: '', title: '', caption: '', align: align };
        case 'divider':
          return { type: 'divider', align: align };
        default:
          return { type: 'text', body: '', align: align };
      }
    }
    function normalize(block) {
      if (!block || typeof block !== 'object') return defaultBlock('text');
      var type = command(block.type);
      var normalized = defaultBlock(type);
      Object.keys(normalized).forEach(function(key) {
        if (key === 'type') return;
        if (key === 'images') {
          normalized.images = Array.isArray(block.images)
            ? block.images.map(function(image) {
              return {
                src: String(image?.src || ''),
                alt: String(image?.alt || ''),
                decorative: image?.decorative === true,
                caption: String(image?.caption || '')
              };
            })
            : [];
          return;
        }
        if (key === 'layout') {
          normalized.layout = galleryLayout(block.layout);
          return;
        }
        if (key === 'caption_style') {
          normalized.caption_style = galleryCaptionStyle(block.caption_style);
          return;
        }
        if (key === 'provider' && type === 'video') {
          normalized.provider = videoProvider(block.provider);
          return;
        }
        normalized[key] = key === 'decorative' ? normalizeDecorative(block[key]) : String(block[key] || '');
      });
      normalized.align = alignment(block.align);
      if (clearDecorativeAlt && normalized.decorative) normalized.alt = '';
      return normalized;
    }
    function parse(value) {
      if (Array.isArray(value)) return value.map(normalize);
      if (typeof value !== 'string' || !value.trim()) return [];
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(normalize) : [];
      } catch (error) {
        if (invalidJson === 'empty') return [];
        throw error;
      }
    }
    return Object.freeze({ getTypes, command, videoProvider, defaultBlock, normalize, parse, alignment, galleryLayout, galleryCaptionStyle });
  }

  function createIcon(name, document = scope.document) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.classList.add('admin-content-block__icon');
    var paths = {
      alignLeft: ['M4 6h16', 'M4 10h11', 'M4 14h16', 'M4 18h11'],
      alignCenter: ['M4 6h16', 'M7 10h10', 'M4 14h16', 'M7 18h10'],
      alignRight: ['M4 6h16', 'M9 10h11', 'M4 14h16', 'M9 18h11'],
      alignJustify: ['M4 6h16', 'M4 10h16', 'M4 14h16', 'M4 18h16'],
      info: ['M12 16v-4', 'M12 8h.01', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z'],
      link: ['M10 13a5 5 0 0 0 7.1 0l1.4-1.4a5 5 0 0 0-7.1-7.1L10.5 5.4', 'M14 11a5 5 0 0 0-7.1 0L5.5 12.4a5 5 0 0 0 7.1 7.1l.9-.9'],
      list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
      listOrdered: ['M10 6h11', 'M10 12h11', 'M10 18h11', 'M4 6h1v4', 'M4 10h2', 'M6 18H4c0-1 2-2 2-3s-1-1.5-2-1'],
      arrowUp: ['M12 19V5', 'M5 12l7-7 7 7'],
      arrowDown: ['M12 5v14', 'M19 12l-7 7-7-7'],
      trash: ['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 14H6L5 6', 'M10 11v6', 'M14 11v6'],
      settings: [
        'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.16.09a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.18a2 2 0 0 1-1 1.73l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.16.09a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.16-.09a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.18a2 2 0 0 1 1-1.73l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.16-.09a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
        'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
      ]
    };
    (paths[name] || []).forEach(function(definition) {
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', definition);
      svg.append(path);
    });
    return svg;
  }

  function createToolbarGroup(label, document) {
    var group = document.createElement('div');
    group.className = 'admin-content-block__toolbar-group';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', label);
    return group;
  }

  function createChrome(block, index, count, { document, model, t, moveLabels, linkPanelRole }) {
    var chrome = document.createElement('div');
    chrome.className = 'admin-content-block__chrome';
    chrome.dataset.contentChrome = 'true';
    chrome.setAttribute('aria-hidden', 'true');
    chrome.addEventListener('mousedown', function(event) {
      if (event.target?.closest?.('button')) {
        event.preventDefault();
      }
    });
    var typeLabel = document.createElement('label');
    typeLabel.className = 'admin-content-block__type admin-content-block__toolbar-group admin-content-block__toolbar-group--type';
    var select = document.createElement('select');
    select.className = 'admin-content-block__select';
    select.dataset.contentIndex = String(index);
    select.dataset.contentAction = 'type';
    select.setAttribute('aria-label', t('content_block_type', 'Block type'));
    model.getTypes().forEach(function(type) {
      var option = document.createElement('option');
      option.value = type;
      option.textContent = t('content_block_' + type, type.charAt(0).toUpperCase() + type.slice(1));
      option.selected = block.type === type;
      select.append(option);
    });
    typeLabel.append(select);

    var headerRow = document.createElement('div');
    headerRow.className = 'admin-content-block__chrome-row admin-content-block__chrome-row--header';
    var formatRow = document.createElement('div');
    formatRow.className = 'admin-content-block__chrome-row admin-content-block__chrome-row--format';
    var actions = document.createElement('div');
    actions.className = 'admin-content-block__actions';
    if (block.type === 'text' || block.type === 'quote') {
      var formatGroup = createToolbarGroup(t('content_format_group', 'Text styling'), document);
      var formatButtons = [
        { action: 'format-bold', label: t('content_format_bold', 'Bold'), text: 'B' },
        { action: 'format-italic', label: t('content_format_italic', 'Italic'), text: 'I' },
        { action: 'format-underline', label: t('content_format_underline', 'Underline'), text: 'U' }
      ];
      if (block.type === 'text') {
        formatButtons.push(
          { action: 'format-link', label: t('content_format_link', 'Link'), icon: 'link' },
          { action: 'format-unordered-list', label: t('content_format_unordered_list', 'Unordered list'), icon: 'list' },
          { action: 'format-ordered-list', label: t('content_format_ordered_list', 'Numbered list'), icon: 'listOrdered' }
        );
      }
      formatButtons.forEach(function(config) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn--secondary btn--small admin-content-block__format-button admin-content-block__format-button--' + config.action;
        button.dataset.contentIndex = String(index);
        button.dataset.contentAction = config.action;
        button.setAttribute('aria-label', config.label);
        button.setAttribute('aria-pressed', 'false');
        if (config.icon) {
          button.append(createIcon(config.icon, document));
        } else {
          button.textContent = config.text;
        }
        formatGroup.append(button);
      });
      if (block.type === 'text') {
        var styleGroup = createToolbarGroup(t('content_format_label', 'Text format'), document);
        var formatSelect = document.createElement('select');
        formatSelect.className = 'admin-content-block__select admin-content-block__format-select';
        formatSelect.dataset.contentIndex = String(index);
        formatSelect.dataset.contentAction = 'format-block';
        formatSelect.setAttribute('aria-label', t('content_format_label', 'Text format'));
        var multipleOption = document.createElement('option');
        multipleOption.value = 'multiple';
        multipleOption.textContent = t('content_format_multiple', 'Multiple');
        multipleOption.disabled = true;
        formatSelect.append(multipleOption);
        [
          { value: 'p', label: t('content_format_paragraph', 'Paragraph') },
          { value: 'h2', label: t('content_format_heading_2', 'Heading 2') },
          { value: 'h3', label: t('content_format_heading_3', 'Heading 3') },
          { value: 'h4', label: t('content_format_heading_4', 'Heading 4') }
        ].forEach(function(config) {
          var option = document.createElement('option');
          option.value = config.value;
          option.textContent = config.label;
          formatSelect.append(option);
        });
        styleGroup.append(formatSelect);
      }
      actions.append(formatGroup);
      if (styleGroup) actions.append(styleGroup);
    }
    var alignGroup = createToolbarGroup(t('content_align_group', 'Alignment'), document);
    alignGroup.classList.add('admin-content-block__toolbar-group--alignment');
    alignments.forEach(function(align) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn--secondary btn--small' + (alignment(block.align) === align ? ' is-active' : '');
      button.dataset.contentIndex = String(index);
      button.dataset.contentAction = 'align';
      button.dataset.contentAlign = align;
      button.setAttribute('aria-label', t('content_align_' + align, align));
      button.setAttribute('aria-pressed', alignment(block.align) === align ? 'true' : 'false');
      button.append(createIcon(align === 'left' ? 'alignLeft' : align === 'center' ? 'alignCenter' : align === 'right' ? 'alignRight' : 'alignJustify', document));
      alignGroup.append(button);
    });
    actions.append(alignGroup);
    var blockGroup = createToolbarGroup(t('content_block_actions_group', 'Block actions'), document);
    blockGroup.classList.add('admin-content-block__toolbar-group--block-actions');
    [
      { action: 'up', label: t('content_block_move_up', 'Move block up'), text: moveLabels[0], disabled: index === 0 },
      { action: 'down', label: t('content_block_move_down', 'Move block down'), text: moveLabels[1], disabled: index === count - 1 },
      { action: 'delete', label: t('content_block_delete', 'Delete block'), icon: 'trash', disabled: count === 1 }
    ].forEach(function(config) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn--secondary btn--small';
      button.dataset.contentIndex = String(index);
      button.dataset.contentAction = config.action;
      button.setAttribute('aria-label', config.label);
      if (config.icon) {
        button.append(createIcon(config.icon, document));
      } else {
        button.textContent = config.text;
      }
      button.disabled = config.disabled;
      blockGroup.append(button);
    });
    headerRow.append(typeLabel, blockGroup);

    chrome.append(headerRow);
    if (actions.children.length) {
      formatRow.append(actions);
      chrome.append(formatRow);
    }
    if (block.type === 'text') {
      var linkPanel = document.createElement('div');
      linkPanel.className = 'admin-content-block__link-panel';
      linkPanel.dataset.contentLinkPanel = String(index);
      if (linkPanelRole) {
        linkPanel.setAttribute('role', 'group');
        linkPanel.setAttribute('aria-label', t('content_link_label', 'Link URL'));
      }
      linkPanel.hidden = true;
      var linkLabel = document.createElement('label');
      var linkLabelText = document.createElement('span');
      linkLabelText.textContent = t('content_link_label', 'Link URL');
      var linkInput = document.createElement('input');
      linkInput.type = 'text';
      linkInput.inputMode = 'url';
      linkInput.dataset.contentIndex = String(index);
      linkInput.dataset.contentAction = 'link-url';
      linkInput.setAttribute('aria-label', t('content_link_label', 'Link URL'));
      linkLabel.append(linkLabelText, linkInput);
      var applyButton = document.createElement('button');
      applyButton.type = 'button';
      applyButton.className = 'btn btn--secondary btn--small';
      applyButton.dataset.contentIndex = String(index);
      applyButton.dataset.contentAction = 'link-apply';
      applyButton.textContent = t('content_link_apply', 'Apply');
      var removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'btn btn--secondary btn--small';
      removeButton.dataset.contentIndex = String(index);
      removeButton.dataset.contentAction = 'link-remove';
      removeButton.textContent = t('content_link_remove', 'Remove link');
      linkPanel.append(linkLabel, applyButton, removeButton);
      chrome.append(linkPanel);
    }
    return chrome;
  }

  function textFormatForNode(node, editable) {
    var element = node?.nodeType === 1 ? node : node?.parentElement;
    var block = element?.closest?.('p,h2,h3,h4');
    if (block?.nodeType === 1 && editable?.contains(block)) {
      var tag = block.tagName.toLowerCase();
      return textFormats.indexOf(tag) >= 0 ? tag : 'p';
    }
    return 'p';
  }

  function selectedTextFormat(editable) {
    var selection = editable?.ownerDocument.defaultView.getSelection();
    if (editable?.nodeType !== 1 || !selection || selection.rangeCount === 0) return 'p';
    var range = selection.getRangeAt(0);
    if (selection.isCollapsed) return textFormatForNode(selection.focusNode, editable);
    var formats = [];
    editable.querySelectorAll('p,h2,h3,h4').forEach(function(block) {
      try {
        if (range.intersectsNode(block)) formats.push(block.tagName.toLowerCase());
      } catch (error) {
        // Ignore detached or browser-normalized nodes while the editor is mutating.
      }
    });
    if (!formats.length) formats.push(textFormatForNode(range.commonAncestorContainer, editable));
    var uniqueFormats = Array.from(new Set(formats.filter(function(format) {
      return textFormats.indexOf(format) >= 0;
    })));
    if (uniqueFormats.length > 1) return 'multiple';
    return uniqueFormats[0] || 'p';
  }

  // The composer owns DOM structure, commands and event routing. Adapters supply
  // field/media rendering, codecs, draft/history hooks and publication policy.
  function createBlockEditor(root, {
    model = createBlockModel(), getBlocks, setBlocks, renderBody,
    onRender = () => {}, beforeMutation = () => {}, onMutation = () => {},
    t = (_key, fallback) => fallback, moveLabels = ['↑', '↓'], linkPanelRole = true
  } = {}) {
    if (root?.nodeType !== 1 || typeof getBlocks !== 'function' || typeof setBlocks !== 'function' || typeof renderBody !== 'function') {
      throw new TypeError('A root, getBlocks, setBlocks and renderBody are required');
    }
    const document = root.ownerDocument;
    const view = document.defaultView;
    let unbind = null;
    const options = { document, model, t, moveLabels, linkPanelRole };
    function syncChrome() {
      root.querySelectorAll('.admin-content-block').forEach(block => {
        const chrome = block.querySelector('[data-content-chrome]');
        if (!chrome) return;
        const active = block.classList.contains('is-active');
        chrome.setAttribute('aria-hidden', active ? 'false' : 'true');
        chrome.querySelectorAll('button, input, select, textarea').forEach(control => {
          if (active) control.removeAttribute('tabindex');
          else control.tabIndex = -1;
        });
      });
    }
    function activate(node) {
      const element = node?.nodeType === 1 ? node : node?.parentElement;
      const active = element?.closest?.('.admin-content-block');
      root.querySelectorAll('.admin-content-block.is-active').forEach(block => {
        if (block !== active) block.classList.remove('is-active');
      });
      if (active && root.contains(active)) active.classList.add('is-active');
      syncChrome();
    }
    function insertControl(index) {
      const wrap = document.createElement('div');
      wrap.className = 'admin-content-insert';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'admin-content-insert__button';
      button.dataset.contentAction = 'insert-block';
      button.dataset.contentIndex = String(index);
      button.setAttribute('aria-label', t('content_block_insert', 'Add content block'));
      button.textContent = '+';
      wrap.append(button);
      return wrap;
    }
    function render(focusIndex) {
      let blocks = getBlocks();
      if (!blocks.length) { blocks = [model.defaultBlock('text')]; setBlocks(blocks); }
      // Never normalize/clone here: pending uploads hold block and image identity.
      root.replaceChildren();
      root.append(insertControl(0));
      blocks.forEach((block, index) => {
        if (index > 0) root.append(insertControl(index));
        const tag = block.type === 'quote' ? 'blockquote' : ['image', 'gallery', 'video', 'audio', 'embed'].includes(block.type) ? 'figure' : 'div';
        const card = document.createElement(tag);
        card.className = 'admin-content-block content-block content-block--' + block.type + ' content-block--align-' + alignment(block.align) + (block.type === 'gallery' ? ' gallery--' + galleryLayout(block.layout) + ' gallery--caption-' + galleryCaptionStyle(block.caption_style) : '');
        card.dataset.contentIndex = String(index);
        card.append(createChrome(block, index, blocks.length, options));
        renderBody(card, block, index);
        root.append(card);
      });
      root.append(insertControl(blocks.length));
      onRender(blocks);
      syncChrome();
      if (typeof focusIndex === 'number') root.querySelector('[data-content-index="' + focusIndex + '"][data-content-field]')?.focus();
    }
    function mutate(action, index, value) {
      const blocks = getBlocks();
      if (!Number.isInteger(index)) return false;
      if (action === 'up' && (index <= 0 || index >= blocks.length)) return false;
      if (action === 'down' && (index < 0 || index >= blocks.length - 1)) return false;
      if (action === 'delete' && (blocks.length <= 1 || !blocks[index])) return false;
      if (action === 'align' && !blocks[index]) return false;
      if (!['up', 'down', 'delete', 'align', 'type', 'insert-block'].includes(action)) return false;
      beforeMutation({ action, index });
      let focusIndex = index;
      if (action === 'type') {
        const previous = blocks[index] || model.defaultBlock('text');
        const next = model.defaultBlock(value);
        next.align = alignment(previous.align);
        if (previous.type === 'text' && next.type === 'quote') next.text = previous.body || '';
        if (previous.type === 'quote' && next.type === 'text') next.body = previous.text || '';
        blocks[index] = next;
      } else if (action === 'align') blocks[index].align = alignment(value);
      else if (action === 'insert-block') blocks.splice(Math.max(0, Math.min(index, blocks.length)), 0, model.defaultBlock('text'));
      else if (action === 'delete') { blocks.splice(index, 1); focusIndex = Math.max(0, index - 1); }
      else {
        focusIndex = index + (action === 'up' ? -1 : 1);
        [blocks[index], blocks[focusIndex]] = [blocks[focusIndex], blocks[index]];
      }
      render(focusIndex);
      onMutation({ action, index, focusIndex });
      return true;
    }
    function insertSlash(control, value) {
      const blocks = getBlocks();
      const index = Number(control.dataset.contentIndex);
      if (control.dataset.contentField !== 'body' || !blocks[index]) return false;
      const match = value.match(new RegExp('(?:^|\\n|\\s)/(?:' + model.getTypes().join('|') + ')(?=\\s*$|\\n)', 'i'));
      if (!match) return false;
      const type = model.command(match[0].match(/\/([a-z]+)/i)?.[1]);
      const before = value.slice(0, match.index + match[0].indexOf('/')).replace(/\s+$/, '');
      const after = value.slice(match.index + match[0].length).replace(/^\s+/, '');
      const align = alignment(blocks[index].align);
      beforeMutation({ action: 'slash', index, before, after, align });
      let insertAt = index;
      if (before) { blocks[index].body = before; insertAt += 1; }
      else blocks.splice(index, 1);
      blocks.splice(insertAt, 0, model.defaultBlock(type));
      if (after) blocks.splice(insertAt + 1, 0, { type: 'text', body: after, align });
      render(insertAt);
      onMutation({ action: 'slash', index, focusIndex: insertAt });
      return true;
    }
    function bind({ run = callback => callback(), outside, focus, selection, pointer, input,
      fieldChange, beforeClick, actions = {}, afterAction, beforeKey, slash, paste } = {}) {
      unbind?.();
      const listeners = [];
      function listen(target, name, handler) {
        target.addEventListener(name, handler);
        listeners.push(() => target.removeEventListener(name, handler));
      }
      function call(action, control) { return actions[action]?.(control); }
      listen(document, 'pointerdown', event => {
        if (event.target instanceof view.Node && root.contains(event.target)) return;
        outside?.(event);
      });
      for (const [name, handler] of Object.entries({ focusin: focus, mouseup: selection, keyup: selection, pointerdown: pointer, input, paste })) {
        if (handler) listen(root, name, event => run(() => handler(event)));
      }
      listen(root, 'change', event => run(() => {
        const control = event.target;
        const action = control.dataset?.contentAction;
        if (control instanceof view.HTMLSelectElement && action === 'type') mutate('type', Number(control.dataset.contentIndex), control.value);
        else if (control instanceof view.HTMLSelectElement && action === 'format-block') call('format-block', control);
        else if (control instanceof view.HTMLInputElement && ['select-media-upload', 'add-gallery-image-upload'].includes(action)) call('upload', control);
        else if (control instanceof view.HTMLInputElement && action === 'link-url') call('link-apply', control);
        else fieldChange?.(control);
      }));
      listen(root, 'click', event => run(() => {
        if (beforeClick?.(event) === false) return;
        const button = event.target?.closest?.('[data-content-action]');
        if (!(button instanceof view.HTMLButtonElement)) return;
        const action = button.dataset.contentAction;
        if (Object.hasOwn(actions, action)) call(action, button);
        else mutate(action, Number(button.dataset.contentIndex), button.dataset.contentAlign);
        afterAction?.(action);
      }));
      listen(root, 'keydown', event => run(() => {
        if (beforeKey?.(event) === false) return;
        const control = event.target;
        if (control instanceof view.HTMLInputElement && control.dataset.contentAction === 'link-url' && event.key === 'Enter') {
          call('link-apply', control); event.preventDefault(); return;
        }
        if (control instanceof view.HTMLElement && control.isContentEditable && event.key === 'Enter' && slash?.(control)) event.preventDefault();
      }));
      function cleanup() {
        if (unbind !== cleanup) return;
        listeners.forEach(remove => remove());
        unbind = null;
      }
      unbind = cleanup;
      return cleanup;
    }
    return Object.freeze({ render, mutate, insertSlash, syncChrome, activate, bind, destroy() { unbind?.(); } });
  }
  scope.DustWaveAdminShellBlockEditor = Object.freeze({ createBlockModel, createBlockEditor, createIcon, selectedTextFormat });
})(typeof globalThis !== 'undefined' ? globalThis : window);
