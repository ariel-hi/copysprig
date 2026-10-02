# CopySprig design standard

CopySprig is a small text workshop: enter a few words, compare useful Unicode specimens, copy a result, and keep a selection for next time. Warm paper, dark ink, ruled lists and a restrained botanical mark give the tools a recognizable home. The working tool comes before explanations. Readable output and an easy first copy take priority over decoration.

This is a maintainer standard for the current source, not a claim that a release has passed visual or accessibility verification. [src/styles.css](src/styles.css) defines the presentation; [scripts/build.mjs](scripts/build.mjs) generates the shared structure; [src/app.mjs](src/app.mjs) implements interactive states. Edit those sources and rebuild. Do not hand-edit generated `dist` pages. The build versions CSS, entry modules and their local module imports from the normalized source content. Keep that version propagation intact so returning visitors receive a coherent release; HTML revalidates while versioned assets can be cached.

## Palette and typography

Use the existing semantic variables. Keep a single palette across the homepage, supporting utilities, information pages, manual-copy window, favicon and social preview.

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#f8f5ec` | Warm page ground |
| `--paper` | `#fffdf7` | Input surfaces and reversed action text |
| `--ink` | `#25362c` | Body text, strong specimen rules |
| `--green` | `#345440` | Primary actions, links and sprig |
| `--rust` | `#a6452d` | Small annotations, hover and focus accents |
| `--muted` | `#60665d` | Supporting text that remains readable |
| `--line` | `#d1d3c5` | Decorative dividers and list structure |
| `--control` | `#84907e` | Input and save-control boundaries |
| `--soft` | `#eaf0e5` | Saved/copied-state surface |

Georgia, with Times New Roman/serif fallbacks, is the display face for the wordmark and editorial headings. Segoe UI, Helvetica and Arial keep labels, paragraphs and controls familiar. SFMono-Regular, Consolas and Liberation Mono provide small specimen numbers and supporting annotations. Tiny annotations are supplementary; never put the only instruction or action label in them.

Keep generated characters in the native glyph stacks already used by the output and symbol components: Segoe UI Symbol, Cambria Math and Apple Symbols where appropriate, then generic fallbacks. A web font must not turn an unsupported character into an invisible result. The interface needs no hosted font service, font download or paid dependency.

## Identity and page hierarchy

Reuse the shared two-leaf SVG sprig in the brand and workshop note. The favicon uses the same shape. Decorative glyph studies, indices and sprigs are hidden from assistive technology; meaningful style and symbol names remain ordinary readable text.

Keep the introduction short: one clear task heading and a concise explanation, followed by the input or search. The desktop `Aa` study supports the workshop identity and disappears at 760 CSS pixels and below. Avoid adding a taller promotional hero or introductory content that moves the first useful result out of easy reach. Refresh the actual product social screenshot when a substantial visual change makes it stale.

Prefer rules, alignment and spacing to nested panels. Inputs and disclosures use 4px corners; action/filter/save controls use 3px corners; input fields use 2px corners. Text specimens are a continuous ruled list, with a small index, a plain style label, readable output and explicit Copy/Save actions. Symbol collections form a ruled cabinet of named glyphs. Related tools are text links with a small directional mark.

## Mobile and repeat use

The tool comes first in source and keyboard order; the collection occupies the right column on desktop. At 760px and below the workspace becomes a column, and CSS places the collection shortcut visually above the tool so it is reachable without scrolling through a long result list. The HTML starts both disclosures closed, so mobile does not paint a large collection and then shift the tool when JavaScript loads. The secondary collection opens on desktop and when crossing back to desktop, preserving user choices while remaining on mobile. Category navigation starts closed on every screen and opens only by user choice; this also keeps the desktop symbol grid stable. Keep the saved count visible on the collection summary.

On symbol pages, **Find a symbol** precedes **Browse collections**. Search stays usable without first expanding the category links. Saved filtering and empty states must offer a clear route back to all results.

At 450px and below, each text specimen has the full available width, with Copy and Save together in a horizontal row beneath it. Wide dividers and text faces use one column at that size. Long phrases, multiline input and glyphs wrap rather than forcing page-wide horizontal scrolling. Do not trade readable specimens or 44px save targets for more columns.

