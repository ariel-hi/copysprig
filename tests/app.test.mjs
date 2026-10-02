import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import * as unicode from '../src/unicode.mjs';
import { symbols } from '../src/catalog.mjs';

// Exercise the app's event wiring without a browser, network, or clipboard.
// The real transformation exports are used; copyText is the external boundary.
const source = (await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8')).replace(/^import .+;\r?\n/gm, '');

function environment({ mode = 'styles', favorites = [], hash = '', copyOutcome = 'clipboard' } = {}) {
  const writes = [];
  const copied = [];
  const tracked = [];
  const stored = new Map([['copysprig-favorites', JSON.stringify(favorites)]]);
  let document;
  let selection = { isCollapsed: true, rangeCount: 0 };

  function matches(node, selector) {
    if (selector.startsWith('#')) return node.id === selector.slice(1);
    if (selector.startsWith('.')) return node.className.split(/\s+/).includes(selector.slice(1));
    const attribute = selector.match(/^\[data-([\w-]+)(?:="([^"]*)")?\]$/);
    if (attribute) {
      const key = attribute[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      return Object.hasOwn(node.dataset, key) && (attribute[2] === undefined || node.dataset[key] === attribute[2]);
    }
    return node.tagName === selector.toUpperCase();
  }

  class Node {
    constructor(tagName) {
      this.tagName = tagName.toUpperCase();
      this.id = '';
      this.className = '';
      this.dataset = {};
      this.attributes = new Map();
      this.handlers = new Map();
      this.children = [];
      this.parentNode = null;
      this.value = '';
      this.disabled = false;
      this.open = false;
      this._text = '';
    }
    get textContent() { return this._text + this.children.map(node => node.textContent).join(''); }
    set textContent(value) { this._text = String(value); this.replaceChildren(); }
    append(...nodes) {
      for (const node of nodes) {
        if (node.tagName === '#FRAGMENT') { this.append(...node.children); continue; }
        if (node.parentNode) node.parentNode.children = node.parentNode.children.filter(child => child !== node);
        node.parentNode = this;
        this.children.push(node);
      }
    }
    replaceChildren(...nodes) {
      for (const child of this.children) child.parentNode = null;
      this.children = [];
      this.append(...nodes);
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    addEventListener(name, handler) {
      if (!this.handlers.has(name)) this.handlers.set(name, []);
      this.handlers.get(name).push(handler);
    }
    async emit(name, overrides = {}) {
      const event = { target: this, detail: 1, ...overrides };
      for (const handler of this.handlers.get(name) ?? []) await handler(event);
    }
    click() { if (!this.disabled) return this.emit('click'); }
    focus() { document.activeElement = this; }
    select() { this.selected = true; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    closest(selector) {
      for (let node = this; node; node = node.parentNode) {
        if (selector.split(',').some(part => matches(node, part.trim()))) return node;
      }
      return null;
    }
    querySelectorAll(selector) {
      const nodes = [];
      for (const child of this.children) {
        if (matches(child, selector)) nodes.push(child);
        nodes.push(...child.querySelectorAll(selector));
      }
      return nodes;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  }

  const body = new Node('body');
  document = {
    activeElement: body,
    createElement: tag => new Node(tag),
    createDocumentFragment: () => new Node('#fragment'),
    querySelector: selector => body.querySelector(selector),
    querySelectorAll: selector => body.querySelectorAll(selector),
  };
  function element(id, tag = 'div', parent = body) {
    const node = new Node(tag);
    node.id = id;
    parent.append(node);
    return node;
  }
  element('page-data').textContent = JSON.stringify({ mode, example: 'Make something lovely' });
  element('toast');
  element('saved-list');
  element('recent-list');
  const manual = element('manual-copy', 'dialog');
  element('manual-field', 'textarea', manual);
  element('manual-close', 'button', manual);
  for (const id of ['clear-history', 'clear-favorites']) element(id, 'button');

  if (mode === 'styles' || mode === 'mixer') {
    element('text-input', 'textarea');
    element('character-count');
    element('clear-text', 'button');
    element('restore-example', 'button');
    const mixer = element('style-mixer', 'details');
    element('mix-style', 'select', mixer).value = 'sans-bold';
    element('mix-effect', 'select', mixer).value = 'none';
    element('mix-frame', 'select', mixer).value = 'none';
    element('mix-reset', 'button', mixer);
    element('mix-count', 'span', mixer);
    element('mixer-result', 'div', mixer);
  }
  if (mode === 'styles') {
    element('results');
    element('style-search', 'input');
    element('style-family', 'select').value = 'all';
    element('style-count');
    for (const value of ['all', 'saved']) {
      const button = element('filter-' + value, 'button');
      button.dataset.filter = value;
    }
  }

  const window = {
    getSelection: () => selection,
    copysprigTrack: (name, attributes) => tracked.push({ name, attributes }),
    addEventListener() {},
  };
  runInNewContext(source, {
    ...unicode, symbols, window, document, location: { hash },
    localStorage: {
      getItem: key => stored.get(key) ?? null,
      setItem: (key, value) => { writes.push({ key, value }); stored.set(key, value); },
    },
    copyText: async value => { copied.push(value); return copyOutcome; },
    setTimeout: () => 1, clearTimeout() {},
  });
  return {
    document, stored, writes, copied, tracked,
    get: selector => document.querySelector(selector),
    async set(id, value, event = 'change') {
      const node = document.querySelector('#' + id);
      node.value = value;
      await node.emit(event);
    },
    selectTextIn(node) {
      selection = { isCollapsed: false, rangeCount: 1, getRangeAt: () => ({ intersectsNode: target => target.contains(node) }) };
    },
  };
}

test('saving and copying a mix stores only static selection IDs, never entered or generated text', async () => {
  const env = environment();
  const phrase = 'Private orchard 2026 🌸';
  await env.set('text-input', phrase, 'input');
  assert.equal(env.writes.length, 0, 'typing does not persist the phrase');
  await env.set('mix-style', 'bold');
  await env.set('mix-frame', 'stars');
  await env.get('#mixed-preview').querySelector('[data-save]').click();
  await env.get('#mixed-preview').querySelector('.copy').click();
  assert.equal(env.copied.at(-1), '✦ 𝐏𝐫𝐢𝐯𝐚𝐭𝐞 𝐨𝐫𝐜𝐡𝐚𝐫𝐝 𝟐𝟎𝟐𝟔 🌸 ✦');
  assert.deepEqual(JSON.parse(env.stored.get('copysprig-favorites')), ['mix:bold:none:stars']);
  assert.deepEqual(JSON.parse(env.stored.get('copysprig-recent')), ['mix:bold:none:stars']);
  for (const { key, value } of env.writes) {
    assert.ok(['copysprig-favorites', 'copysprig-recent'].includes(key));
    assert.deepEqual(JSON.parse(value), ['mix:bold:none:stars']);
  }
  assert.ok(!JSON.stringify(env.tracked).includes(phrase));
  assert.equal(env.tracked.at(-1).attributes.item_id, 'style:mixed');
});

test('a retained saved-mix shelf button copies the current input after editing', async () => {
  const env = environment({ favorites: ['mix:bold:none:stars'] });
  await env.set('text-input', 'Old', 'input');
  const shelfButton = env.get('#saved-list').children[0];
  await shelfButton.click();
  assert.equal(env.copied.at(-1), '✦ 𝐎𝐥𝐝 ✦');
  await env.set('text-input', 'New 🌸', 'input');
  assert.equal(env.get('#saved-list').children[0], shelfButton, 'shelf retains its existing button');
  await shelfButton.click();
  assert.equal(env.copied.at(-1), '✦ 𝐍𝐞𝐰 🌸 ✦', 'stored selections do not freeze a previous phrase');
});

test('saved, family, and search filters intersect for ordinary styles and saved mixes', async () => {
  const env = environment({ favorites: ['style:bold', 'style:circled', 'mix:circled:none:stars'] });
  await env.get('#filter-saved').click();
  assert.equal(env.get('#results').querySelectorAll('.result').length, 3);
  await env.set('style-family', 'enclosed');
  assert.equal(env.get('#results').querySelectorAll('.result').length, 2);
  await env.set('style-search', 'stars', 'input');
  const cards = env.get('#results').querySelectorAll('.result');
  assert.equal(cards.length, 1);
  assert.equal(cards[0].querySelector('[data-save]').dataset.save, 'mix:circled:none:stars');
  assert.equal(env.get('#style-count').textContent, '1 style');
  await env.set('style-search', 'no matching style', 'input');
  assert.equal(env.get('#results').querySelectorAll('.result').length, 0);
  assert.equal(env.get('#style-count').textContent, '0 styles');
  assert.match(env.get('#results').textContent, /No styles match/);
});

test('a static mix link restores controls and opens the panel; reset updates the rendered result', async () => {
  const shelf = environment({ mode: 'symbols', favorites: ['mix:script:none:stars', 'mix:invalid:none:stars'] });
  assert.equal(shelf.get('#saved-list').children.length, 1, 'invalid imported selection is ignored');
  assert.equal(shelf.get('#saved-list').children[0].href, '/style-mixer/#mix:script:none:stars');
  const env = environment({ hash: '#mix:script:none:stars' });
  assert.equal(env.get('#mix-style').value, 'script');
  assert.equal(env.get('#mix-frame').value, 'stars');
  assert.equal(env.get('#style-mixer').open, true);
  await env.set('text-input', 'Hi', 'input');
  assert.equal(env.get('#mixed-preview').querySelector('.output').textContent, '✦ ℋ𝒾 ✦');
  await env.get('#mix-reset').click();
  assert.equal(env.get('#mix-style').value, 'sans-bold');
  assert.equal(env.get('#mix-effect').value, 'none');
  assert.equal(env.get('#mix-frame').value, 'none');
  assert.equal(env.get('#mixed-preview').querySelector('.output').textContent, '𝗛𝗶');
  const invalid = environment({ hash: '#mix:missing:none:stars' });
  assert.equal(invalid.get('#mix-style').value, 'sans-bold');
  assert.equal(invalid.get('#style-mixer').open, false);
});

test('the standalone mixer supports saving, current-input copying, and clearing favorites without a style grid', async () => {
  const env = environment({ mode: 'mixer', hash: '#mix:bold:none:stars' });
  assert.equal(env.get('#results'), null);
  await env.set('text-input', 'Hi', 'input');
  await env.get('#mixed-preview').querySelector('[data-save]').click();
  await env.set('text-input', 'Bye', 'input');
  await env.get('#saved-list').children[0].click();
  assert.equal(env.copied.at(-1), '✦ 𝐁𝐲𝐞 ✦');
  await env.get('#clear-favorites').click();
  assert.deepEqual(JSON.parse(env.stored.get('copysprig-favorites')), []);
  assert.equal(env.get('#mixed-preview').querySelector('[data-save]').getAttribute('aria-pressed'), 'false');
  assert.match(env.get('#saved-list').textContent, /Use a star to save/);
});

test('unsaving a result with the keyboard restores focus to the next saved result', async () => {
  const env = environment({ favorites: ['style:bold', 'style:circled'] });
  await env.get('#filter-saved').click();
  const button = env.get('#style-bold').querySelector('[data-save]');
  button.focus();
  await button.click();
  assert.equal(env.get('#style-bold'), null);
  assert.equal(env.document.activeElement, env.get('#style-circled').querySelector('[data-save]'));
  await env.document.activeElement.click();
  assert.equal(env.document.activeElement, env.get('#filter-saved'), 'last removal returns focus to the filter');
});

test('failed clipboard copying opens manual selection without claiming success or recording history', async () => {
  const env = environment({ copyOutcome: 'manual' });
  await env.set('text-input', 'Hi', 'input');
  await env.set('mix-style', 'bold');
  await env.get('#mixed-preview').querySelector('.copy').click();
  assert.equal(env.get('#manual-copy').open, true);
  assert.equal(env.get('#manual-field').value, '𝐇𝐢');
  assert.equal(env.document.activeElement, env.get('#manual-field'));
  assert.equal(env.get('#manual-field').selected, true);
  assert.equal(env.stored.has('copysprig-recent'), false);
  assert.equal(env.tracked.length, 0);
  assert.match(env.get('#toast').textContent, /Select the text/);
});

test('clicking a card copies, while selecting its specimen or clicking its save control does not', async () => {
  const env = environment();
  await env.set('text-input', 'Hi', 'input');
  const card = env.get('#style-bold');
  const output = card.querySelector('.output');
  await card.emit('click', { target: output });
  assert.equal(env.copied.at(-1), '𝐇𝐢');
  assert.equal(env.document.activeElement, card.querySelector('.copy'));
  const previous = env.copied.length;
  await card.emit('click', { target: card.querySelector('[data-save]') });
  assert.equal(env.copied.length, previous, 'the delegated card handler ignores its save control');
  env.selectTextIn(output);
  await card.emit('click', { target: output });
  assert.equal(env.copied.length, previous, 'selection leaves the clipboard alone');
  await card.emit('click', { target: output, detail: 2 });
  assert.equal(env.copied.length, previous, 'double clicks leave the clipboard alone');
});
