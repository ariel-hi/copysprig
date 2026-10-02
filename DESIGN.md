# CopySprig design standard

CopySprig is a colorful text playground: enter a phrase, compare Unicode styles or make a custom mix, copy a result and save a selection for next time. Rounded display lettering, a lavender canvas, deep violet outlines and coral, lime and pink cards define the current identity. Decoration supports an easy first copy and readable results.

This describes the implemented source, not a completed release audit. [src/styles.css](src/styles.css) defines presentation, [scripts/build.mjs](scripts/build.mjs) generates shared structure and [src/app.mjs](src/app.mjs) implements interactions. Edit source and rebuild; never hand-edit generated `dist`. Preserve content-based asset versions and their propagation through local module imports so returning visitors receive a coherent release.

## Palette and type

Use the existing variables consistently across tools, collections, articles, dialogs, error pages and brand assets.

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#f2ebff` | Lavender canvas |
| `--paper` | `#ffffff` | White surfaces and reversed text |
| `--ink` | `#27133f` | Deep violet text, outlines and primary buttons |
| `--muted` | `#655676` | Supporting text |
| `--green` | `#6231c9` | Purple links and action accents; legacy token name |
| `--rust` | `#923048` | Berry hover accent; legacy token name |
| `--line` | `#d5c5ea` | Decorative separators |
| `--control` | `#9381aa` | Form-control boundaries |
| `--soft` | `#e9ddff` | Soft lavender surface |
| `--coral` | `#ff987f` | Coral brand accent |
| `--lime` | `#d9ff65` | Lime accents and confirmed states |
| `--pink` | `#ffd4e9` | Pink accent |
| `--violet` | `#6d35df` | Brand violet |

Fredoka supplies the wordmark, headings and display labels. Its self-hosted Latin variable WOFF2 is **29,732 bytes**, supports weights **300–700**, and uses `font-display: swap` plus a local preload. Keep [the OFL license](src/media/fonts/OFL-Fredoka.txt) with the asset and preserve system fallbacks. No external font request or paid dependency is needed. Segoe UI/Helvetica/Arial handle body text and ordinary controls; the mono stack handles supplementary specimen indices.

Generated Unicode output keeps its native glyph stack, including Segoe UI Symbol, Cambria Math and Apple Symbols. Fredoka is an interface face, not the font used to render or export every generated character. Keep meaningful labels in ordinary readable text.

## Identity and components

Reuse the shared rounded violet **C monogram with lime sparkle** in the brand and favicon. The Fredoka CopySprig wordmark highlights “Sprig” in violet. Decorative sparks, indices and glyph tickets are hidden from assistive technology.

The desktop hero uses three compact rotated glyph tickets with thick outlines and offset shadows. It disappears at 980px and below. Keep the task heading and explanation concise so the input, search and first useful result stay easy to reach. The main navigation includes Mixer; the desktop shelf offers compact Hearts, Stars, Dividers and Custom mix shortcuts. Catalog counts in the introduction and shelf derive from source metadata, currently 34 text styles and 125 symbols.

Use rounded outlined panels, pills and short offset shadows. Result cards have 17px corners and alternate white, coral, lime, lavender, pink and mint surfaces. They form two columns above 600px, then one column at 600px and below. The output spans the full card width above a compact footer containing the style label and explicit Copy and Save controls, followed by a smaller character-coverage note. At 761–900px, the label and actions occupy separate full-width rows so longer names remain readable beside the desktop shelf. Keep those labels readable when the copied check mark or a pick badge appears. Symbol cards use the same family of colors and named glyphs in a compact grid of two to five columns; dividers and text faces occupy wider cells. Use plain text labels on actions and links; do not add decorative directional arrow icons to buttons, downloads or related-tool links. Articles, the manual-copy dialog and related links share the rounded vocabulary. Refresh the actual product social screenshot when a visual change makes it stale.

Text-style pages offer All styles and Saved filter pills with a visible result count, followed by local Find a style search and a Style family select. The five metadata-defined families are Lettering, Enclosed, Small text, Text effects and Playful, with All families as the default. Search matches names, coverage descriptions and familiar aliases such as bubble, gothic and tiny; it combines with family and Saved filters. Style-specific routes keep their own catalog scope. Pick for me sits alongside the search and family controls, chooses from the current visible set, avoids immediately repeating a pick when another option exists, highlights the result and focuses its Copy button. It does not copy automatically. At 760px and below, its visible label becomes a compact sparkle icon while its accessible name remains Pick for me. Keep discovery controls smaller than the text specimens without reducing their touch targets.

The homepage places a closed Make a custom mix disclosure after its style results. The dedicated `/style-mixer/` page presents the same controls in an expanded section. A mix applies a base style, an optional effect and a frame around each nonblank line; blank and whitespace-only lines keep their original form. Preview and output count update locally. The count uses Unicode code points and includes added marks and frames, so the destination may count differently. Reset mix restores Sans bold with no effect or frame. Saving a mix retains its settings identifier on this device, never the entered phrase; saved mixes appear in the main generator’s Saved results and can be reached from the collection.

