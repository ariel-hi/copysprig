# CopySprig maintenance

Read `DESIGN.md` before changing visible UI. Preserve the text-workshop identity and the mobile-first copying workflow across utility, collection, article, dialog and error pages.

Keep infrastructure and marketing spending at $0. Text transformation, symbol search and copying must work locally without accounts, ads or analytics. Never send entered text, generated text, clipboard contents or search words to analytics. Keep ads inactive until the real account, publisher, approval and consent requirements are met.

For a visible change, inspect the rendered result at desktop and narrow mobile widths; confirm reflow, named controls, keyboard focus and the affected copy/search/save flow. Use the smallest useful verification scope, then run the required `npm test`, `npm run build` and `npm run check` gates. Build output in `dist` is tracked and must match source.

After necessary verification passes, commit and push to `main` to deploy immediately, as the user has authorized. Confirm the actual deployment and live behavior. A local fix alone is incomplete; report a concrete deployment blocker if one exists.

Make ongoing changes for observed usability defects or evidence-backed improvements. Preserve dated evidence and avoid cosmetic churn just to produce activity.
