import test from 'node:test';
import assert from 'node:assert/strict';
import { STYLES, STYLE_GROUPS, EFFECTS, FRAMES, transformText, plainText, mixText } from '../src/unicode.mjs';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const ORIGINAL_IDS = ['bold', 'italic', 'bold-italic', 'script', 'bold-script', 'fraktur', 'double-struck', 'monospace', 'sans-bold', 'sans-italic', 'fullwidth', 'circled', 'small-caps', 'superscript', 'strikethrough', 'underline'];
const COMPLETE_IDS = [...ORIGINAL_IDS.slice(0, 12), 'bold-fraktur', 'sans', 'sans-bold-italic'];
const PLAYFUL_IDS = ['alternating-case', 'spaced', 'reverse', 'upside-down'];
const EFFECT_IDS = ['strikethrough', 'underline', 'double-underline', 'overline', 'dotted-underline', 'slash', 'glitch-light', 'glitch-heavy'];

test('each complete alphabet uses assigned Unicode letters and reverses to the same ASCII characters', () => {
  for (const id of COMPLETE_IDS) {
    const output = transformText(ALPHABET, id);
    assert.equal(Array.from(output).length, 52, id);
    assert.ok(!/\p{Unassigned}|\p{Surrogate}/u.test(output), `${id} contains no Unicode holes`);
    assert.ok(/^[\p{Letter}\p{Symbol}]+$/u.test(output), `${id} consists of letters or circled symbols`);
    // Unicode's compatibility decomposition is an independent oracle for
    // complete alphabets, including Letterlike Symbols filling block holes.
    assert.equal(output.normalize('NFKC'), ALPHABET, `${id} preserves letter identity/case`);
    assert.equal(plainText(output), ALPHABET, `${id} reverses`);
  }
});

test('historic Unicode holes use their assigned Letterlike Symbol exceptions', () => {
  assert.equal(transformText('h', 'italic'), 'ℎ');
  assert.equal(transformText('BEFHILMRego', 'script'), 'ℬℰℱℋℐℒℳℛℯℊℴ');
  assert.equal(transformText('CHIRZ', 'fraktur'), 'ℭℌℑℜℨ');
  assert.equal(transformText('CHNPQRZ', 'double-struck'), 'ℂℍℕℙℚℝℤ');
});

test('styles with numbers preserve numeric identity, and letter-only styles retain original digits', () => {
  const numericStyles = new Set(['bold', 'double-struck', 'monospace', 'sans-bold', 'fullwidth', 'circled', 'superscript', 'sans', 'subscript']);
  for (const { id } of STYLES.filter(({ id }) => !PLAYFUL_IDS.includes(id) && !EFFECT_IDS.includes(id) && !['negative-circled', 'parenthesized'].includes(id))) {
    const output = transformText(DIGITS, id);
    if (numericStyles.has(id)) {
      assert.notEqual(output, DIGITS, id);
      assert.equal(output.normalize('NFKC'), DIGITS, id);
      assert.equal(plainText(output), DIGITS, id);
    } else {
      assert.equal(output, DIGITS, id);
    }
  }
  assert.equal(transformText(DIGITS, 'circled'), '⓪①②③④⑤⑥⑦⑧⑨');
});

test('alphabet and effect styles preserve whitespace, punctuation, precomposed accents and other scripts exactly', () => {
  const unsupported = ' \t\n\r\n.,!?-_()[]{}<>/&"\'@#%+*= éñö Æß 中文 العربية हिन्दी ΩЖ';
  for (const { id } of STYLES.filter(({ id }) => !PLAYFUL_IDS.includes(id))) assert.equal(transformText(unsupported, id), unsupported, id);
  assert.equal(transformText('A!\nB\t2.', 'bold'), '𝐀!\n𝐁\t𝟐.');
  assert.equal(transformText('<script>', 'fullwidth'), '<ｓｃｒｉｐｔ>');
});

test('surrogate pairs, emoji sequences and decomposed accented letters stay intact', () => {
  const unsupported = '😀 👨‍👩‍👧‍👦 🏳️‍🌈 👍🏽 1️⃣ 2⃣ a\u0301 e\u0308 Z\u0327 𐍈';
  for (const { id } of STYLES.filter(({ id }) => !PLAYFUL_IDS.includes(id))) assert.equal(transformText(unsupported, id), unsupported, id);
  const loneSurrogate = '\uD83D';
  assert.equal(transformText(loneSurrogate, 'bold'), loneSurrogate);
});

