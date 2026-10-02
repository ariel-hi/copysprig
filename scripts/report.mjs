import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const options = {};
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--help') {
    console.log('Usage: npm run report -- [--analytics FILE] [--search-console FILE] [--bing FILE] [--ads FILE] [--health FILE] [--out DIRECTORY]\nDefault inputs: metrics/{analytics,search-console,bing,ads}.json. Missing inputs remain unavailable. See metrics/README.md for the normalized JSON schemas. This command makes no network requests.');
    process.exit(0);
  }
  if (!['--analytics','--search-console','--bing','--ads','--health','--out'].includes(args[i]) || !args[i + 1]) throw new Error(`Unknown or incomplete option: ${args[i]}`);
  options[args[i].slice(2)] = args[++i];
}
const generatedAt = new Date().toISOString();
const issues = [];
const unavailable = reason => ({status: 'unavailable', value: null, reason});
const metric = (value, label, data, source) => value == null ? unavailable(`${label} was not supplied in ${source}.`) : {status: 'measured', value, source, period: data.period, scope: data.scope || 'See source export'};
function number(value, name, integer = true) {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (integer && !Number.isInteger(value))) throw new Error(`${name} must be a nonnegative ${integer ? 'integer' : 'number'} or null.`);
  return value;
}
function validate(data, name) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${name}: expected a JSON object.`);
  if (typeof data.source !== 'string' || !data.source.trim()) throw new Error(`${name}: source must identify the real export.`);
  const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  if (!date(data.period?.start) || !date(data.period?.end) || data.period.start > data.period.end || typeof data.period.timeZone !== 'string' || !data.period.timeZone.trim()) throw new Error(`${name}: period needs valid start/end YYYY-MM-DD dates in order and timeZone.`);
  if (data.scope != null && typeof data.scope !== 'string') throw new Error(`${name}: scope must be a string.`);
  const fields = name === 'analytics' ? ['visits','pageviews','usefulInteractions'] : name === 'ads' ? ['monetizedPageviews'] : ['clicks','impressions'];
  for (const field of fields) number(data[field], `${name}.${field}`);
  if (name === 'analytics' && data.usefulInteractions != null && (typeof data.interactionDefinition !== 'string' || !data.interactionDefinition.trim())) throw new Error('analytics: interactionDefinition must describe exactly which event counts were included.');
  if (name === 'ads') {
    number(data.earnings, 'ads.earnings', false);
    number(data.pageRpm, 'ads.pageRpm', false);
    if ((data.earnings != null || data.pageRpm != null) && !/^[A-Z]{3}$/.test(data.currency || '')) throw new Error('ads: measured earnings/RPM require an ISO three-letter currency.');
  }
  if (data.topLandingPages != null) {
    if (!Array.isArray(data.topLandingPages)) throw new Error(`${name}.topLandingPages must be an array or null.`);
    for (const [index, row] of data.topLandingPages.entries()) {
      if (!row || typeof row.path !== 'string' || !row.path.startsWith('/') || /[\r\n]/.test(row.path)) throw new Error(`${name}.topLandingPages[${index}] needs a site-relative path.`);
      for (const field of name === 'analytics' ? ['visits','usefulInteractions'] : ['clicks','impressions']) number(row[field], `${name}.topLandingPages[${index}].${field}`);
    }
  }
  return data;
}
async function input(name) {
  const path = resolve(options[name] || resolve(root, `metrics/${name}.json`));
  try {
    return {path, data: validate(JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, '')), name)};
  } catch (error) {
    if (error.code === 'ENOENT' && !options[name]) return {path, data: null, reason: 'No export imported.'};
    issues.push(`${name}: ${error.message}`);
    return {path, data: null, reason: 'Input is missing or invalid; see issues.'};
  }
}
const sources = {};
for (const name of ['analytics','search-console','bing','ads']) sources[name] = await input(name);
const from = (name, key, label = key) => sources[name].data ? metric(sources[name].data[key], label, sources[name].data, sources[name].data.source) : unavailable(sources[name].reason);
const metrics = {
  visits: from('analytics', 'visits', 'GA4 sessions (visits)'),
  pageviews: from('analytics', 'pageviews', 'GA4 page views'),
  usefulInteractions: from('analytics', 'usefulInteractions', 'Useful interactions'),
  organicClicks: {google: from('search-console','clicks'), bing: from('bing','clicks')},
  searchImpressions: {google: from('search-console','impressions'), bing: from('bing','impressions')},
  topLandingPages: {
    analytics: from('analytics','topLandingPages'),
    google: from('search-console','topLandingPages'),
    bing: from('bing','topLandingPages')
  },
  adEarnings: from('ads','earnings'),
  pageRpm: from('ads','pageRpm')
};
if (sources.analytics.data?.interactionDefinition) metrics.usefulInteractions.definition = sources.analytics.data.interactionDefinition;
const ads = sources.ads.data;
if (ads?.currency) {
  metrics.adEarnings.currency = ads.currency;
  metrics.pageRpm.currency = ads.currency;
}
if (ads?.pageRpm == null && ads?.earnings != null && ads.monetizedPageviews > 0) metrics.pageRpm = {...metric(ads.earnings / ads.monetizedPageviews * 1000, 'Page RPM', ads, ads.source), status: 'derived', currency: ads.currency, formula: 'earnings / monetizedPageviews × 1000 (same ad export and period)'};
let health = unavailable('No health run found. Run npm run health.');
const healthPath = resolve(options.health || resolve(root,'artifacts/health/latest.json'));
try {
  const data = JSON.parse(await readFile(healthPath, 'utf8'));
  if (typeof data.generatedAt !== 'string' || typeof data.summary?.failed !== 'number') throw new Error('Invalid health report schema.');
  health = {status: 'observed', generatedAt: data.generatedAt, baseUrl: data.baseUrl, mode: data.mode, summary: data.summary, failures: data.checks.filter(check => check.pass === false).map(check => ({name: check.name, detail: check.detail}))};
} catch (error) {
  if (error.code !== 'ENOENT' || options.health) issues.push(`health: ${error.message}`);
}
const periods = [...new Set(Object.values(sources).filter(source => source.data).map(source => JSON.stringify(source.data.period)))];
const notes = [
  'Missing measurements are null/unavailable; zero is displayed only when explicitly imported.',
  'Visits mean GA4 sessions. Consent, blockers, filters, timezone and attribution can limit observed totals.',
  'Google and Bing clicks/impressions remain separate. Search Console page rows can differ from property totals; row lists are not assumed complete.',
  'Useful interactions are event counts with the imported definition; they do not represent unique people or prove satisfaction.',
  'Ad earnings may be estimated, not paid revenue; page RPM uses the ad platform denominator, not GA4 visits.',
  'Health is a timestamped technical observation, not an uptime history or proof of indexation.'
];
if (periods.length > 1) notes.push('Imported reporting periods/timezones differ; cross-source comparisons and sums are not produced.');
const report = {schemaVersion: 1, generatedAt, metrics, health, sources: Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, {status: source.data ? 'imported' : 'unavailable', file: source.path, source: source.data?.source || null, period: source.data?.period || null, scope: source.data?.scope || null}])), issues, notes};
const format = value => value.value == null ? `Unavailable (${value.reason})` : Array.isArray(value.value) ? `${value.value.length} imported rows` : `${typeof value.value === 'number' ? value.value.toLocaleString('en-US', {maximumFractionDigits: 2}) : value.value}${value.currency ? ` ${value.currency}` : ''} [${value.status}]`;
const rows = [['Visits (GA4 sessions)',metrics.visits],['Page views',metrics.pageviews],['Google organic clicks',metrics.organicClicks.google],['Google search impressions',metrics.searchImpressions.google],['Bing clicks',metrics.organicClicks.bing],['Bing impressions',metrics.searchImpressions.bing],['Useful interactions',metrics.usefulInteractions],['Top landing pages: GA4',metrics.topLandingPages.analytics],['Top pages: Google',metrics.topLandingPages.google],['Top pages: Bing',metrics.topLandingPages.bing],['Ad earnings',metrics.adEarnings],['Page RPM',metrics.pageRpm]];
const clean = value => String(value).replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
let markdown = `# CopySprig operating report\n\nGenerated ${generatedAt}. No network requests were made.\n\n| Metric | Value |\n| --- | --- |\n${rows.map(([label,value]) => `| ${label} | ${clean(format(value))} |`).join('\n')}\n\n`;
for (const [name, value] of Object.entries(metrics.topLandingPages)) {
  if (!Array.isArray(value.value) || !value.value.length) continue;
  const keys = name === 'analytics' ? ['visits','usefulInteractions'] : ['clicks','impressions'];
  markdown += `## Imported top pages: ${name}\n\nSource: ${clean(value.source)}; ${value.period.start} to ${value.period.end} (${clean(value.period.timeZone)}).\n\n| Path | ${keys.join(' | ')} |\n| --- | --- | --- |\n${value.value.map(row => `| ${clean(row.path)} | ${keys.map(key => row[key] == null ? 'Unavailable' : row[key]).join(' | ')} |`).join('\n')}\n\n`;
}
markdown += `Technical health: ${health.status === 'observed' ? `${health.summary.failed ? 'FAILED' : 'passed'} at ${health.generatedAt} (${health.mode}; ${health.summary.failed} failed, ${health.summary.skipped} skipped)` : 'Unavailable'}\.\n\n${notes.map(note => `- ${note}`).join('\n')}\n`;
if (issues.length) markdown += `\nInput issues:\n\n${issues.map(issue => `- ${clean(issue)}`).join('\n')}\n`;
const out = resolve(options.out || resolve(root, 'artifacts/reports'));
await mkdir(out, {recursive: true});
const stamp = generatedAt.replace(/[:.]/g, '-');
await writeFile(resolve(out, `report-${stamp}.json`), JSON.stringify(report, null, 2) + '\n');
await writeFile(resolve(out, `report-${stamp}.md`), markdown);
await writeFile(resolve(out, 'latest.json'), JSON.stringify(report, null, 2) + '\n');
await writeFile(resolve(out, 'latest.md'), markdown);
console.log(markdown);
console.log(`Saved ${resolve(out, 'latest.json')} and ${resolve(out, 'latest.md')}`);
process.exitCode = issues.length ? 1 : 0;
