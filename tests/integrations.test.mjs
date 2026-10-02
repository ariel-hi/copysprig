import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../src/integrations.mjs', import.meta.url), 'utf8');
const analyticsConfig = { mode: 'ga4', measurementId: 'G-ABC123' };
const consentKey = 'copysprig-analytics-consent';
const excludedKey = 'copysprig-analytics-excluded';
function environment({
  analytics = { mode: 'off', measurementId: '' }, ads = { enabled: false, cmpReady: false },
  consent = null, stored = new Map(), cookies = new Map(), origin = 'https://copysprig.web.app',
  search = '?text=private', pathname = '/bold-text/', webdriver = false,
  userAgent = 'Mozilla/5.0 Chrome/142.0.0.0 Safari/537.36', testBrowser = false,
  storageReadBlocked = false, storageWriteBlocked = false,
} = {}) {
  const scripts = [];
  const events = new Map();
  const cookieWrites = [];
  if (consent !== null) stored.set(consentKey, consent);
  const controls = new Map();
  for (const id of ['allow', 'decline', 'settings']) controls.set(id, {
    handlers: {}, attributes: new Map(), textContent: id === 'settings' ? 'Analytics choices' : '',
    addEventListener(name, fn) { this.handlers[name] = fn; }, focus() {},
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    removeAttribute(name) { this.attributes.delete(name); },
  });
  const box = { hidden: true, querySelector(selector) { return controls.get(selector.includes('allow') || selector === 'button' ? 'allow' : 'decline'); }, scrollIntoView() {} };
  const ad = { hidden: true, children: [], append(child) { this.children.push(child); } };
  const window = { __COPYSPRIG_TEST__: testBrowser, addEventListener(name, fn, options) { events.set(name, { fn, options }); }, removeEventListener(name) { events.delete(name); } };
  const document = {
    title: 'Safe tool title', referrer: 'https://example.com/private?secret=hidden#text',
    get cookie() { return [...cookies].map(([key, value]) => `${key}=${value}`).join('; '); },
    set cookie(value) {
      cookieWrites.push(value);
      const [pair] = value.split(';');
      const separator = pair.indexOf('=');
      cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
    },
    head: { append(script) { scripts.push(script); } },
    createElement(tag) { return { tagName: tag, style: {}, dataset: {} }; },
    querySelector(selector) {
      if (selector === '#integration-data') return { textContent: JSON.stringify({ siteUrl: 'https://copysprig.web.app', analytics, ads }) };
      if (selector === '#analytics-consent') return box;
      if (selector === '#privacy-settings') return controls.get('settings');
      if (selector === '#ad-placement') return ad;
      if (selector === 'script[data-copysprig-ads]') return scripts.find((script) => script.dataset.copysprigAds);
      return null;
    },
  };
  const localStorage = {
    getItem(key) { if (storageReadBlocked) throw new Error('Storage unavailable'); return stored.get(key) ?? null; },
    setItem(key, value) { if (storageWriteBlocked) throw new Error('Storage unavailable'); stored.set(key, value); },
  };
  const location = { origin, pathname, search, hash: '#private', reload() {} };
  runInNewContext(source, { window, document, localStorage, location, navigator: { webdriver, userAgent }, URL, URLSearchParams, Date });
  return {
    scripts, window, box, ad, stored, cookies, cookieWrites, controls,
    click: (name) => controls.get(name).handlers.click?.(),
    event(name, detail) { const listener = events.get(name); if (listener?.options?.once) events.delete(name); listener?.fn({ detail }); },
    storage(key, newValue) {
      if (newValue === null) stored.delete(key); else stored.set(key, newValue);
      events.get('storage')?.fn({ key, newValue, storageArea: localStorage });
    },
    calls: () => (window.dataLayer ?? []).map((entry) => Array.from(entry)),
  };
}

function assertExcluded(env) {
  assert.equal(env.scripts.length, 0, 'excluded visits must never load the Google tag');
  assert.equal(env.calls().length, 0, 'excluded visits must never queue analytics commands');
  assert.equal(env.window.copysprigTrack, undefined);
  assert.equal(env.window['ga-disable-G-ABC123'], true);
  assert.equal(env.box.hidden, true);
  assert.equal(env.controls.get('settings').textContent, 'Analytics excluded');
  assert.equal(env.controls.get('settings').getAttribute('aria-disabled'), 'true');
  env.click('allow');
  env.click('settings');
  assert.equal(env.scripts.length, 0, 'Allow must not override exclusion');
  assert.equal(env.calls().length, 0);
  assert.equal(env.window['ga-disable-G-ABC123'], true);
  assert.equal(env.box.hidden, true);
}

test('localhost, file, preview, and nonproduction origins exclude granted analytics', () => {
  for (const origin of ['http://localhost:4173', 'http://127.0.0.1:4175', 'null', 'https://copysprig--qa.web.app', 'https://example.com', 'http://copysprig.web.app']) {
    assertExcluded(environment({ analytics: analyticsConfig, consent: 'granted', origin }));
  }
});

test('automated test browsers cannot enable analytics, including with earlier consent', () => {
  for (const automation of [{ webdriver: true }, { testBrowser: true }, ...['HeadlessChrome/142.0.0.0', 'Playwright/1.56', 'Puppeteer/24', 'Selenium/4.37'].map(userAgent => ({ userAgent }))]) {
    assertExcluded(environment({ analytics: analyticsConfig, consent: 'granted', ...automation }));
  }
});

