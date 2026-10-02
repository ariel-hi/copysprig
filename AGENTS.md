# CopySprig maintenance

Read `DESIGN.md` before changing visible UI. Preserve the colorful Fredoka identity: lavender canvas, deep violet outlines, coral/lime/pink cards, rounded controls, offset shadows and the C-and-spark mark. Keep the first useful tool and mobile copying workflow clear across utility, collection, article, dialog and error pages. Preserve the self-hosted font's OFL license, native Unicode glyph fallbacks, stable mobile disclosures and reduced-motion behavior; do not add perpetual animations.

Keep infrastructure and marketing spending at $0. Text transformation, symbol search and copying must work locally without accounts, ads or analytics. Never send entered text, generated text, clipboard contents or search words to analytics. Keep ads inactive until the real account, publisher, approval and consent requirements are met.

Start every live browser QA session at `https://copysprig.web.app/?analytics=off` and confirm **Analytics excluded** before exercising tools. This saves an exclusion for that browser profile; never clear or bypass it to check real Analytics receipt. Local previews and recognizable automated browsers are also excluded automatically. Verify analytics behavior through the offline integration tests, without sending operator events to GA4. Owner exclusions must override previously granted consent and Allow analytics.

For a visible change, inspect the rendered result at desktop and narrow mobile widths; confirm reflow, named controls, keyboard focus and the affected copy/search/save flow. Use the smallest useful verification scope, then run the required `npm test`, `npm run build` and `npm run check` gates. Build output in `dist` is tracked and must match source.

After necessary verification passes, commit and push to `main` to deploy immediately, as the user has authorized. Confirm the actual deployment and live behavior. A local fix alone is incomplete; report a concrete deployment blocker if one exists.

Make ongoing changes for observed usability defects or evidence-backed improvements. Preserve dated evidence and avoid cosmetic churn just to produce activity.
