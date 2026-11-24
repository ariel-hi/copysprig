/**
 * Pure evaluation for the weekly search health check (scripts/search-health.mjs).
 * Alerts are reserved for problems worth a person's attention; everything else is a status note.
 */
const day = 24 * 60 * 60 * 1000;
/** Ignore impression swings below this weekly base; tiny numbers are noise. */
export const minimumImpressionBase = 100;
/** Alert when a week's impressions fall by at least this share of the previous week's. */
export const impressionDropShare = 0.5;
/** Alert when this share of inspected sitemap URLs is "Crawled - currently not indexed". */
export const crawledNotIndexedAlertShare = 0.2;
/** The page budget only grows while Google indexes nearly everything it crawls. */
export const healthyCrawledNotIndexedShare = 0.1;
export const budgetStep = 10;

export function evaluateSearchHealth({ now, totals, previousTotals, window, inspections, previous, routeCount, budget, errors = [] }) {
  const alerts = [...errors];
  const notes = [];

  // Impressions trend.
  const weekly = [...(previous?.weekly ?? [])];
  if (totals && window) {
    if (!weekly.some(week => week.end === window.end)) weekly.push({ end: window.end, impressions: totals.impressions, clicks: totals.clicks });
    notes.push(`Last 7 days of final data (${window.start} to ${window.end}): ${totals.impressions} impressions, ${totals.clicks} clicks, average position ${totals.position?.toFixed(1) ?? 'n/a'}${previousTotals ? ` (previous 7 days: ${previousTotals.impressions} impressions, ${previousTotals.clicks} clicks)` : ''}.`);
    if (previousTotals && previousTotals.impressions >= minimumImpressionBase && totals.impressions <= previousTotals.impressions * (1 - impressionDropShare)) {
      alerts.push(`Google impressions fell ${Math.round((1 - totals.impressions / previousTotals.impressions) * 100)}% week over week (${previousTotals.impressions} to ${totals.impressions}). Check Search Console for a manual action or a Google update.`);
    }
  }
  weekly.sort((a, b) => a.end.localeCompare(b.end));
  const history = weekly.slice(-26);

  // Indexing across the sitemap.
  const indexed = { ...(previous?.indexed ?? {}) };
  let crawledShare = null;
  if (inspections?.length) {
    const pass = inspections.filter(page => page.verdict === 'PASS');
    const crawled = inspections.filter(page => page.coverageState === 'Crawled - currently not indexed');
    const discovered = inspections.filter(page => page.coverageState === 'Discovered - currently not indexed');
    crawledShare = crawled.length / inspections.length;
    notes.push(`URL inspection of ${inspections.length} sitemap URLs: ${pass.length} indexed, ${crawled.length} crawled but not indexed, ${discovered.length} discovered but not crawled yet, ${inspections.length - pass.length - crawled.length - discovered.length} other.`);
    if (crawledShare >= crawledNotIndexedAlertShare) alerts.push(`${crawled.length} of ${inspections.length} sitemap URLs (${Math.round(crawledShare * 100)}%) are "Crawled - currently not indexed". Google is declining pages after reading them, the early sign of a site-quality problem. Pause adding pages and deepen the affected ones: ${crawled.slice(0, 15).map(page => page.path).join(', ')}${crawled.length > 15 ? ', …' : ''}.`);
    const dropped = inspections.filter(page => page.verdict !== 'PASS' && indexed[page.path]);
    if (dropped.length >= 3) alerts.push(`${dropped.length} pages that were indexed have dropped out: ${dropped.slice(0, 15).map(page => `${page.path} (${page.coverageState})`).join(', ')}.`);
    const home = inspections.find(page => page.path === '/');
    if (home && home.verdict !== 'PASS') alerts.push(`The home page is not indexed (${home.coverageState}).`);
    for (const page of inspections) indexed[page.path] = page.verdict === 'PASS';
  }

  // Page budget: grow it only while indexing is healthy and the site is near the ceiling.
  let nextBudget = budget.maxPages;
  const healthy = crawledShare !== null && crawledShare < healthyCrawledNotIndexedShare && !alerts.length;
  if (healthy && routeCount >= budget.maxPages - 5) nextBudget = budget.maxPages + budgetStep;
  notes.push(`Pages: ${routeCount} of a ${budget.maxPages}-page budget${nextBudget > budget.maxPages ? `; indexing is healthy, so the budget rises to ${nextBudget}` : healthy ? '' : '; the budget stays put until indexing is healthy'}.`);

  const trend = history.length > 1 ? `\n## Weekly impressions\n${history.map(week => `- Week ending ${week.end}: ${week.impressions} impressions, ${week.clicks} clicks`).join('\n')}\n` : '';
  const report = `# CopySprig search health ${now.toISOString().slice(0, 10)}

## Alerts
${alerts.length ? alerts.map(alert => `- ${alert}`).join('\n') : '- None.'}

## Status
${notes.map(note => `- ${note}`).join('\n')}
${trend}`;
  return { alerts, report, nextBudget, state: { checkedAt: now.toISOString(), indexed, weekly: history } };
}

export const finalWindows = (now, lagDays = 3) => {
  const end = new Date(now.getTime() - lagDays * day);
  const iso = date => date.toISOString().slice(0, 10);
  const shift = days => new Date(end.getTime() - days * day);
  return { current: { start: iso(shift(6)), end: iso(end) }, previous: { start: iso(shift(13)), end: iso(shift(7)) } };
};
