# Import real measurements

`npm run report` works without a network connection or any account. It writes a timestamped JSON/Markdown report and `latest.json`/`latest.md` to `site/artifacts/reports/`. With no imported files, visits, search clicks/impressions, useful interactions, top landing pages, earnings and RPM are **unavailable**, not zero. This dashboard does not create or access a GA4, Search Console, Bing or ad account.

Default inputs are `analytics.json`, `search-console.json`, `bing.json` and `ads.json` in this directory. They are normalized summaries of actual owner exports; raw CSV layouts differ by account/report/localization and are not parsed automatically. Keep raw exports privately for audit, then transcribe the correct totals and rows into the schemas below. Do not upload credentials, access tokens, personal user records, entered text or clipboard contents. `site/firebase.json` publishes only `dist`, so these private inputs and artifacts are outside the deployed directory.

From `site`, explicit paths can be supplied instead of defaults:

```powershell
npm run report -- --analytics metrics/analytics.json --search-console metrics/search-console.json --bing metrics/bing.json --ads metrics/ads.json
```

Omit options for accounts that are unavailable. A requested missing file or malformed value causes a nonzero exit and a visible input issue. Each available number needs its real source, date range and timezone. Actual measured zero is valid; leave missing data `null`. Different periods remain separate and are identified in the report. Counts must be nonnegative integers; money/RPM may contain decimals. Optional `scope` describes filters, consent coverage, platform search type and estimated/finalized earnings.

## Analytics: sessions, page views and useful actions

In GA4, select the correct website/property and date range. Use the acquisition report's **Sessions** total for `visits` and the matching page-view/event report for `pageviews`. Export an Engagement → Landing page report for landing sessions; its dimensions are session-scoped. Use the event report to obtain real event counts. Current CopySprig instrumentation permits `copy` and `favorite_toggle` only after analytics consent; manual-copy fallback does not emit a successful `copy`. Define exactly which events constitute useful interactions. Do not include `page_view` in useful actions. See the [GA4 landing page report](https://support.google.com/analytics/answer/12931766?hl=en) and [GA4 export instructions](https://support.google.com/analytics/answer/9317657?hl=en): Viewer access is sufficient; Reports → Share this report → Download File → CSV also offers Sheets.

Save `analytics.json` using actual report dates. The dates below show format only; every metric is deliberately unavailable:

```json
{
  "source": "GA4 owner export; original CSV retained privately",
  "period": {"start": "2026-10-01", "end": "2026-10-01", "timeZone": "America/Los_Angeles"},
  "scope": "CopySprig web stream; consenting observed sessions; describe any filters",
  "visits": null,
  "pageviews": null,
  "usefulInteractions": null,
  "interactionDefinition": "copy event count plus favorite_toggle event count; event counts, not unique users",
  "topLandingPages": null
}
```

When measured, `topLandingPages` is an array of `{"path":"/bold-text/","visits":<real integer>,"usefulInteractions":<real integer or null>}`. Sort actual rows by sessions before import. An empty array means the exported report had no rows, so use it only when verified. Consent/blockers and data-quality flags limit coverage; a visit is a session, not a person. Retain filter and timezone context rather than comparing unlike windows.

## Google Search Console and Bing

After ownership verification and collection, choose the date range and search type in Google Search Console Performance → Search results. Export chart totals plus the Pages tab, using the real **property chart totals** for `clicks`/`impressions`. Normalize full site URLs in page rows to paths. Page sums can differ from chart totals because aggregation differs. Exports can omit rows; unavailable display markers can become zero in an export, so preserve their unavailable meaning when applicable. See [Google's export documentation](https://support.google.com/webmasters/answer/12919797?hl=en) and [performance report definitions](https://support.google.com/webmasters/answer/7576553?hl=en).

Bing Webmaster Tools → Search Performance → Download exports CSV. Select and record whether the scope is Web or All sources; All can include additional Bing surfaces. A verified new site can initially have no report data. See [Bing Search Performance](https://www.bing.com/webmasters/help/search-performance-c680da36).

Save `search-console.json` and/or `bing.json` with this schema, changing source, dates, timezone and scope to match each export:

```json
{
  "source": "Owner Search Console export; original CSV retained privately",
  "period": {"start": "2026-10-01", "end": "2026-10-01", "timeZone": "America/Los_Angeles"},
  "scope": "Search results; Web; entire verified property; no filters",
  "clicks": null,
  "impressions": null,
  "topLandingPages": null
}
```

Measured page rows use `{"path":"/bold-text/","clicks":<real integer>,"impressions":<real integer>}`. Search page rows indicate clicked/impressed pages; they are not interchangeable with the GA4 session landing report. Google/Bing totals are displayed separately and never added to visits. A successful sitemap submission or search verification does not establish traffic or indexation.

## Ads: earnings and page RPM

An approved, serving ad account is needed to measure revenue. Approval, submitted applications, placeholders and forecast scenarios do not count as earnings. In AdSense Reports choose the same date range/site and export CSV through the report menu; see [official AdSense export steps](https://support.google.com/adsense/answer/9830628?hl=en-GB). Save `ads.json` with the actual account currency, estimated/finalized status and **ad-platform page-view denominator**:

```json
{
  "source": "Owner ad platform export; original CSV retained privately",
  "period": {"start": "2026-10-01", "end": "2026-10-01", "timeZone": "America/Los_Angeles"},
  "scope": "CopySprig only; specify estimated or finalized earnings",
  "currency": "USD",
  "earnings": null,
  "monetizedPageviews": null,
  "pageRpm": null
}
```

If real `pageRpm` is supplied, it is displayed as measured. Otherwise, only real earnings plus a positive `monetizedPageviews` denominator in this same file produce a derived RPM (`earnings / monetizedPageviews × 1000`). Never substitute sessions, impressions or site page views from another source. No denominator or no serving ads means RPM is unavailable. Estimated earnings are not a payment.

## Health input and retention

Report automatically includes `artifacts/health/latest.json` if present, preserving its timestamp and failures. `--health path/to/health.json` selects another actual run. Health means a snapshot of routes/metadata/redirects, not an uptime percentage. Re-run after a release; see [OPERATIONS.md](../../docs/OPERATIONS.md). Keep private exports/reports only as long as useful. Nothing here starts a paid export pipeline or cloud warehouse.