test('partial alphabets describe and preserve unsupported characters without lookalike substitutions', () => {
  assert.equal(transformText('Qq Xx 19', 'small-caps'), 'Qq Xx 19');
  assert.equal(transformText('AaqQ 12', 'superscript'), 'AᵃqQ ¹²');
  assert.equal(transformText('Abcdfgqwyz 012', 'subscript'), 'Abcdfgqwyz ₀₁₂');
  assert.equal(transformText('aehijklmnoprstuvx', 'subscript'), 'ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ');
  assert.equal(transformText('aehijklmnoprstuvx', 'subscript').normalize('NFKC'), 'aehijklmnoprstuvx');
  for (const id of ['small-caps', 'superscript', 'subscript']) {
    const output = transformText(ALPHABET + DIGITS, id);
    assert.ok(!/\p{Unassigned}|\p{Surrogate}/u.test(output));
    assert.match(STYLES.find((style) => style.id === id).description, /stay plain/);
  }
  assert.equal(plainText(transformText('AaBb Qq Xx', 'small-caps')), 'aabb Qq Xx');
});

test('combining styles preserve genuine accents and reverse their selected marks', () => {
  assert.equal(transformText('Ab 2!é😀', 'strikethrough'), 'A̶b̶ 2̶!é😀');
  assert.equal(transformText('Ab 2!é😀', 'underline'), 'A̲b̲ 2̲!é😀');
  for (const id of EFFECT_IDS) {
    const input = 'ABC abc 123\nÁ a\u0301 中文 1️⃣ 🐈';
    assert.equal(plainText(transformText(input, id)), input);
  }
  assert.equal(plainText('a\u0301\u0336 中\u0332 😀\u0336'), 'a\u0301 中\u0332 😀\u0336');
  assert.equal(plainText('a\u0301e\u0308t\u0323c\u0327a\u0304'), 'a\u0301e\u0308t\u0323c\u0327a\u0304');
  assert.equal(plainText('1️⃣\u0336 2⃣\u0332'), '1️⃣\u0336 2⃣\u0332');
});

test('plain conversion changes only curated glyphs, and public metadata is immutable', () => {
  const unrelated = 'é e\u0301 ñ 中 العربية हिन्दी ΩЖ 😀 1️⃣ ①';
  assert.equal(plainText(unrelated), unrelated.slice(0, -1) + '1');
  assert.equal(plainText('ℎℬℭℂ 𝐀 ⁹'), 'hBCC A 9');
  assert.equal(transformText('hello', 'unknown'), 'hello');
  assert.equal(transformText('', 'bold'), '');
  assert.equal(STYLES.length, 34);
  assert.deepEqual(STYLES.slice(0, 16).map(({ id }) => id), ORIGINAL_IDS);
  assert.equal(new Set(STYLES.map(({ id }) => id)).size, STYLES.length);
  assert.ok(Object.isFrozen(STYLES));
  assert.ok(STYLES.every((style) => Object.isFrozen(style) && typeof style.transform === 'function'));
});

test('new mathematical ranges match independently checked Unicode assignments', () => {
  // These literal specimens are independent of the range-building code.
  assert.equal(transformText('AaZz', 'bold-fraktur'), '𝕬𝖆𝖅𝖟');
  assert.equal(transformText('AaZz09', 'sans'), '𝖠𝖺𝖹𝗓𝟢𝟫');
  assert.equal(transformText('AaZz09', 'sans-bold-italic'), '𝘼𝙖𝙕𝙯09');
});

test('enclosed alphabets use the assigned letter/digit glyphs and disclose case loss', () => {
  assert.equal(transformText('AaZz09', 'negative-circled'), '🅐🅐🅩🅩⓿❾');
  assert.equal(transformText('AaZz09', 'squared'), '🄰🄰🅉🅉09');
  assert.equal(transformText('AaZz09', 'negative-squared'), '🅰🅰🆉🆉09');
  assert.equal(transformText('AaZz019', 'parenthesized'), '🄐⒜🄩⒵0⑴⑼');
  assert.equal(transformText(DIGITS, 'negative-circled'), '⓿❶❷❸❹❺❻❼❽❾');
  assert.equal(transformText(DIGITS, 'parenthesized'), '0⑴⑵⑶⑷⑸⑹⑺⑻⑼');
  for (const id of ['negative-circled', 'squared', 'negative-squared']) {
    const output = transformText(ALPHABET + DIGITS, id);
    assert.ok(!/\p{Unassigned}|\p{Surrogate}/u.test(output), id);
    assert.equal(plainText(output), ALPHABET.toUpperCase() + DIGITS, id);
    assert.match(STYLES.find((style) => style.id === id).description, /Lowercase becomes uppercase/);
  }
  const parenthesized = transformText(ALPHABET, 'parenthesized');
  assert.equal(parenthesized.normalize('NFKC'), Array.from(ALPHABET, (letter) => `(${letter})`).join(''));
  assert.equal(plainText(parenthesized), ALPHABET);
  assert.equal(plainText(transformText(DIGITS, 'parenthesized')), DIGITS);
});

