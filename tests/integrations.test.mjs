import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../src/integrations.mjs', import.meta.url), 'utf8');
function environment({ analytics = { mode: 'off', measurementId: '' }, ads = { enabled: false, cmpReady: false }, consent = null } = {}) {
  const scripts = [];
  const events = new Map();
  const stored = new Map(consent ? [['copysprig-analytics-consent', consent]] : []);
  const controls = new Map();
  for (const id of ['allow', 'decline', 'settings']) controls.set(id, { handlers: {}, addEventListener(name, fn) { this.handlers[name] = fn; }, focus() {} });
  const box = { hidden: true, querySelector(selector) { return controls.get(selector.includes('allow') || selector === 'button' ? 'allow' : 'decline'); }, scrollIntoView() {} };
  const ad = { hidden: true, children: [], append(child) { this.children.push(child); } };
  const window = { addEventListener(name, fn, options) { events.set(name, { fn, options }); }, removeEventListener(name) { events.delete(name); } };
  const document = {
    title: 'Safe tool title', referrer: 'https://example.com/private?secret=hidden#text',
    head: { append(script) { scripts.push(script); } },
    createElement(tag) { return { tagName: tag, style: {}, dataset: {} }; },
    querySelector(selector) {
      if (selector === '#integration-data') return { textContent: JSON.stringify({ analytics, ads }) };
      if (selector === '#analytics-consent') return box;
      if (selector === '#privacy-settings') return controls.get('settings');
      if (selector === '#ad-placement') return ad;
      if (selector === 'script[data-copysprig-ads]') return scripts.find((script) => script.dataset.copysprigAds);
      return null;
    },
  };
  runInNewContext(source, { window, document, localStorage: { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) }, location: { origin: 'https://copysprig.web.app', pathname: '/bold-text/', search: '?text=private', hash: '#private' }, URL, Date });
  return { scripts, window, box, ad, click: (name) => controls.get(name).handlers.click(), event(name, detail) { const listener = events.get(name); if (listener?.options?.once) events.delete(name); listener?.fn({ detail }); }, calls: () => (window.dataLayer ?? []).map((entry) => Array.from(entry)) };
}

test('inactive integrations make no network requests or trackers, and pending consent does not activate GA4', () => {
  const off = environment();
  assert.equal(off.scripts.length, 0);
  assert.equal(off.window.copysprigTrack, undefined);
  const pending = environment({ analytics: { mode: 'ga4', measurementId: 'G-ABC123' } });
  assert.equal(pending.box.hidden, false);
  assert.equal(pending.scripts.length, 0);
  pending.click('decline');
  assert.equal(pending.scripts.length, 0);
});

test('analytics sends only sanitized fixed identifiers and removes visitor URL/referrer parameters', () => {
  const env = environment({ analytics: { mode: 'ga4', measurementId: 'G-ABC123' }, consent: 'granted' });
  assert.equal(env.scripts.length, 1);
  const pageview = env.calls().find(([command, event]) => command === 'event' && event === 'page_view')[2];
  assert.equal(pageview.page_location, 'https://copysprig.web.app/bold-text/');
  assert.equal(pageview.page_referrer, 'https://example.com');
  const safePage = { page_location: 'https://copysprig.web.app/bold-text/', page_title: 'Safe tool title', page_referrer: 'https://example.com' };
  const calls = env.calls();
  const defaultsIndex = calls.findIndex(([command]) => command === 'set');
  const configIndex = calls.findIndex(([command]) => command === 'config');
  assert.ok(defaultsIndex >= 0 && defaultsIndex < configIndex, 'URL defaults must be sanitized before stream initialization');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[defaultsIndex][1])), safePage);
  const streamConfig = calls[configIndex][2];
  for (const [field, value] of Object.entries(safePage)) assert.equal(streamConfig[field], value, `stream default ${field}`);
  env.window.copysprigTrack('copy', { item_kind: 'style', item_id: 'style:bold', text: 'PRIVATE', clipboard: 'PRIVATE', search: 'PRIVATE', page_location: '?PRIVATE', page_referrer: '/PRIVATE' });
  const copy = env.calls().at(-1);
  assert.deepEqual(JSON.parse(JSON.stringify(copy)), ['event', 'copy', { ...safePage, item_kind: 'style', item_id: 'style:bold' }]);
  env.window.copysprigTrack('copy', { item_kind: 'PRIVATE', item_id: 'PRIVATE' });
  assert.deepEqual(JSON.parse(JSON.stringify(env.calls().at(-1))), ['event', 'copy', safePage]);
  env.window.copysprigTrack('favorite_toggle', { page_location: '?PRIVATE' });
  assert.deepEqual(JSON.parse(JSON.stringify(env.calls().at(-1))), ['event', 'favorite_toggle', safePage]);
  const count = env.calls().length;
  env.window.copysprigTrack('PRIVATE', { text: 'PRIVATE' });
  assert.equal(env.calls().length, count);
  assert.ok(!JSON.stringify(env.calls()).includes('PRIVATE'));
});

test('withdrawing analytics consent stops subsequent tool events immediately', () => {
  const env = environment({ analytics: { mode: 'ga4', measurementId: 'G-ABC123' }, consent: 'granted' });
  env.click('decline');
  const count = env.calls().filter(([command, event]) => command === 'event' && event === 'copy').length;
  env.window.copysprigTrack?.('copy', { item_kind: 'style', item_id: 'style:bold' });
  assert.equal(env.calls().filter(([command, event]) => command === 'event' && event === 'copy').length, count);
  assert.ok(env.calls().some(([command, action, value]) => command === 'consent' && action === 'update' && value.analytics_storage === 'denied'));
});

test('ads require separate approval/configuration/consent and can activate after an earlier denial', () => {
  const configured = { enabled: true, cmpReady: true, publisherId: 'ca-pub-1234567890123456', slotId: '12345' };
  const invalid = environment({ ads: { ...configured, publisherId: '' } });
  invalid.event('copysprig-ad-consent', { allowed: true });
  assert.equal(invalid.scripts.length, 0);
  const env = environment({ ads: configured });
  env.event('copysprig-ad-consent', { allowed: false });
  assert.equal(env.scripts.length, 0);
  assert.equal(env.ad.hidden, true);
  env.event('copysprig-ad-consent', { allowed: true });
  assert.equal(env.scripts.length, 1);
  assert.equal(env.ad.children.length, 1);
  env.event('copysprig-ad-consent', { allowed: true });
  assert.equal(env.scripts.length, 1);
});
