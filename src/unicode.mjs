/**
 * Local, DOM-independent text transforms. Assigned alphabets checked against:
 * https://www.unicode.org/Public/UCD/latest/ucd/UnicodeData.txt (2026-10-02).
 * Unicode symbols are not font files or HTML. Alphabet styles convert supported
 * ASCII only; accented graphemes, other scripts and emoji stay intact. Playful
 * styles intentionally change case, spacing or grapheme order within each line.
 */
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const MARK = /\p{Mark}/u;
const ASCII_ALNUM = /^[A-Za-z0-9]$/;
const LINE_BREAK = /(\r\n|[\n\r\u2028\u2029])/;
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const marks = Object.freeze({
  strikethrough: '\u0336',
  underline: '\u0332',
  'double-underline': '\u0333',
  overline: '\u0305',
  'dotted-underline': '\u0324',
  slash: '\u0338',
});
// Avoid ordinary acute, grave, diaeresis, cedilla and dot-below accents in the
// glitch palette. Light adds two marks; heavy adds six, never unbounded Zalgo.
const GLITCH_ABOVE = ['\u035B', '\u0352', '\u0350'];
const GLITCH_BELOW = ['\u034E', '\u0353', '\u0355'];
const ownMarks = new Set([...Object.values(marks), ...GLITCH_ABOVE, ...GLITCH_BELOW]);

function rangeMap(upperStart, lowerStart, digitStart, exceptions = {}) {
  const map = new Map();
  for (const [alphabet, start] of [[UPPER, upperStart], [LOWER, lowerStart], [DIGITS, digitStart]]) {
    if (start === undefined) continue;
    Array.from(alphabet).forEach((letter, index) => map.set(letter, String.fromCodePoint(start + index)));
  }
  Object.entries(exceptions).forEach(([letter, codepoint]) => map.set(letter, String.fromCodePoint(codepoint)));
  return map;
}

const maps = {
  bold: rangeMap(0x1D400, 0x1D41A, 0x1D7CE),
  italic: rangeMap(0x1D434, 0x1D44E, undefined, { h: 0x210E }),
  'bold-italic': rangeMap(0x1D468, 0x1D482),
  script: rangeMap(0x1D49C, 0x1D4B6, undefined, {
    B: 0x212C, E: 0x2130, F: 0x2131, H: 0x210B, I: 0x2110,
    L: 0x2112, M: 0x2133, R: 0x211B, e: 0x212F, g: 0x210A, o: 0x2134,
  }),
  'bold-script': rangeMap(0x1D4D0, 0x1D4EA),
  fraktur: rangeMap(0x1D504, 0x1D51E, undefined, {
    C: 0x212D, H: 0x210C, I: 0x2111, R: 0x211C, Z: 0x2128,
  }),
  'double-struck': rangeMap(0x1D538, 0x1D552, 0x1D7D8, {
    C: 0x2102, H: 0x210D, N: 0x2115, P: 0x2119, Q: 0x211A, R: 0x211D, Z: 0x2124,
  }),
  monospace: rangeMap(0x1D670, 0x1D68A, 0x1D7F6),
  'sans-bold': rangeMap(0x1D5D4, 0x1D5EE, 0x1D7EC),
  'sans-italic': rangeMap(0x1D608, 0x1D622),
  fullwidth: rangeMap(0xFF21, 0xFF41, 0xFF10),
  circled: rangeMap(0x24B6, 0x24D0, undefined, {
    0: 0x24EA, 1: 0x2460, 2: 0x2461, 3: 0x2462, 4: 0x2463,
    5: 0x2464, 6: 0x2465, 7: 0x2466, 8: 0x2467, 9: 0x2468,
  }),
  'bold-fraktur': rangeMap(0x1D56C, 0x1D586),
  sans: rangeMap(0x1D5A0, 0x1D5BA, 0x1D7E2),
  'sans-bold-italic': rangeMap(0x1D63C, 0x1D656),
  'negative-circled': rangeMap(0x1F150, 0x1F150, undefined, {
    0: 0x24FF, 1: 0x2776, 2: 0x2777, 3: 0x2778, 4: 0x2779,
    5: 0x277A, 6: 0x277B, 7: 0x277C, 8: 0x277D, 9: 0x277E,
  }),
  squared: rangeMap(0x1F130, 0x1F130),
  'negative-squared': rangeMap(0x1F170, 0x1F170),
  parenthesized: rangeMap(0x1F110, 0x249C, undefined, {
    1: 0x2474, 2: 0x2475, 3: 0x2476, 4: 0x2477, 5: 0x2478,
    6: 0x2479, 7: 0x247A, 8: 0x247B, 9: 0x247C,
  }),
};

