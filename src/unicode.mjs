/**
 * Local, DOM-independent text transforms. Unicode mappings checked against:
 * https://www.unicode.org/Public/UCD/latest/ucd/UnicodeData.txt (2026-10-01).
 * Only ASCII letters and supported ASCII digits are converted. Punctuation,
 * whitespace, accented graphemes, non-Latin text, and emoji remain intact.
 * These characters are Unicode symbols, not font files or HTML.
 */
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const MARK = /\p{Mark}/u;
const ASCII_ALNUM = /^[A-Za-z0-9]$/;
const STRIKE = '\u0336';
const UNDERLINE = '\u0332';

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
};

// Use established phonetic small capitals. Q/q and X/x are deliberately left
// unchanged instead of substituting Greek/Cyrillic lookalikes or newer glyphs.
const smallCaps = Array.from('ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘqʀꜱᴛᴜᴠᴡxʏᴢ');
maps['small-caps'] = new Map();
Array.from(LOWER).forEach((letter, index) => {
  if (letter === 'q' || letter === 'x') return;
  maps['small-caps'].set(letter.toUpperCase(), smallCaps[index]);
  maps['small-caps'].set(letter, smallCaps[index]);
});

// This conservative BMP set keeps uppercase and q unchanged. Do not replace q
// with a raised Cyrillic letter or substitute a different phonetic sound.
maps.superscript = new Map();
Array.from('ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖqʳˢᵗᵘᵛʷˣʸᶻ').forEach((glyph, index) => {
  const letter = LOWER[index];
  if (letter !== 'q') maps.superscript.set(letter, glyph);
});
Array.from('⁰¹²³⁴⁵⁶⁷⁸⁹').forEach((glyph, index) => maps.superscript.set(DIGITS[index], glyph));

function convert(text, transformCharacter) {
  const characters = Array.from(String(text ?? ''));
  return characters.map((character, index) => {
    // Avoid splitting decomposed accented letters and ASCII-based emoji such
    // as 1 + VARIATION SELECTOR-16 + COMBINING ENCLOSING KEYCAP.
    const next = characters[index + 1];
    if (next && (MARK.test(next) || next === '\u200D')) return character;
    return transformCharacter(character);
  }).join('');
}

function mapTransform(id) {
  return (text) => convert(text, (character) => maps[id].get(character) ?? character);
}

function combiningTransform(mark) {
  return (text) => convert(text, (character) => ASCII_ALNUM.test(character) ? character + mark : character);
}

/** All UI metadata and functions are static; render user results with textContent. */
export const STYLES = Object.freeze([
  { id: 'bold', label: 'Bold', description: 'Bold Unicode letters and numbers.' },
  { id: 'italic', label: 'Italic', description: 'Italic Unicode letters; numbers stay plain.' },
  { id: 'bold-italic', label: 'Bold italic', description: 'Bold italic letters; numbers stay plain.' },
  { id: 'script', label: 'Script', description: 'Flowing script letters; numbers stay plain.' },
  { id: 'bold-script', label: 'Bold script', description: 'Heavier script letters; numbers stay plain.' },
  { id: 'fraktur', label: 'Fraktur', description: 'Blackletter-style letters; numbers stay plain.' },
  { id: 'double-struck', label: 'Double struck', description: 'Outlined Unicode letters and numbers.' },
  { id: 'monospace', label: 'Monospace', description: 'Monospace Unicode letters and numbers.' },
  { id: 'sans-bold', label: 'Sans bold', description: 'Sans-serif bold letters and numbers.' },
  { id: 'sans-italic', label: 'Sans italic', description: 'Sans-serif italic letters; numbers stay plain.' },
  { id: 'fullwidth', label: 'Fullwidth', description: 'Wide letters and numbers; punctuation and spaces stay unchanged.' },
  { id: 'circled', label: 'Circled', description: 'Circled letters and single digits.' },
  { id: 'small-caps', label: 'Small caps', description: 'Phonetic small capitals; Q, q, X, x and numbers stay plain.' },
  { id: 'superscript', label: 'Superscript', description: 'Raised lowercase letters and digits; q and uppercase stay plain.' },
  { id: 'strikethrough', label: 'Strikethrough', description: 'A combining strike on ASCII letters and digits only.' },
  { id: 'underline', label: 'Underline', description: 'A combining underline on ASCII letters and digits only.' },
].map((style) => Object.freeze({
  ...style,
  transform: style.id === 'strikethrough' ? combiningTransform(STRIKE)
    : style.id === 'underline' ? combiningTransform(UNDERLINE) : mapTransform(style.id),
})));

const stylesById = new Map(STYLES.map((style) => [style.id, style]));

/** Unknown styles are a harmless identity transform. No Unicode normalization. */
export function transformText(text, styleId) {
  return stylesById.get(styleId)?.transform(text) ?? String(text ?? '');
}

const reverseMap = new Map();
for (const map of Object.values(maps)) {
  for (const [ascii, glyph] of map) reverseMap.set(glyph, ascii);
}
// Small caps merge upper/lower case. The map insertion order chooses lowercase.

/**
 * Reverse this module's assigned glyphs without normalizing unrelated text.
 * Small caps cannot recover original case and return lowercase. Remove only
 * our two style marks following an ASCII or known stylized alphanumeric base;
 * preserve all other combining marks and marks attached to unrelated scripts.
 */
export function plainText(text) {
  let supportedBase = false;
  let result = '';
  for (const character of String(text ?? '')) {
    if (MARK.test(character)) {
      if (supportedBase && (character === STRIKE || character === UNDERLINE)) continue;
      result += character;
      continue;
    }
    const plain = reverseMap.get(character) ?? character;
    supportedBase = ASCII_ALNUM.test(plain);
    result += plain;
  }
  return result;
}
