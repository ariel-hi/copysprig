import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSearchHealth, finalWindows } from '../scripts/search-health-lib.mjs';

const now = new Date('2026-11-26T08:00:00Z');
const window = { start: '2026-11-17', end: '2026-11-23' };
const page = (path, verdict = 'PASS', coverageState = 'Submitted and indexed') => ({ path, verdict, coverageState });
const healthyPages = Array.from({ length: 20 }, (_, i) => page(i ? `/p${i}/` : '/'));
const base = { now, window, budget: { maxPages: 95 }, routeCount: 80 };

test('quiet and keeps the budget when the site is far below it', () => {
  const result = evaluateSearchHealth({ ...base, totals: { clicks: 1, impressions: 900, position: 60 }, previousTotals: { clicks: 0, impressions: 800 }, inspections: healthyPages });
  assert.deepEqual(result.alerts, []);
  assert.equal(result.nextBudget, 95);
});

test('raises the budget near the ceiling only while indexing is healthy', () => {
  assert.equal(evaluateSearchHealth({ ...base, routeCount: 92, totals: { clicks: 0, impressions: 500 }, inspections: healthyPages }).nextBudget, 105);
  const crawled = healthyPages.map((p, i) => i < 3 ? page(p.path, 'NEUTRAL', 'Crawled - currently not indexed') : p);
  assert.equal(evaluateSearchHealth({ ...base, routeCount: 92, totals: { clicks: 0, impressions: 500 }, inspections: crawled }).nextBudget, 95);
  assert.equal(evaluateSearchHealth({ ...base, routeCount: 92, errors: ['API down'] }).nextBudget, 95);
});

test('alerts on a sharp drop but ignores small numbers', () => {
  assert.match(evaluateSearchHealth({ ...base, totals: { clicks: 0, impressions: 300 }, previousTotals: { clicks: 0, impressions: 900 }, inspections: healthyPages }).alerts.join(), /fell 67%/);
  assert.deepEqual(evaluateSearchHealth({ ...base, totals: { clicks: 0, impressions: 10 }, previousTotals: { clicks: 0, impressions: 60 }, inspections: healthyPages }).alerts, []);
});

test('alerts when many pages are crawled but not indexed, or indexed pages drop out', () => {
  const crawled = healthyPages.map((p, i) => i && i <= 5 ? page(p.path, 'NEUTRAL', 'Crawled - currently not indexed') : p);
  assert.match(evaluateSearchHealth({ ...base, inspections: crawled }).alerts.join(), /5 of 20 sitemap URLs \(25%\)/);
  const previous = { checkedAt: '', weekly: [], indexed: Object.fromEntries(healthyPages.map(p => [p.path, true])) };
  const dropped = healthyPages.map((p, i) => i && i <= 3 ? page(p.path, 'NEUTRAL', 'Discovered - currently not indexed') : p);
  assert.match(evaluateSearchHealth({ ...base, previous, inspections: dropped }).alerts.join(), /3 pages that were indexed have dropped out/);
});

test('alerts on an unindexed home page and on API errors', () => {
  const homeOut = healthyPages.map((p, i) => i ? p : page('/', 'NEUTRAL', 'Crawled - currently not indexed'));
  assert.match(evaluateSearchHealth({ ...base, inspections: homeOut }).alerts.join(), /home page is not indexed/);
  assert.deepEqual(evaluateSearchHealth({ ...base, errors: ['The weekly Search Console check failed'] }).alerts, ['The weekly Search Console check failed']);
});

test('final-data windows are two back-to-back weeks ending three days ago', () => {
  assert.deepEqual(finalWindows(now), { current: { start: '2026-11-17', end: '2026-11-23' }, previous: { start: '2026-11-10', end: '2026-11-16' } });
});