// Established phonetic small capitals. Q/q and X/x remain unchanged rather
// than substituting Greek/Cyrillic lookalikes or newer glyphs.
const smallCaps = Array.from('ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘqʀꜱᴛᴜᴠᴡxʏᴢ');
maps['small-caps'] = new Map();
Array.from(LOWER).forEach((letter, index) => {
  if (letter === 'q' || letter === 'x') return;
  maps['small-caps'].set(letter.toUpperCase(), smallCaps[index]);
  maps['small-caps'].set(letter, smallCaps[index]);
});

// Conservative BMP superscripts preserve uppercase and q.
maps.superscript = new Map();
Array.from('ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖqʳˢᵗᵘᵛʷˣʸᶻ').forEach((glyph, index) => {
  if (LOWER[index] !== 'q') maps.superscript.set(LOWER[index], glyph);
});
Array.from('⁰¹²³⁴⁵⁶⁷⁸⁹').forEach((glyph, index) => maps.superscript.set(DIGITS[index], glyph));

// Unicode has no complete Latin subscript alphabet. Use only assigned Latin
// subscript characters; never borrow Greek letters to fill its gaps.
maps.subscript = new Map(Object.entries({
  a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ',
  o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ',
}));
Array.from('₀₁₂₃₄₅₆₇₈₉').forEach((glyph, index) => maps.subscript.set(DIGITS[index], glyph));

const uppercaseOnly = new Set(['negative-circled', 'squared', 'negative-squared']);
const reverseMap = new Map();
for (const [id, map] of Object.entries(maps)) {
  for (const [ascii, glyph] of map) reverseMap.set(glyph, uppercaseOnly.has(id) ? ascii.toUpperCase() : ascii);
}
// Small capitals merge upper/lower case; insertion order chooses lowercase.

function graphemes(text) {
  return Array.from(segmenter.segment(text), ({ segment }) => segment);
}

function perLine(text, transformLine) {
  return String(text ?? '').split(LINE_BREAK).map((line, index) => index % 2 ? line : transformLine(line)).join('');
}

function mapTransform(id) {
  return (text) => perLine(text, (line) => graphemes(line).map((grapheme) => maps[id].get(grapheme) ?? grapheme).join(''));
}

function combiningTransform(id) {
  return (text) => perLine(text, (line) => graphemes(line).map((grapheme) => {
    const [base, ...existingMarks] = Array.from(grapheme);
    // Allow effects on our alphabets and on existing effects, while protecting
    // genuine accented clusters, keycaps, variation selectors and ZWJ emoji.
    const plain = reverseMap.get(base) ?? base;
    if (!ASCII_ALNUM.test(plain) || !existingMarks.every((mark) => ownMarks.has(mark))) return grapheme;
    let selected;
    if (id === 'glitch-light' || id === 'glitch-heavy') {
      const index = plain.codePointAt(0) % GLITCH_ABOVE.length;
      selected = id === 'glitch-light' ? [GLITCH_ABOVE[index], GLITCH_BELOW[index]]
        : [...GLITCH_ABOVE.slice(index), ...GLITCH_ABOVE.slice(0, index), ...GLITCH_BELOW.slice(index), ...GLITCH_BELOW.slice(0, index)];
    } else selected = [marks[id]];
    return grapheme + selected.filter((mark) => !existingMarks.includes(mark)).join('');
  }).join(''));
}

// Approximate turned Latin letters, with no Greek, Cyrillic or Hebrew stand-ins.
// Uppercase, digits and l stay unchanged. This is a playful layout transform,
// not an invertible alphabet: ASCII b/q, d/p and n/u interchange naturally.
const upsideDown = new Map(Object.entries({
  a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ᴉ', j: 'ɾ', k: 'ʞ',
  m: 'ɯ', n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ', s: 's', t: 'ʇ', u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z',
}));

const playfulTransforms = {
  'alternating-case': (text) => perLine(text, (line) => {
    let letters = 0;
    return graphemes(line).map((grapheme) => /^[A-Za-z]$/.test(grapheme)
      ? (letters++ % 2 ? grapheme.toLowerCase() : grapheme.toUpperCase()) : grapheme).join('');
  }),
  spaced: (text) => perLine(text, (line) => {
    const parts = graphemes(line);
    return parts.map((part, index) => part + (parts[index + 1] && !/\s/u.test(part) && !/\s/u.test(parts[index + 1]) ? ' ' : '')).join('');
  }),
  reverse: (text) => perLine(text, (line) => graphemes(line).reverse().join('')),
  'upside-down': (text) => perLine(text, (line) => graphemes(line).reverse().map((part) => upsideDown.get(part) ?? part).join('')),
};

function freezeEntries(entries) {
  return Object.freeze(entries.map((entry) => Object.freeze(entry)));
}

