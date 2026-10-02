import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--help') {
    console.log('Usage: npm run health -- [--base URL] [--canonical-base URL] [--timeout 10000] [--out DIRECTORY]\nLocal HTTP previews skip production redirect checks. No traffic or earnings are measured.');
    process.exit(0);
  }
  if (!['--base', '--canonical-base', '--timeout', '--out'].includes(args[i]) || !args[i + 1]) throw new Error(`Unknown or incomplete option: ${args[i]}`);
  options[args[i].slice(2)] = args[++i];
}
const config = JSON.parse(await readFile(resolve(root, 'config.json'), 'utf8'));
const base = new URL(options.base || process.env.SITE_URL || config.siteUrl);
if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('--base must be an HTTP(S) origin without credentials, path, query, or fragment.');
const preview = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
const canonical = new URL(options['canonical-base'] || (preview ? config.siteUrl : base.origin));
if (canonical.protocol !== 'https:' || canonical.pathname !== '/' || canonical.search || canonical.hash || canonical.username || canonical.password) throw new Error('--canonical-base must be an HTTPS origin.');
const timeout = Number(options.timeout || 10000);
if (!Number.isInteger(timeout) || timeout < 100 || timeout > 60000) throw new Error('--timeout must be 100–60000 milliseconds.');
const started = new Date();
const checks = [];
const assets = new Set(['/favicon.svg', '/assets/social-preview.jpg']);
const record = (name, pass, detail, extra = {}) => checks.push({name, pass, detail, ...extra});
const decode = value => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(match => [match[1].toLowerCase(), decode(match[2] ?? match[3])]));
}
function elements(html, tag) {
  return [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'gi'))].map(match => attributes(match[0]));
}
function jpegDimensions(bytes) {
  if (!bytes || bytes.length < 4 || bytes.readUInt16BE(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset++] !== 0xff) return null;
    while (offset < bytes.length && bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return null;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) return null;
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) return length >= 8 ? {height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5)} : null;
    offset += length;
  }
  return null;
}
async function request(path, origin = base) {
  const url = new URL(path, origin).href;
  const then = performance.now();
  try {
    const response = await fetch(url, {redirect: 'manual', signal: AbortSignal.timeout(timeout), headers: {'user-agent': 'CopySprig-Health/1.0'}});
    const bytes = Buffer.from(await response.arrayBuffer());
    return {url, status: response.status, headers: response.headers, bytes, text: bytes.toString('utf8'), durationMs: Math.round(performance.now() - then)};
  } catch (error) {
    return {url, status: null, error: `${error.name}: ${error.message}`, durationMs: Math.round(performance.now() - then)};
  }
}
async function pool(items, fn) {
  let next = 0;
  await Promise.all(Array.from({length: Math.min(4, items.length)}, async () => {
    while (next < items.length) await fn(items[next++]);
  }));
}
let routes = [];
try {
  routes = JSON.parse(await readFile(resolve(root, 'routes.json'), 'utf8'));
  if (!Array.isArray(routes) || routes.length === 0 || routes.some(route => typeof route.path !== 'string' || !/^\/(?:[a-z0-9-]+\/)?$/.test(route.path)) || new Set(routes.map(route => route.path)).size !== routes.length) throw new Error('Route manifest is missing, empty, duplicated, or invalid. Run npm run build.');
  record('route-manifest', true, `${routes.length} indexable routes`);
  const titles = new Map();
  await pool(routes, async route => {
    const response = await request(route.path);
    const evidence = {url: response.url, status: response.status, durationMs: response.durationMs};
    record(`route:${route.path}`, response.status === 200, response.error || `HTTP ${response.status}`, evidence);
    if (response.status !== 200) return;
    record(`html:${route.path}`, /text\/html/i.test(response.headers.get('content-type') || '') && /<!doctype html/i.test(response.text) && /<h1\b/i.test(response.text), 'HTML content type, doctype and heading', evidence);
    const title = decode(response.text.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
    record(`title:${route.path}`, Boolean(title) && !titles.has(title), title ? `Title: ${title}${titles.has(title) ? ` (also ${titles.get(title)})` : ''}` : 'Missing title');
    titles.set(title, route.path);
    const meta = elements(response.text, 'meta');
    const links = elements(response.text, 'link');
    const expected = new URL(route.path, canonical).href;
    const canonicals = links.filter(link => link.rel?.toLowerCase() === 'canonical');
    record(`canonical:${route.path}`, canonicals.length === 1 && canonicals[0].href === expected, `Expected ${expected}; found ${canonicals.map(link => link.href).join(', ') || 'none'}`);
    record(`indexable:${route.path}`, !meta.some(item => /^(robots|googlebot|bingbot)$/i.test(item.name || '') && /noindex|none/i.test(item.content || '')) && !/noindex|none/i.test(response.headers.get('x-robots-tag') || ''), 'No noindex directive on an indexable route');
    const descriptions = meta.filter(item => item.name?.toLowerCase() === 'description');
    record(`description:${route.path}`, descriptions.length === 1 && descriptions[0].content?.trim().length >= 20, 'One useful description');
    const og = name => meta.find(item => item.property === name)?.content;
    const twitter = name => meta.find(item => item.name === name)?.content;
    const social = new URL('/assets/social-preview.jpg', canonical).href;
    record(`social:${route.path}`, og('og:url') === expected && og('og:image') === social && Boolean(og('og:title')) && Boolean(og('og:description')) && twitter('twitter:card') === 'summary_large_image' && twitter('twitter:image') === social, 'Canonical Open Graph URL and shared social image metadata');
    record(`favicon-link:${route.path}`, links.some(link => link.rel === 'icon' && link.href === '/favicon.svg'), 'Favicon linked');
    for (const asset of [...links.filter(link => link.rel === 'stylesheet').map(link => link.href), ...elements(response.text, 'script').map(script => script.src)]) if (asset?.startsWith('/')) assets.add(asset);
  });
  const sitemap = await request('/sitemap.xml');
  const locations = sitemap.text ? [...sitemap.text.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map(match => decode(match[1].trim())) : [];
  const expectedLocations = routes.map(route => new URL(route.path, canonical).href);
  record('sitemap', sitemap.status === 200 && /<urlset\b/.test(sitemap.text || '') && locations.length === expectedLocations.length && new Set(locations).size === locations.length && expectedLocations.every(url => locations.includes(url)), sitemap.error || `${locations.length}/${expectedLocations.length} unique canonical URLs`, {url: sitemap.url, status: sitemap.status});
  const robots = await request('/robots.txt');
  const rules = robots.text || '';
  record('robots', robots.status === 200 && /^User-agent:\s*\*\s*$/im.test(rules) && /^Allow:\s*\/\s*$/im.test(rules) && !/^Disallow:\s*\/\s*$/im.test(rules) && rules.includes(`Sitemap: ${new URL('/sitemap.xml', canonical).href}`), robots.error || 'Crawl allowed; canonical sitemap advertised', {url: robots.url, status: robots.status});
  await pool([...assets], async path => {
    const response = await request(path);
    const type = response.headers?.get('content-type') || '';
    let valid = response.status === 200 && response.bytes?.length > 0;
    if (path.endsWith('.png')) valid &&= /image\/png/i.test(type) && response.bytes.length >= 24 && response.bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && response.bytes.readUInt32BE(16) >= 600 && response.bytes.readUInt32BE(20) >= 315;
    else if (/\.jpe?g$/.test(path)) {
      const dimensions = jpegDimensions(response.bytes);
      valid &&= /image\/jpeg/i.test(type) && dimensions?.width >= 600 && dimensions?.height >= 315;
    }
    else if (path.endsWith('.svg')) valid &&= /image\/svg\+xml/i.test(type) && /<svg\b/i.test(response.text || '');
    else if (path.endsWith('.css')) valid &&= /text\/css/i.test(type);
    else if (path.endsWith('.mjs')) valid &&= /javascript/i.test(type);
    record(`asset:${path}`, valid, response.error || `${response.bytes?.length || 0} bytes; ${type}`, {url: response.url, status: response.status});
  });
  const missing = await request(`/__copysprig_health_missing_${started.getTime()}/`);
  const missingMeta = elements(missing.text || '', 'meta');
  record('missing-route', missing.status === 404 && /text\/html/i.test(missing.headers?.get('content-type') || '') && /<h1\b/i.test(missing.text || '') && missingMeta.some(item => item.name === 'robots' && /noindex/.test(item.content || '')) && /href="\/"/.test(missing.text || ''), missing.error || 'Custom usable 404 with noindex and home link', {url: missing.url, status: missing.status});
  const errorPage = await request('/404.html');
  record('error-page', [200,404].includes(errorPage.status) && elements(errorPage.text || '', 'meta').some(item => item.name === 'robots' && /noindex/.test(item.content || '')) && !elements(errorPage.text || '', 'link').some(item => item.rel === 'canonical'), errorPage.error || 'Error template is noindex and has no canonical', {url: errorPage.url, status: errorPage.status});
  if (preview) {
    checks.push({name: 'production-redirects', pass: null, detail: 'Skipped on local preview; run against live HTTPS before release.'});
  } else {
    record('https-base', base.protocol === 'https:', 'Production origin must use HTTPS');
    await pool(routes.filter(route => route.path !== '/'), async route => {
      const from = route.path.slice(0, -1) + '?health_check=1';
      const expected = new URL(route.path + '?health_check=1', base).href;
      const response = await request(from);
      const location = response.headers?.get('location');
      const target = location ? new URL(location, response.url).href : null;
      record(`redirect:${route.path}`, [301,308].includes(response.status) && target === expected, response.error || `HTTP ${response.status}; target ${target || 'none'}; query must survive`, {url: response.url, status: response.status});
    });
    const httpOrigin = new URL(base.origin);
    httpOrigin.protocol = 'http:';
    const response = await request('/', httpOrigin);
    const location = response.headers?.get('location');
    record('http-to-https', [301,302,307,308].includes(response.status) && Boolean(location) && new URL(location, response.url).href === new URL('/', base).href, response.error || `HTTP ${response.status}; target ${location || 'none'}`, {url: response.url, status: response.status});
  }
} catch (error) {
  record('health-runtime', false, `${error.name}: ${error.message}`);
}
checks.sort((a, b) => a.name.localeCompare(b.name));
const failures = checks.filter(check => check.pass === false);
const report = {schemaVersion: 1, generatedAt: new Date().toISOString(), startedAt: started.toISOString(), baseUrl: base.origin, canonicalBase: canonical.origin, mode: preview ? 'preview' : 'production', routeCount: routes.length, summary: {passed: checks.filter(check => check.pass === true).length, failed: failures.length, skipped: checks.filter(check => check.pass === null).length}, checks};
const output = resolve(options.out || resolve(root, 'artifacts/health'));
await mkdir(output, {recursive: true});
const name = `health-${report.generatedAt.replace(/[:.]/g, '-')}.json`;
await writeFile(resolve(output, name), JSON.stringify(report, null, 2) + '\n');
await writeFile(resolve(output, 'latest.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Health ${failures.length ? 'FAILED' : 'passed'}: ${report.routeCount} routes; ${report.summary.passed} checks passed, ${failures.length} failed, ${report.summary.skipped} skipped.\n${resolve(output, name)}`);
for (const failure of failures) console.error(`FAIL ${failure.name}: ${failure.detail}`);
process.exitCode = failures.length ? 1 : 0;