test('novelty alphabets never fill gaps with Greek or Cyrillic lookalikes', () => {
  for (const { id } of STYLES) {
    const output = transformText(ALPHABET + DIGITS, id);
    assert.ok(!/\p{Script=Greek}|\p{Script=Cyrillic}|\p{Script=Hebrew}/u.test(output), id);
  }
});

test('every style preserves exact line separators, including empty lines', () => {
  const source = 'Ab\r\n\r\ncd\n\nef\rg\u2028hi\u2029';
  const separators = source.match(/\r\n|[\r\n\u2028\u2029]/g);
  for (const { id } of STYLES) {
    assert.deepEqual(transformText(source, id).match(/\r\n|[\r\n\u2028\u2029]/g), separators, id);
    assert.equal(transformText('\r\n\n\r\u2028\u2029', id), '\r\n\n\r\u2028\u2029', id);
  }
});

test('playful layouts operate on whole graphemes within each line', () => {
  const family = '👨‍👩‍👧‍👦';
  const source = `a\u0301${family}1️⃣\nxy`;
  assert.equal(transformText(source, 'reverse'), `1️⃣${family}a\u0301\nyx`);
  assert.equal(transformText(transformText(source, 'reverse'), 'reverse'), source);
  assert.equal(transformText(source, 'spaced'), `a\u0301 ${family} 1️⃣\nx y`);
  assert.equal(transformText('ab  cd\tef', 'spaced'), 'a b  c d\te f');
  assert.equal(transformText('abcd\nEFgh', 'alternating-case'), 'AbCd\nEfGh');
  assert.equal(transformText('a\u0301b2😀cd', 'alternating-case'), 'a\u0301B2😀cD');
  assert.equal(transformText('abcd\nA19l', 'upside-down'), 'pɔqɐ\nl91A');
  assert.equal(transformText(source, 'upside-down'), `1️⃣${family}a\u0301\nʎx`);
  // A flag pair and emoji modifiers also survive intentionally reordered text.
  assert.equal(transformText('🇺🇸👍🏽é', 'reverse'), 'é👍🏽🇺🇸');
  assert.equal(transformText('🇺🇸👍🏽é', 'spaced'), '🇺🇸 👍🏽 é');
});

test('new combining specimens are exact, and effects layer on curated alphabets', () => {
  assert.equal(transformText('Ab 2!é😀', 'double-underline'), 'A\u0333b\u0333 2\u0333!é😀');
  assert.equal(transformText('Ab 2!é😀', 'overline'), 'A\u0305b\u0305 2\u0305!é😀');
  assert.equal(transformText('Ab 2!é😀', 'dotted-underline'), 'A\u0324b\u0324 2\u0324!é😀');
  assert.equal(transformText('Ab 2!é😀', 'slash'), 'A\u0338b\u0338 2\u0338!é😀');
  assert.equal(transformText('𝐀𝖺❶🄩!é', 'underline'), '𝐀\u0332𝖺\u0332❶\u0332🄩\u0332!é');
  assert.equal(transformText('A\u0332', 'strikethrough'), 'A\u0332\u0336');
  assert.equal(transformText('A\u0332', 'underline'), 'A\u0332');
  assert.equal(transformText('𝐀\u0301', 'underline'), '𝐀\u0301');
  assert.equal(plainText('𝐀\u0301\u0338'), 'A\u0301');
});

test('glitch output is deterministic, recoverable, bounded and idempotent', () => {
  const input = 'A1 b\nZé e\u0301😀1️⃣';
  for (const [id, extra] of [['glitch-light', 2], ['glitch-heavy', 6]]) {
    const output = transformText(input, id);
    assert.equal(transformText(input, id), output, id);
    assert.equal(transformText(output, id), output, id);
    assert.equal(plainText(output), input, id);
    assert.equal(Array.from(output).length, Array.from(input).length + 4 * extra, id);
    const largeInput = 'a'.repeat(500);
    const largeOutput = transformText(largeInput, id);
    assert.equal(Array.from(largeOutput).length, 500 * (extra + 1), id);
    assert.equal(plainText(largeOutput), largeInput, id);
  }
  assert.equal(transformText('A', 'glitch-light'), 'A\u0350\u0355');
  assert.equal(transformText('A', 'glitch-heavy'), 'A\u0350\u035B\u0352\u0355\u034E\u0353');
});