export const STYLE_GROUPS = freezeEntries([
  { id: 'lettering', label: 'Lettering' },
  { id: 'enclosed', label: 'Enclosed' },
  { id: 'small', label: 'Small text' },
  { id: 'effects', label: 'Text effects' },
  { id: 'playful', label: 'Playful' },
]);

/** All UI metadata/functions are static; render user results with textContent. */
export const STYLES = freezeEntries([
  { id: 'bold', label: 'Bold', group: 'lettering', description: 'Bold Unicode letters and numbers.' },
  { id: 'italic', label: 'Italic', group: 'lettering', description: 'Italic Unicode letters; numbers stay plain.' },
  { id: 'bold-italic', label: 'Bold italic', group: 'lettering', description: 'Bold italic letters; numbers stay plain.' },
  { id: 'script', label: 'Script', group: 'lettering', description: 'Flowing script letters; numbers stay plain.' },
  { id: 'bold-script', label: 'Bold script', group: 'lettering', description: 'Heavier script letters; numbers stay plain.' },
  { id: 'fraktur', label: 'Fraktur', group: 'lettering', description: 'Blackletter-style letters; numbers stay plain.' },
  { id: 'double-struck', label: 'Double struck', group: 'lettering', description: 'Outlined Unicode letters and numbers.' },
  { id: 'monospace', label: 'Monospace', group: 'lettering', description: 'Monospace Unicode letters and numbers.' },
  { id: 'sans-bold', label: 'Sans bold', group: 'lettering', description: 'Sans-serif bold letters and numbers.' },
  { id: 'sans-italic', label: 'Sans italic', group: 'lettering', description: 'Sans-serif italic letters; numbers stay plain.' },
  { id: 'fullwidth', label: 'Fullwidth', group: 'lettering', description: 'Wide letters and numbers; punctuation and spaces stay unchanged.' },
  { id: 'circled', label: 'Circled', group: 'enclosed', description: 'Circled letters and single digits.' },
  { id: 'small-caps', label: 'Small caps', group: 'small', description: 'Phonetic small capitals; Q, q, X, x and numbers stay plain. Original case cannot be recovered.' },
  { id: 'superscript', label: 'Superscript', group: 'small', description: 'Raised lowercase letters and digits; q and uppercase stay plain.' },
  { id: 'strikethrough', label: 'Strikethrough', group: 'effects', description: 'A combining strike on plain or supported styled letters and digits.' },
  { id: 'underline', label: 'Underline', group: 'effects', description: 'A combining underline on plain or supported styled letters and digits.' },
  { id: 'bold-fraktur', label: 'Bold gothic', group: 'lettering', description: 'Heavy blackletter-style letters; numbers stay plain.' },
  { id: 'sans', label: 'Sans serif', group: 'lettering', description: 'Sans-serif Unicode letters and numbers.' },
  { id: 'sans-bold-italic', label: 'Sans bold italic', group: 'lettering', description: 'Sans-serif bold italic letters; numbers stay plain.' },
  { id: 'negative-circled', label: 'Black bubble', group: 'enclosed', description: 'Filled circles around uppercase letters and digits. Lowercase becomes uppercase; original case cannot be recovered.' },
  { id: 'squared', label: 'Squares', group: 'enclosed', description: 'Outlined squares around uppercase letters. Lowercase becomes uppercase; numbers stay plain and original case cannot be recovered.' },
  { id: 'negative-squared', label: 'Black squares', group: 'enclosed', description: 'Filled squares around uppercase letters. Lowercase becomes uppercase; numbers stay plain and original case cannot be recovered.' },
  { id: 'parenthesized', label: 'Parenthesized', group: 'enclosed', description: 'Parenthesized uppercase and lowercase letters and digits 1–9; zero stays plain.' },
  { id: 'subscript', label: 'Subscript', group: 'small', description: 'Lowered a, e, h, i, j, k, l, m, n, o, p, r, s, t, u, v, x and digits; other letters stay plain.' },
  { id: 'double-underline', label: 'Double underline', group: 'effects', description: 'Two combining lines below plain or supported styled letters and digits.' },
  { id: 'overline', label: 'Overline', group: 'effects', description: 'A combining line above plain or supported styled letters and digits.' },
  { id: 'dotted-underline', label: 'Dotted underline', group: 'effects', description: 'Two combining dots below each plain or supported styled letter and digit.' },
  { id: 'slash', label: 'Slash', group: 'effects', description: 'A combining diagonal slash through plain or supported styled letters and digits.' },
  { id: 'glitch-light', label: 'Light glitch', group: 'effects', description: 'Two fixed combining marks per supported letter or digit; accents and emoji stay intact.' },
  { id: 'glitch-heavy', label: 'Heavy glitch', group: 'effects', description: 'Six fixed combining marks per supported letter or digit; accents and emoji stay intact.' },
  { id: 'alternating-case', label: 'Alternating case', group: 'playful', description: 'Alternates ASCII letter case within each line. Original case cannot be recovered.' },
  { id: 'spaced', label: 'Spaced', group: 'playful', description: 'Adds spaces between neighboring graphemes; existing whitespace stays intact. Added spaces cannot be identified for removal.' },
  { id: 'reverse', label: 'Reverse', group: 'playful', description: 'Reverses whole graphemes within each line. Apply Reverse again to restore the order.' },
  { id: 'upside-down', label: 'Upside down', group: 'playful', description: 'Reverses each line with approximate turned lowercase Latin letters; uppercase, digits and l stay plain. Plain text cannot restore this layout.' },
].map((style) => ({
  ...style,
  transform: playfulTransforms[style.id] ?? (ownEffect(style.id) ? combiningTransform(style.id) : mapTransform(style.id)),
})));

