import test from 'node:test';
import assert from 'node:assert/strict';
import { STYLES, transformText, plainText } from '../src/unicode.mjs';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';

test('each complete alphabet uses assigned Unicode letters and reverses to the same ASCII characters', () => {
  const completeStyles = STYLES.filter(({ id }) => !['small-caps', 'superscript', 'strikethrough', 'underline'].includes(id));
  assert.equal(completeStyles.length, 12);
  for (const style of completeStyles) {
    const output = transformText(ALPHABET, style.id);
    assert.equal(Array.from(output).length, 52, style.id);
    assert.ok(!/\p{Unassigned}|\p{Surrogate}/u.test(output), `${style.id} contains no Unicode holes`);
    assert.ok(/^[\p{Letter}\p{Symbol}]+$/u.test(output), `${style.id} consists of letters or circled symbols`);
    // Unicode's compatibility decomposition is an independent oracle for
    // complete alphabets, including Letterlike Symbols filling block holes.
    assert.equal(output.normalize('NFKC'), ALPHABET, `${style.id} preserves letter identity/case`);
    assert.equal(plainText(output), ALPHABET, `${style.id} reverses`);
  }
});

test('historic Unicode holes use their assigned Letterlike Symbol exceptions', () => {
  assert.equal(transformText('h', 'italic'), 'ℎ');
  assert.equal(transformText('BEFHILMRego', 'script'), 'ℬℰℱℋℐℒℳℛℯℊℴ');
  assert.equal(transformText('CHIRZ', 'fraktur'), 'ℭℌℑℜℨ');
  assert.equal(transformText('CHNPQRZ', 'double-struck'), 'ℂℍℕℙℚℝℤ');
});

test('styles with numbers preserve numeric identity, and letter-only styles retain original digits', () => {
  const numericStyles = new Set(['bold', 'double-struck', 'monospace', 'sans-bold', 'fullwidth', 'circled', 'superscript']);
  for (const { id } of STYLES) {
    const output = transformText(DIGITS, id);
    if (numericStyles.has(id)) {
      assert.notEqual(output, DIGITS, id);
      assert.equal(output.normalize('NFKC'), DIGITS, id);
      assert.equal(plainText(output), DIGITS, id);
    } else if (!['strikethrough', 'underline'].includes(id)) {
      assert.equal(output, DIGITS, id);
    }
  }
  assert.equal(transformText(DIGITS, 'circled'), '⓪①②③④⑤⑥⑦⑧⑨');
});

test('all styles preserve whitespace, punctuation, precomposed accents and other scripts exactly', () => {
  const unsupported = ' \t\n\r\n.,!?-_()[]{}<>/&"\'@#%+*= éñö Æß 中文 العربية हिन्दी ΩЖ';
  for (const { id } of STYLES) assert.equal(transformText(unsupported, id), unsupported, id);
  assert.equal(transformText('A!\nB\t2.', 'bold'), '𝐀!\n𝐁\t𝟐.');
  assert.equal(transformText('<script>', 'fullwidth'), '<ｓｃｒｉｐｔ>');
});

test('surrogate pairs, emoji sequences and decomposed accented letters stay intact', () => {
  const unsupported = '😀 👨‍👩‍👧‍👦 🏳️‍🌈 👍🏽 1️⃣ 2⃣ a\u0301 e\u0308 Z\u0327 𐍈';
  for (const { id } of STYLES) assert.equal(transformText(unsupported, id), unsupported, id);
  const loneSurrogate = '\uD83D';
  assert.equal(transformText(loneSurrogate, 'bold'), loneSurrogate);
});

test('partial alphabets describe and preserve unsupported characters without lookalike substitutions', () => {
  assert.equal(transformText('Qq Xx 19', 'small-caps'), 'Qq Xx 19');
  assert.equal(transformText('AaqQ 12', 'superscript'), 'AᵃqQ ¹²');
  for (const id of ['small-caps', 'superscript']) {
    const output = transformText(ALPHABET + DIGITS, id);
    assert.ok(!/\p{Unassigned}|\p{Surrogate}/u.test(output));
    assert.match(STYLES.find((style) => style.id === id).description, /stay plain/);
  }
  assert.equal(plainText(transformText('AaBb Qq Xx', 'small-caps')), 'aabb Qq Xx');
});

test('combining styles apply only to ASCII letters/digits and reverse without removing genuine accents', () => {
  assert.equal(transformText('Ab 2!é😀', 'strikethrough'), 'A̶b̶ 2̶!é😀');
  assert.equal(transformText('Ab 2!é😀', 'underline'), 'A̲b̲ 2̲!é😀');
  for (const id of ['strikethrough', 'underline']) {
    const input = 'ABC abc 123\nÁ a\u0301 中文 1️⃣ 🐈';
    assert.equal(plainText(transformText(input, id)), input);
  }
  assert.equal(plainText('a\u0301\u0336 中\u0332 😀\u0336'), 'a\u0301 中\u0332 😀\u0336');
});

test('plain conversion changes only curated glyphs, and public metadata is immutable', () => {
  const unrelated = 'é e\u0301 ñ 中 العربية हिन्दी ΩЖ 😀 1️⃣ ①';
  assert.equal(plainText(unrelated), unrelated.slice(0, -1) + '1');
  assert.equal(plainText('ℎℬℭℂ 𝐀 ⁹'), 'hBCC A 9');
  assert.equal(transformText('hello', 'unknown'), 'hello');
  assert.equal(transformText('', 'bold'), '');
  assert.equal(STYLES.length, 16);
  assert.equal(new Set(STYLES.map(({ id }) => id)).size, STYLES.length);
  assert.ok(Object.isFrozen(STYLES));
  assert.ok(STYLES.every((style) => Object.isFrozen(style) && typeof style.transform === 'function'));
});