test('mixer applies base, effect, then each nonempty line frame', () => {
  assert.equal(mixText('Ab 2!\né😀', { styleId: 'bold', effectId: 'underline', frameId: 'stars' }), '✦ 𝐀\u0332𝐛\u0332 𝟐\u0332! ✦\n✦ é😀 ✦');
  assert.equal(mixText('ab\r\n\r\n \t\ncd\n', { styleId: 'sans', effectId: 'slash', frameId: 'hearts' }), '♡ 𝖺\u0338𝖻\u0338 ♡\r\n\r\n \t\n♡ 𝖼\u0338𝖽\u0338 ♡\n');
  assert.equal(mixText('a\u0301😀1️⃣', { styleId: 'bold', effectId: 'overline', frameId: 'brackets' }), '【 a\u0301😀1️⃣ 】');
  assert.equal(mixText('ab\ncd', { styleId: 'reverse', effectId: 'strikethrough', frameId: 'corner' }), '⌜ b\u0336a\u0336 ⌟\n⌜ d\u0336c\u0336 ⌟');
  assert.equal(mixText('hello'), 'hello');
  assert.equal(mixText('hello', { styleId: 'unknown', effectId: 'unknown', frameId: 'unknown' }), 'hello');
  assert.equal(mixText('<script>', { frameId: 'stars' }), '✦ <script> ✦');
});

test('mixer combinations preserve emoji, accents, line breaks and blank input', () => {
  for (const styleId of ['plain', ...STYLES.map(({ id }) => id)]) {
    for (const { id: effectId } of EFFECTS) {
      for (const { id: frameId } of FRAMES) {
        const options = { styleId, effectId, frameId };
        const key = `${styleId}/${effectId}/${frameId}`;
        assert.equal(mixText('', options), '', key);
        assert.equal(mixText(null, options), '', key);
        assert.equal(mixText('\n \t\r\n', options), '\n \t\r\n', key);
        // Each is a whole protected grapheme, even when layouts reorder them.
        const output = mixText('a\u0301😀1️⃣\n\n', options);
        assert.ok(output.includes('a\u0301') && output.includes('😀') && output.includes('1️⃣'), key);
        assert.ok(output.endsWith('\n\n'), key);
      }
    }
  }
});

test('all frames use static paired strings and preserve existing decorations', () => {
  const existing = {
    stars: ['✦ ', ' ✦'], hearts: ['♡ ', ' ♡'], flowers: ['❀ ', ' ❀'],
    brackets: ['【 ', ' 】'], moon: ['☾ ', ' ☽'], plain: ['— ', ' —'],
  };
  for (const [id, [left, right]] of Object.entries(existing)) {
    assert.equal(mixText('hello', { frameId: id }), left + 'hello' + right, id);
  }
  for (const { id, left, right } of FRAMES) assert.equal(mixText('hello', { frameId: id }), left + 'hello' + right, id);
  assert.equal(FRAMES.length, 13);
  assert.equal(EFFECTS.length, 8);
});

test('plain conversion reports lossy layout behavior without guessing original text', () => {
  assert.equal(plainText(transformText('ab cd', 'spaced')), 'a b c d');
  assert.equal(plainText(transformText('ab CD', 'alternating-case')), 'Ab Cd');
  assert.equal(plainText(transformText('abc', 'reverse')), 'cba');
  assert.equal(plainText(transformText('ab', 'upside-down')), 'qɐ');
  assert.equal(plainText(mixText('Ab', { styleId: 'bold', effectId: 'slash', frameId: 'stars' })), '✦ Ab ✦');
  assert.equal(plainText('Ω\u0305 中\u0324 é\u0338'), 'Ω\u0305 中\u0324 é\u0338');
  // The chosen effect code points cannot carry provenance when pasted. These
  // exact marks on ASCII are removed; unrelated accents above remain untouched.
  assert.equal(plainText('A\u0305u\u0324'), 'Au');
});

test('public metadata is frozen, uniquely keyed and fully grouped', () => {
  assert.deepEqual(STYLE_GROUPS.map(({ id }) => id), ['lettering', 'enclosed', 'small', 'effects', 'playful']);
  for (const entries of [STYLES, STYLE_GROUPS, EFFECTS, FRAMES]) {
    assert.ok(Object.isFrozen(entries));
    assert.ok(entries.every(Object.isFrozen));
    assert.equal(new Set(entries.map(({ id }) => id)).size, entries.length);
    assert.throws(() => { entries[0].label = 'Changed'; }, TypeError);
    assert.throws(() => { entries.push({ id: 'extra' }); }, TypeError);
  }
  const groups = new Set(STYLE_GROUPS.map(({ id }) => id));
  assert.ok(STYLES.every(({ group, description, transform }) => groups.has(group) && description && typeof transform === 'function'));
  for (const { id } of STYLES) {
    assert.equal(transformText('', id), '', id);
    assert.equal(transformText(null, id), '', id);
    assert.equal(transformText(undefined, id), '', id);
  }
  assert.equal(plainText(null), '');
  assert.equal(transformText(123, 'unknown'), '123');
});