function ownEffect(id) {
  return Object.hasOwn(marks, id) || id === 'glitch-light' || id === 'glitch-heavy';
}

const stylesById = new Map(STYLES.map((style) => [style.id, style]));

/** Unknown styles are an identity transform. No Unicode normalization. */
export function transformText(text, styleId) {
  return stylesById.get(styleId)?.transform(text) ?? String(text ?? '');
}

export const EFFECTS = freezeEntries([
  { id: 'none', label: 'None' },
  { id: 'underline', label: 'Underline' },
  { id: 'double-underline', label: 'Double underline' },
  { id: 'strikethrough', label: 'Strikethrough' },
  { id: 'overline', label: 'Overline' },
  { id: 'dotted-underline', label: 'Dotted underline' },
  { id: 'slash', label: 'Slash' },
  { id: 'glitch-light', label: 'Light glitch' },
]);

export const FRAMES = freezeEntries([
  { id: 'none', label: 'None', left: '', right: '' },
  { id: 'stars', label: 'Stars', left: '✦ ', right: ' ✦' },
  { id: 'hearts', label: 'Hearts', left: '♡ ', right: ' ♡' },
  { id: 'flowers', label: 'Flowers', left: '❀ ', right: ' ❀' },
  { id: 'brackets', label: 'Brackets', left: '【 ', right: ' 】' },
  { id: 'moon', label: 'Moon', left: '☾ ', right: ' ☽' },
  { id: 'plain', label: 'Plain dashes', left: '— ', right: ' —' },
  { id: 'sparkles', label: 'Sparkles', left: '✧･ﾟ ', right: ' ･ﾟ✧' },
  { id: 'star-cluster', label: 'Star cluster', left: '⋆｡°✩ ', right: ' ✩°｡⋆' },
  { id: 'corner', label: 'Corners', left: '⌜ ', right: ' ⌟' },
  { id: 'ornate', label: 'Ornate', left: '༺ ', right: ' ༻' },
  { id: 'music', label: 'Music', left: '♫ ', right: ' ♫' },
  { id: 'clouds', label: 'Clouds', left: '☁︎ ', right: ' ☁︎' },
]);

const effectsById = new Set(EFFECTS.map(({ id }) => id));
const framesById = new Map(FRAMES.map((frame) => [frame.id, frame]));

/** Compose base → effect → frame. Empty/whitespace-only lines keep their bytes. */
export function mixText(text, { styleId = 'plain', effectId = 'none', frameId = 'none' } = {}) {
  const frame = framesById.get(frameId) ?? framesById.get('none');
  return perLine(text, (line) => {
    if (!line.trim()) return line;
    const styled = transformText(line, styleId);
    const effected = effectsById.has(effectId) && effectId !== 'none' ? transformText(styled, effectId) : styled;
    return frame.left + effected + frame.right;
  });
}

/**
 * Decode curated assigned alphabets and remove our selected effect marks after
 * ASCII or mapped alphanumeric bases. Other accents/scripts are not normalized.
 * Small caps return lowercase; filled circles/squares return uppercase. This
 * cannot restore case, spacing, reverse/flip layouts or remove arbitrary frames.
 * A selected effect mark pasted as genuine notation (e.g. overline U+0305 or
 * diaeresis-below U+0324) is indistinguishable from an effect on the same base.
 */
export function plainText(text) {
  return graphemes(String(text ?? '')).map((grapheme) => {
    // Emoji sequences and keycaps are complete graphemes, not styled digits.
    if (/[\u200D\uFE0E\uFE0F\u20E3]/u.test(grapheme)) return grapheme;
    let supportedBase = false;
    let result = '';
    for (const character of grapheme) {
      if (MARK.test(character)) {
        if (!supportedBase || !ownMarks.has(character)) result += character;
        continue;
      }
      const plain = reverseMap.get(character) ?? character;
      supportedBase = ASCII_ALNUM.test(plain);
      result += plain;
    }
    return result;
  }).join('');
}
