export const BASE_SPEED = 44;

export function normalizeChar(ch) {
  if (ch == null) return '';
  return String(ch).toLowerCase();
}

export function isModifierKey(key) {
  return key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta';
}

export function codeToLatinChar(code) {
  if (typeof code !== 'string') return '';
  if (code === 'Space') return ' ';
  if (!code.startsWith('Key') || code.length !== 4) return '';
  return code.slice(3).toLowerCase();
}

export function resolveInputChar(evt, lang = 'en') {
  const key = normalizeChar(evt?.key);
  if (lang === 'en') {
    const byCode = codeToLatinChar(evt?.code);
    return byCode || key;
  }
  return key;
}

export function keysMatch(inputKey, expectedChar) {
  return normalizeChar(inputKey) === normalizeChar(expectedChar);
}

export function nextSpeed(round) {
  return BASE_SPEED + (round - 1) * 8;
}

export function calcAccuracy(hits, misses) {
  const total = hits + misses;
  if (total === 0) return 100;
  return Math.round((hits / total) * 100);
}

export function pickRandomPhrase(phrases, rng = Math.random, exclude = '') {
  if (!Array.isArray(phrases) || phrases.length === 0) return '';
  if (phrases.length === 1) return phrases[0];
  const picked = phrases[Math.floor(rng() * phrases.length)];
  if (!exclude || picked !== exclude) return picked;
  const alternatives = phrases.filter((p) => p !== exclude);
  return alternatives[Math.floor(rng() * alternatives.length)] || picked;
}

export function makeRoundState(phrases, round, rng = Math.random, prevPhrase = '') {
  return {
    phrase: pickRandomPhrase(phrases, rng, prevPhrase),
    aliveIndex: 0,
    y: 16,
    speed: nextSpeed(round),
  };
}