There are no perpetual animations. Keep movement limited to brief hover or action feedback, and preserve `prefers-reduced-motion` behavior: disable animation and transitions, restore ordinary scrolling and remove animated result/action movement.

## Responsive copying and collections

The tool comes first in DOM and keyboard order, with the saved collection at its right on desktop. At 760px and below, CSS places the collection shortcut visually above the tool. Collection and category disclosures start closed in HTML; the homepage mixer also starts closed. Do not paint an expanded mobile collection and collapse it after loading. The collection opens on desktop and when returning to desktop. Categories open only by user choice; the homepage mixer opens through its disclosure or a mixer link. Preserve these stable initial states and the visible saved count.

On symbol pages, **Find a symbol** precedes the collection controls. The full library has visible Everything and category chips for filtering without opening **Browse collections**; category routes keep their collection scope and link to the full library. Search runs locally across names, tags, glyphs and category labels, including common plural collection names and multiword requests in either word order. Result counts announce changes politely. Saved filters combine with the active search and collection. Empty states explain the current scope and offer Reset filters, with Explore all symbols on category routes. Reset clears the search and saved filter; on the full library it also restores Everything.

At 450px and below, text results use one column and symbol tiles use two; wide dividers and text faces use one column. Output keeps the full card width, with Copy and Save in one horizontal row beneath it. Mixer settings stack into one column. Long phrases and mixed glyphs wrap without page-wide horizontal scrolling. Favorites and recents store style, mix or symbol identifiers locally; they never retain the visitor’s phrases.

## Accessible interaction

Buttons keep a minimum **44×44px** target. Preserve named Copy/Save actions, pressed states, visible keyboard focus, the skip link, native disclosures and main’s `tabindex="-1"`. A click or tap on a text card can activate its Copy button, while keyboard users retain the named button. Selecting text inside a card must leave the selection and clipboard alone. Confirm successful copying through the actual clipboard payload or paste, not just a toast. The manual-copy dialog exposes selectable text, a Done action and sensible focus restoration. Empty input must not copy a stale result.

Check actual text/background pairs in default, hover, copied, saved, placeholder and consent states. Normal text needs **4.5:1** contrast; qualifying large text and important control boundaries need **3:1**. Lighter decorative separators cannot be the only control boundary. Retain readable labels on colored cards and the dark focus outline with its white halo. Review [text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) and [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) when affected. These checks do not establish full accessibility certification.

## Verify, deploy and maintain

Run the required tests, build and audit in [README.md](README.md). Use a separate preview port if another application occupies 4173.

1. Inspect the homepage and affected text/symbol/wide-glyph/mixer pages at **320, 390, 768 CSS pixels and desktop**. Record viewport, route, source revision and date. Check first-copy access, font loading, wrapping, overflow, footer labels and notes in copied and picked states, action alignment and disclosure stability. Check the 600px result-grid, 761–900px footer and 980px specimen transitions when those rules change.
2. Use the keyboard through the skip link, navigation, input/search, style-family select, Pick for me, category chips, saved filters, mixer selects and Reset mix, Copy, Save and disclosures. Check pressed states, the mobile pick button’s accessible name, result-count announcements, focus and the manual-copy route when changed.
3. Copy a neutral sample and verify its actual payload. Include multiline, long and mixed Unicode input when output changes. Check card copying and text selection separately. Combine style search, family and Saved; confirm that picking stays within the visible results and does not write to the clipboard. Search a symbol name, a plural category and a multiword description; test no matches and Reset filters on the full library and a category route. Combine symbol search, category and Saved, then save a selection and reach it again. Verify a mixed style/effect/frame output, its code-point count and nonblank-line framing, then save and reopen its settings without retaining the phrase.
4. Start live QA at `/?analytics=off` and confirm **Analytics excluded** before any tool interaction. Keep that persistent browser exclusion enabled. Verify Analytics initialization and consent with offline tests instead of sending QA events to GA4. Never send input, output, clipboard contents or search words to analytics.
5. Deploy authorized fixes immediately after necessary verification passes. Confirm the actual deployment, live HTTP health and the changed interaction on the public site. Record unavailable checks as gaps, not passes.

Keep dated evidence in ignored artifacts or private verification records; never commit credentials, account screenshots or visitor text. Weekly review compares the live homepage and one rotating utility with verified evidence, looking for observed usability defects or useful improvements. Preserve this colorful identity without unnecessary cosmetic churn. Keep spending at $0, create no accounts and send no additional outreach during maintenance. Notify only for a meaningful change, failure or required owner action. Local scheduled reviews require the computer and app to be available; they are not an always-on cloud monitor. [Official scheduling guidance](https://learn.chatgpt.com/docs/automations?surface=app).