test('owner exclusion link persists before startup and across clean page navigation', () => {
  const env = environment({ analytics: analyticsConfig, consent: 'granted', search: '?analytics=off' });
  assertExcluded(env);
  assert.equal(env.stored.get(excludedKey), '1');
  assert.equal(env.cookies.get(excludedKey), '1');
  assert.ok(env.cookieWrites.some(value => value.startsWith(`${excludedKey}=1;`) && /(?:^|;)\s*Path=\//i.test(value) && !/(?:^|;)\s*Domain=/i.test(value)), 'owner cookie must cover all routes and stay host-only');
  const next = environment({ analytics: analyticsConfig, stored: env.stored, cookies: env.cookies, search: '', pathname: '/symbols/' });
  assertExcluded(next);
});

test('saved owner exclusion works independently from localStorage or cookie', () => {
  assertExcluded(environment({ analytics: analyticsConfig, consent: 'granted', stored: new Map([[excludedKey, '1']]) }));
  assertExcluded(environment({ analytics: analyticsConfig, consent: 'granted', cookies: new Map([[excludedKey, '1']]) }));
  const unrelatedCookie = environment({ analytics: analyticsConfig, consent: 'granted', cookies: new Map([[`other-${excludedKey}`, '1']]) });
  assert.equal(unrelatedCookie.scripts.length, 1, 'a cookie with a similar name must not exclude a real visitor');
});

test('owner marker uses cookie fallback when storage writes fail; blocked reads fail closed', () => {
  const env = environment({ analytics: analyticsConfig, consent: 'granted', search: '?analytics=off', storageWriteBlocked: true });
  assertExcluded(env);
  assert.equal(env.cookies.get(excludedKey), '1');
  assertExcluded(environment({ analytics: analyticsConfig, consent: 'granted', cookies: env.cookies, search: '' }));
  assertExcluded(environment({ analytics: analyticsConfig, consent: 'granted', storageReadBlocked: true }));
});

test('cross-tab exclusion stops analytics immediately, including retained tracking callbacks', () => {
  const env = environment({ analytics: analyticsConfig, consent: 'granted' });
  const retainedTrack = env.window.copysprigTrack;
  assert.equal(typeof retainedTrack, 'function');
  env.storage(excludedKey, '1');
  const count = env.calls().length;
  retainedTrack('copy', { item_kind: 'style', item_id: 'style:bold' });
  env.window.copysprigTrack?.('favorite_toggle', { item_kind: 'style', item_id: 'style:bold' });
  env.click('allow');
  assert.equal(env.calls().length, count, 'retained callbacks and Allow must remain blocked');
  assert.equal(env.window['ga-disable-G-ABC123'], true);
  assert.equal(env.window.copysprigTrack, undefined);
  assert.equal(env.box.hidden, true);
  assert.equal(env.controls.get('settings').textContent, 'Analytics excluded');
});

test('cookie-only exclusion changes stop active analytics on focus and every tracked entry point', () => {
  for (const action of ['focus', 'copy', 'allow', 'settings']) {
    const env = environment({ analytics: analyticsConfig, consent: 'granted' });
    const retainedTrack = env.window.copysprigTrack;
    const count = env.calls().length;
    env.cookies.set(excludedKey, '1');
    if (action === 'focus') env.event('focus');
    else if (action === 'copy') retainedTrack('copy', { item_kind: 'style', item_id: 'style:bold' });
    else env.click(action);
    assert.equal(env.window['ga-disable-G-ABC123'], true, `${action} must discover cookie-only exclusion`);
    assert.equal(env.window.copysprigTrack, undefined);
    assert.equal(env.box.hidden, true);
    assert.equal(env.controls.get('settings').textContent, 'Analytics excluded');
    retainedTrack('favorite_toggle', { item_kind: 'style', item_id: 'style:bold' });
    env.click('allow');
    assert.equal(env.calls().length, count, `${action} must stop retained callbacks and prevent Allow bypass`);
  }
});

test('cookie-only exclusion saved after page startup prevents a pending opt-in from loading analytics', () => {
  const env = environment({ analytics: analyticsConfig });
  assert.equal(env.box.hidden, false);
  env.cookies.set(excludedKey, '1');
  env.click('allow');
  assertExcluded(env);
  assert.equal(env.stored.get(consentKey), undefined, 'excluded Allow must not replace pending consent');
});

test('cross-tab consent withdrawal stops retained tracking callbacks', () => {
  for (const consent of ['denied', null]) {
    const env = environment({ analytics: analyticsConfig, consent: 'granted' });
    const retainedTrack = env.window.copysprigTrack;
    env.storage(consentKey, consent);
    const eventCount = env.calls().filter(([command]) => command === 'event').length;
    retainedTrack('copy', { item_kind: 'style', item_id: 'style:bold' });
    assert.equal(env.calls().filter(([command]) => command === 'event').length, eventCount);
    assert.equal(env.window['ga-disable-G-ABC123'], true);
  }
});

test('real production visitors can opt in and are unaffected by unrelated storage events', () => {
  const env = environment({ analytics: analyticsConfig, search: '?analytics=on' });
  assert.equal(env.scripts.length, 0);
  assert.equal(env.box.hidden, false);
  env.click('allow');
  assert.equal(env.scripts.length, 1);
  assert.equal(env.stored.get(consentKey), 'granted');
  assert.equal(env.calls().filter(([command, name]) => command === 'event' && name === 'page_view').length, 1);
  env.storage('copysprig-favorites', 'style:bold');
  env.window.copysprigTrack('copy', { item_kind: 'style', item_id: 'style:bold' });
  assert.equal(env.calls().at(-1)[1], 'copy');
});

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
