# CopySprig

[Live utility](https://copysprig.com/) · [Project contact](https://github.com/ariel-hi/copysprig/issues)

Free browser tools for short creator profile text: 29 utility routes, 34 curated Unicode styles and 125 named symbols, dividers and kaomoji. There are 34 indexable pages including the guide and site information. Text processing stays in the browser; favorites and recents store selection identifiers locally, never entered phrases. No visitor accounts, database or per-use API.

Browse five style families, search names and coverage notes, or combine lettering, an optional effect and a frame in the style mixer. The mixer shows the complete output count and saves only the selected settings. Twelve decorative frames are available in the mixer and text decorator; the mixer also offers no frame. Focused tools cover tiny text, square text, upside-down text, glitch effects and three underline variants.

## Run and verify

Node 22+; launch verified locally with Node 22.16.0/npm 10.9.2. CI uses Node 24. There are no npm package dependencies; package-lock.json locks the empty dependency graph. Firebase CLI 15.12.0 is pinned in CI.

```powershell
npm ci
npm run build
npm test
npm run check
npm run dev
```

Open http://127.0.0.1:4173 for preview. In a separate terminal:

```powershell
node scripts/health.mjs --base http://127.0.0.1:4173
node scripts/health.mjs --base https://copysprig.com
node scripts/report.mjs
```

Health checks every route, metadata, redirects, sitemap, robots, assets and real 404 responses. Browser QA is still necessary for clipboard, keyboard and visual behavior. Reporting shows unavailable metrics until real exports are imported; see [metrics/README.md](metrics/README.md).

If another application uses port 4173, leave it running and start CopySprig in a separate PowerShell terminal on 4175:

```powershell
$env:PORT = '4175'
npm run dev
```

Open http://127.0.0.1:4175 and use `node scripts/health.mjs --base http://127.0.0.1:4175` for that preview. The `PORT` setting affects this terminal's preview process; it does not change production. Stop the preview and close this separate terminal when finished.

## Edit and deploy

Edit src/ and scripts/build.mjs; dist/ is generated and portable. config.json centrally defines the public origin, contact, public analytics ID, ownership tags and inactive ad settings. Changing domains requires updating siteUrl, rebuilding and checking the export. .env.example documents optional health/provisioning overrides; normal operation needs no secrets.

Follow [DESIGN.md](DESIGN.md) for the vibrant Fredoka identity: lavender canvas, deep violet outlines, colorful rounded cards, offset shadows and the C-and-spark mark. It covers responsive collection access, reduced motion and meaningful visual, keyboard, copy/search/save checks before deployment, plus evidence-based maintenance without unnecessary cosmetic changes.

Push verified changes to main. The dedicated workflow runs tests/build/audit, deploys Firebase Hosting and checks the live site. View actual results in [Actions](https://github.com/ariel-hi/copysprig/actions). A source push alone does not prove deployment. For manual deployment using an existing authorized Firebase CLI session:

```powershell
firebase deploy --only hosting --project copysprig
node scripts/health.mjs
```

Keep Firebase project/site copysprig on Spark with no billing account. Hosting publishes only dist. No Functions, database, Cloud Run, paid trial or upgrade is needed. The quota guide lists 10 GB storage and 10 GB/month transfer; the pricing table also presents 360 MB/day. Use the actual console meter conservatively. Quota exhaustion can block deploys or disable serving on Spark. [Hosting quotas](https://firebase.google.com/docs/hosting/usage-quotas-pricing).

The production origin is https://copysprig.com. The provider hostname https://copysprig.web.app serves the same static export with canonical links to the production domain. To check that mirror, use `node scripts/health.mjs --base https://copysprig.web.app --canonical-base https://copysprig.com`. Firebase path-based redirects apply to every hostname attached to a Hosting site, so a universal redirect to the custom domain on this shared site would loop.

## Privacy and integrations

GA4 loads only after an explicit analytics opt-in. Enhanced measurement is disabled in its dedicated stream. Page metadata is sanitized globally and per event; copy/favorite events include only fixed selection identifiers. No input, clipboard text, search phrase, URL query or fragment is sent by this integration. Visitors can withdraw consent using Analytics choices. Tests cover inactive integrations, filtering and withdrawal.

Owner and QA traffic is excluded before the Google tag can load, even with previously granted consent. Open [the owner exclusion link](https://copysprig.com/?analytics=off) once in each browser profile/device used to visit or test the site. A local preference and host-only cookie preserve the exclusion on later routes and visits; the footer confirms **Analytics excluded**. Clearing all site data removes that preference, so open the link again afterward. Existing tabs receive local-storage exclusion changes immediately; the cookie fallback is rechecked on tab focus and tool actions. The exclusion cannot be overridden by Allow analytics.

Localhost, preview URLs and every origin other than the exact configured production `siteUrl` are excluded automatically. Automated browsers identified by `navigator.webdriver` or HeadlessChrome/Playwright/Puppeteer/Selenium user agents are also excluded. For any browser QA, start at `/?analytics=off` before navigating or clicking; test harnesses can additionally set `window.__COPYSPRIG_TEST__ = true` before page scripts run. Ordinary opted-in production visitors remain measurable. HTTP health checks and offline tests do not execute the Google tag. Earlier QA events already collected are historical test data and must stay excluded from business exports; this change does not erase GA4 history.

Ads remain disabled: approval, real publisher/slot values and a certified consent implementation are still required. The advertising consent bridge is a configuration seam, not a completed CMP. No guessed publisher ID or ads.txt is published. The site works with external scripts blocked.

Use normal Git/Firebase credential mechanisms. Never place tokens, service-account keys, private reports or visitor input in source. Default metric imports, .env files, Firebase local state and artifacts are ignored. scripts/setup-ci.mjs performs narrowly scoped project provisioning; don't use it for another project. Its deployment secret is protected in GitHub and excluded from this repository/export.

## Backup and rollback

The source and generated dist can be exported with git archive; a Git bundle preserves committed history. A static host must preserve slash URLs and serve 404.html with a 404 status, without an SPA rewrite. Canonicals/sitemap must match the destination.

For code rollback, revert a known good commit and push main. For immediate hosting rollback, use [Hosting Release history](https://console.firebase.google.com/project/copysprig/hosting), choose a verified prior version, then run health and actual copying. Verified launch commits include 9f785195a923f2ef2cac4f9359ab52c249597593 and 984418c5134e079aee2a60b6d1cf5cbd2855c20c. Do not change unrelated sites or DNS.

Private launch evidence, owner dependencies, research and growth plans are maintained in the local project root outside this public source repository. Indexing, traffic, approval and revenue require real post-launch measurements.
