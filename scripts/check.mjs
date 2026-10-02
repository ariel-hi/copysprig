import { readFile, readdir, access } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const config = JSON.parse(await readFile(resolve(root, 'config.json'), 'utf8'));
const routes = JSON.parse(await readFile(resolve(root, 'routes.json'), 'utf8'));
const origin = new URL(config.siteUrl).origin;
const errors = [];
const warnings = [];
const pendingSocial = process.argv.includes('--allow-pending-social-preview');
const ensure = (condition, message) => { if (!condition) errors.push(message); };
const decode = (value) => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const attrs = (tag) => Object.fromEntries(Array.from(tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g), ([, key, value]) => [key.toLowerCase(), decode(value)]));
const tags = (html, name) => Array.from(html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi')), ([tag]) => attrs(tag));
const meta = (html, key) => tags(html, 'meta').find((tag) => tag.name === key || tag.property === key)?.content;
const exists = async (file) => { try { await access(file); return true; } catch { return false; } };
const fileFor = (pathname) => resolve(dist, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
async function files(directory) {
  const list = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name);
    if (entry.isDirectory()) list.push(...await files(file)); else list.push(file);
  }
  return list;
}

ensure(new URL(config.siteUrl).protocol === 'https:', 'Production site URL must use HTTPS.');
ensure(routes.length >= 16, 'Expected the finished route catalog, not an incomplete build.');
ensure(new Set(routes.map((route) => route.path)).size === routes.length, 'Route paths must be unique.');
const titles = new Set();
const descriptions = new Set();
const htmlFiles = [];
for (const route of routes) {
  ensure(route.path.startsWith('/') && route.path.endsWith('/'), `Route must be an absolute trailing-slash path: ${route.path}`);
  const file = fileFor(route.path);
  if (!await exists(file)) { errors.push(`Missing page: ${route.path}`); continue; }
  const html = await readFile(file, 'utf8');
  htmlFiles.push({ file, html, route });
  const title = decode(html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? '');
  const description = meta(html, 'description');
  ensure(title.length >= 10 && title.length <= 120, `Missing/unreasonable title: ${route.path}`);
  ensure(!titles.has(title), `Duplicate title: ${route.path}`); titles.add(title);
  ensure(description?.length >= 20 && description.length <= 250, `Missing/unreasonable description: ${route.path}`);
  ensure(!descriptions.has(description), `Duplicate description: ${route.path}`); descriptions.add(description);
  ensure((html.match(/<h1\b/gi) ?? []).length === 1, `Expected one h1: ${route.path}`);
  ensure(/<html\b[^>]*lang="en"/.test(html), `Missing document language: ${route.path}`);
  ensure(/<main\b[^>]*id="main"/.test(html), `Missing main/skip-link target: ${route.path}`);
  ensure(meta(html, 'viewport')?.includes('width=device-width'), `Missing responsive viewport: ${route.path}`);
  ensure(!/noindex/i.test(meta(html, 'robots') ?? ''), `Indexable page has noindex: ${route.path}`);
  const canonicals = tags(html, 'link').filter((tag) => tag.rel === 'canonical');
  ensure(canonicals.length === 1 && canonicals[0].href === origin + route.path, `Incorrect canonical: ${route.path}`);
  ensure(meta(html, 'og:url') === origin + route.path, `Incorrect social URL: ${route.path}`);
  for (const key of ['og:title', 'og:description', 'og:image', 'twitter:card', 'twitter:image']) ensure(Boolean(meta(html, key)), `Missing ${key}: ${route.path}`);
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attributes = attrs(match[1]);
    if (['application/json', 'application/ld+json'].includes(attributes.type)) {
      try { JSON.parse(match[2]); } catch { errors.push(`Invalid JSON script: ${route.path}`); }
    }
    if (!config.ads.enabled && config.analytics.mode === 'off') ensure(!attributes.src || !/^https?:\/\//.test(attributes.src), `Inactive integrations load an external script: ${route.path}`);
  }
  if (!config.ads.enabled) ensure(!/id="ad-placement"|class="adsbygoogle"/.test(html), `Inactive ads show an ad placement: ${route.path}`);
}

