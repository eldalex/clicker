import { describe, expect, it } from 'vitest';
import {
  calcAccuracy,
  codeToLatinChar,
  isModifierKey,
  keysMatch,
  makeRoundState,
  nextSpeed,
  pickRandomPhrase,
  resolveInputChar,
} from './engine';

describe('keyboard invaders engine', () => {
  it('matches keys case-insensitive', () => {
    expect(keysMatch('A', 'a')).toBe(true);
    expect(keysMatch('ф', 'Ф')).toBe(true);
    expect(keysMatch('a', 'b')).toBe(false);
  });

  it('detects modifier keys', () => {
    expect(isModifierKey('Shift')).toBe(true);
    expect(isModifierKey('a')).toBe(false);
  });

  it('maps keyboard code for english layout fallback', () => {
    expect(codeToLatinChar('KeyA')).toBe('a');
    expect(codeToLatinChar('Space')).toBe(' ');
  });

  it('resolves input by code in EN mode', () => {
    const ch = resolveInputChar({ key: 'ф', code: 'KeyA' }, 'en');
    expect(ch).toBe('a');
  });

  it('calculates round speed growth', () => {
    expect(nextSpeed(3)).toBeGreaterThan(nextSpeed(1));
  });

  it('picks phrase from list', () => {
    const p = pickRandomPhrase(['alpha', 'beta'], () => 0);
    expect(p).toBe('alpha');
  });

  it('avoids immediate phrase repeat when possible', () => {
    const p = pickRandomPhrase(['alpha', 'beta'], () => 0, 'alpha');
    expect(p).toBe('beta');
  });

  it('creates round state with defaults', () => {
    const st = makeRoundState(['alpha'], 2, () => 0);
    expect(st.phrase).toBe('alpha');
    expect(st.aliveIndex).toBe(0);
    expect(st.y).toBe(16);
    expect(st.speed).toBeGreaterThan(44);
  });

  it('calculates accuracy', () => {
    expect(calcAccuracy(9, 1)).toBe(90);
    expect(calcAccuracy(0, 0)).toBe(100);
  });
});