Favorites and recents store selection identifiers on the device. Saved styles apply to the current input; stored custom phrases are not part of this product. Keep the local-storage explanation accurate and the manual-copy route available.

## Interaction and accessibility

Copy is a named button, and Save exposes its item name and pressed state. A successful copy gives feedback at the activated control and through the polite live status region. Visual feedback alone is not proof of clipboard delivery: use an actual clipboard read or paste when testing. If automatic copying fails, the manual-copy dialog must expose selectable text, a clear Done action and sensible focus restoration. Empty input must not report a successful copy of an earlier result.

Buttons have a source minimum of **44×44px**; frequently used links and disclosure summaries also keep generous tap height. This is a project choice; WCAG 2.2's AA [target-size criterion](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) has a 24px minimum with exceptions. Keep space between neighboring actions and visible disclosure summaries.

Normal text should meet **4.5:1** contrast; qualifying large text may use **3:1**. Important control boundaries, state indicators and authored focus indicators need **3:1** against adjacent colors. Decorative list rules may be lighter, but cannot be the only way to identify a control. Check actual foreground/background pairs, including muted text, placeholders, hover, saved, copied and consent states. See W3C's [text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) guidance.

Maintain visible keyboard focus, the skip link, meaningful labels, native disclosure semantics and logical navigation. Main has `tabindex="-1"` so the skip link can move focus reliably without adding a normal tab stop. Keep tool controls before the collection in keyboard order. Focus must remain apparent on paper and colored controls; do not remove outlines to improve a screenshot. Respect reduced motion. Check that zoom/reflow does not hide text or controls at **320 CSS pixels**. W3C's [focus-visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html) and [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) guidance explain those requirements. These checks do not establish full accessibility certification.

## Before deploying a visual change

Run the required project build, tests and audit from [README.md](README.md). Then inspect the rendered change, using an isolated preview port when another application occupies 4173.

1. Review the homepage, a focused text tool, symbols and a wide divider/text-face collection at **320, 390, 768 CSS pixels and desktop**. Record exact viewport dimensions, route, source revision and date with screenshots. Check overflow, first useful result, typography, wrapping, action alignment and collection/category access.
2. Tab through the skip link, navigation, disclosures, input/search, filters, Copy, Save and information links. Use Enter/Space as appropriate. Confirm visible focus, meaningful names and state changes; check the manual-copy dialog if that path changed.
3. Copy a neutral sample and verify the actual payload. Include multiline text, punctuation, emoji, accented/non-Latin text and long wrapping input when output layout changes. Test a named symbol and a wide divider when those components change.
4. Search a name, inspect a no-match state, return to All, save a selection and reach it through the collection/saved filter. Check repeated-copy feedback and that empty input does not copy stale text. Keep analytics disabled during routine visual QA, or classify test traffic explicitly as operator QA.
5. Deploy authorized fixes as soon as the necessary verification passes. Confirm the actual deployment result, run live HTTP health, and repeat the changed interaction on the public site. A local screenshot or a passing HTTP check alone does not prove the whole release.

Keep evidence in ignored `artifacts` or the project's private verification record. Never commit credentials, account screenshots or visitor text. Record unavailable browser/clipboard checks as gaps, not passes. Recheck only the affected behavior and required gates unless a new failure justifies broader testing.

## Ongoing quality review

Weekly review should compare the live homepage and one rotating supporting utility with the last verified evidence. Look for a concrete regression or useful improvement in first-copy access, specimen readability, keyboard use, saved-item access, search, overflow, contrast or unobstructed controls. Use actual search/interaction data when available; absent data stays unavailable.

Preserve the workshop identity and portable, dependency-free core. Make a change when an observed defect or credible user need explains its value. A schedule is not a reason to restyle a healthy page. Keep infrastructure and marketing spending at $0, do not create accounts or send more outreach, and notify the owner only for a meaningful change, failure or required action. Local scheduled reviews require the computer and app to be available; they are not an always-on cloud monitor. [Official scheduled-task guidance](https://learn.chatgpt.com/docs/automations?surface=app).
