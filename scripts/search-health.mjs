/**
 * Weekly search health check, run by .github/workflows/search-health.yml.
 *
 * Reads Search Console (performance and URL inspection) with the CopySprig service account, which has
 * Restricted (read-only) access to the sc-domain:copysprig.com property. Writes metrics/search-health.md
 * and metrics/search-health.json, raises page-budget.json while indexing stays healthy, and prints
 * `alerts=<n>` to GITHUB_OUTPUT so the workflow can open, update or close a GitHub issue.
 *
 * Credentials: GOOGLE_SERVICE_ACCOUNT_JSON (a service account key). Nothing is printed from it.
 */
import { createSign } from 'node:crypto';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { evaluateSearchHealth, finalWindows } from './search-health-lib.mjs';

const root = resolve(import.meta.dirname, '..');
const property = 'sc-domain:copysprig.com';
const origin = 'https://copysprig.com';
const readJson = async (file, fallback) => { try { return JSON.parse(await readFile(resolve(root, file), 'utf8')); } catch { return fallback; } };

async function accessToken() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not configured.');
  const key = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url');
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }) });
  if (!response.ok) throw new Error(`Google token exchange returned HTTP ${response.status}.`);
  return (await response.json()).access_token;
}

async function google(token, url, body) {
  const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`${new URL(url).pathname} returned HTTP ${response.status}.`);
  return response.json();
}

async function totals(token, window) {
  const data = await google(token, `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`, { startDate: window.start, endDate: window.end, dataState: 'final' });
  const row = data.rows?.[0];
  return { clicks: row?.clicks ?? 0, impressions: row?.impressions ?? 0, position: row?.position ?? null };
}

async function inspect(token, paths) {
  const results = [];
  for (const path of paths) {
    const data = await google(token, 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', { inspectionUrl: origin + path, siteUrl: property });
    const status = data.inspectionResult?.indexStatusResult ?? {};
    results.push({ path, verdict: status.verdict, coverageState: status.coverageState });
  }
  return results;
}

const now = new Date();
const windows = finalWindows(now);
const routes = await readJson('routes.json', []);
const budget = await readJson('page-budget.json', { maxPages: routes.length });
const previous = await readJson('metrics/search-health.json', undefined);
const errors = [];
let current, prior, inspections;
try {
  const token = await accessToken();
  [current, prior] = await Promise.all([totals(token, windows.current), totals(token, windows.previous)]);
  inspections = await inspect(token, routes.map(route => route.path));
} catch (error) {
  errors.push(`The weekly Search Console check failed: ${error instanceof Error ? error.message : 'unknown error'} Check the service account's Restricted access to ${property} and that the Search Console API is enabled for the copysprig project.`);
}
const result = evaluateSearchHealth({ now, totals: current, previousTotals: prior, window: windows.current, inspections, previous, routeCount: routes.length, budget, errors });

if (inspections || current) await writeFile(resolve(root, 'metrics/search-health.json'), `${JSON.stringify(result.state, null, 2)}\n`);
await writeFile(resolve(root, 'metrics/search-health.md'), result.report);
if (result.nextBudget !== budget.maxPages) await writeFile(resolve(root, 'page-budget.json'), `${JSON.stringify({ ...budget, maxPages: result.nextBudget, updatedAt: now.toISOString().slice(0, 10) }, null, 2)}\n`);
console.log(result.report);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, result.report);
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `alerts=${result.alerts.length}\n`);