const errorHtml = await readFile(resolve(dist, '404.html'), 'utf8');
ensure(/noindex/.test(meta(errorHtml, 'robots') ?? ''), 'The 404 page must be noindex.');
ensure(!tags(errorHtml, 'link').some((tag) => tag.rel === 'canonical'), '404 page must not canonicalize to a normal page.');
htmlFiles.push({ file: resolve(dist, '404.html'), html: errorHtml, route: { path: '/404.html' } });
let references = 0;
for (const { html, route } of htmlFiles) {
  const localReferences = [...tags(html, 'a').map((tag) => tag.href), ...tags(html, 'link').map((tag) => tag.href), ...tags(html, 'script').map((tag) => tag.src), meta(html, 'og:image'), meta(html, 'twitter:image')].filter(Boolean);
  for (const reference of localReferences) {
    let url;
    try { url = new URL(reference, origin + route.path); } catch { errors.push(`Invalid URL ${reference} in ${route.path}`); continue; }
    ensure(!['javascript:', 'data:'].includes(url.protocol), `Unsafe link protocol ${reference} in ${route.path}`);
    if (url.origin !== origin) continue;
    references++;
    const file = fileFor(url.pathname);
    if (!await exists(file)) {
      if (pendingSocial && url.pathname === '/assets/social-preview.png') {
        if (!warnings.length) warnings.push('Social preview is pending; production checks must run without --allow-pending-social-preview.');
      } else errors.push(`Broken internal link/asset ${reference} in ${route.path}`);
      continue;
    }
    if (url.hash && extname(file) === '.html') {
      const target = await readFile(file, 'utf8');
      const id = decodeURIComponent(url.hash.slice(1));
      ensure(Array.from(target.matchAll(/\bid=["']([^"']+)["']/g), ([, value]) => value).includes(id), `Missing anchor ${reference} in ${route.path}`);
    }
  }
}
const sitemap = await readFile(resolve(dist, 'sitemap.xml'), 'utf8');
const sitemapUrls = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g), ([, url]) => decode(url));
ensure(sitemapUrls.length === routes.length, 'Sitemap count differs from route catalog.');
ensure(new Set(sitemapUrls).size === sitemapUrls.length, 'Sitemap contains duplicate URLs.');
ensure(routes.every((route) => sitemapUrls.includes(origin + route.path)), 'Sitemap is missing a canonical route.');
ensure(!sitemapUrls.some((url) => /404|\?|#/.test(url)), 'Sitemap must not index errors or visitor state.');
const robots = await readFile(resolve(dist, 'robots.txt'), 'utf8');
ensure(robots.includes(`Sitemap: ${origin}/sitemap.xml`), 'robots.txt sitemap differs from production URL.');
ensure(!/^Disallow:\s*(\/|\*)\s*$/mi.test(robots), 'robots.txt blocks the entire site.');
ensure(await exists(resolve(dist, 'ads.txt')) === Boolean(config.ads.enabled), 'ads.txt must exist only with an active real publisher.');
const hosting = JSON.parse(await readFile(resolve(root, 'firebase.json'), 'utf8')).hosting;
ensure(!hosting.rewrites?.some((rule) => rule.source === '**' && rule.destination === '/index.html'), 'Catch-all homepage rewrite would hide true 404 responses.');
ensure(hosting.public === 'dist' && hosting.trailingSlash === true, 'Hosting must serve the static dist with canonical trailing slashes.');
const allFiles = [...await files(resolve(root, 'src')), ...await files(resolve(root, 'scripts')), ...await files(resolve(root, 'tests')), ...await files(resolve(dist, 'assets'))];
for (const file of allFiles.filter((file) => file.endsWith('.mjs'))) {
  const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  ensure(check.status === 0, `JavaScript syntax failed: ${file}\n${check.stderr ?? ''}`);
  const source = await readFile(file, 'utf8');
  for (const [, imported] of source.matchAll(/\b(?:import|export)\s[^;\n]*?from\s*["'](\.[^"']+)["']/g)) ensure(await exists(resolve(dirname(file), imported)), `Missing local module ${imported} imported by ${file}`);
}
const generatedHtml = (await files(dist)).filter((file) => file.endsWith('.html'));
ensure(generatedHtml.length === routes.length + 1, 'Build contains stale/unlisted HTML routes.');
warnings.forEach((warning) => console.warn(warning));
if (errors.length) {
  console.error(`Static audit failed with ${errors.length} issue(s):\n${errors.map((error) => '- ' + error).join('\n')}`);
  process.exitCode = 1;
} else console.log(`Static audit passed: ${routes.length} canonical pages, ${references} internal references, sitemap/robots/404/inactive integrations and JavaScript syntax.`);
