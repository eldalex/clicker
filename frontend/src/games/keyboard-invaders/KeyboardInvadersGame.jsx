import React, { useEffect, useMemo, useRef, useState } from 'react';
import './keyboard-invaders.css';
import { EN_PHRASES, RU_PHRASES } from './phrases';
import {
  calcAccuracy,
  isModifierKey,
  keysMatch,
  makeRoundState,
  nextSpeed,
  resolveInputChar,
} from './engine';

const GAME_HEIGHT = 320;
const LOSS_LINE = 272;
const BASE_ROUND_SPEED = 44;
const TEMPO_PRESETS = {
  beginner: 10 / BASE_ROUND_SPEED,
  very_slow: 19 / BASE_ROUND_SPEED,
  slow: 0.6,
  normal: 0.8,
  fast: 1,
};

export default function KeyboardInvadersGame() {
  const [lang, setLang] = useState('en');
  const [tempo, setTempo] = useState('slow');
  const speedFactor = TEMPO_PRESETS[tempo] ?? TEMPO_PRESETS.slow;
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [aliveIndex, setAliveIndex] = useState(0);
  const [y, setY] = useState(16);
  const [speed, setSpeed] = useState(44);
  const [gunFlash, setGunFlash] = useState(false);
  const [letterFlashIndex, setLetterFlashIndex] = useState(-1);

  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const startedRef = useRef(started);
  const pausedRef = useRef(paused);
  const gameOverRef = useRef(gameOver);
  const phraseRef = useRef(phrase);
  const aliveIndexRef = useRef(aliveIndex);
  const roundRef = useRef(round);
  const langRef = useRef(lang);

  useEffect(() => { startedRef.current = started; }, [started]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);
  useEffect(() => { phraseRef.current = phrase; }, [phrase]);
  useEffect(() => { aliveIndexRef.current = aliveIndex; }, [aliveIndex]);
  useEffect(() => { roundRef.current = round; }, [round]);
  useEffect(() => { langRef.current = lang; }, [lang]);

  const phrases = useMemo(() => (lang === 'ru' ? RU_PHRASES : EN_PHRASES), [lang]);

  const resetGame = (nextRound = 1) => {
    const st = makeRoundState(phrases, nextRound);
    roundRef.current = nextRound;
    phraseRef.current = st.phrase;
    aliveIndexRef.current = st.aliveIndex;
    setRound(nextRound);
    setScore(0);
    setHits(0);
    setMisses(0);
    setGameOver(false);
    setPaused(false);
    setPhrase(st.phrase);
    setAliveIndex(st.aliveIndex);
    setY(st.y);
    setSpeed(st.speed * speedFactor);
    setLetterFlashIndex(-1);
  };

  const prepareNextRound = (nextRound) => {
    const st = makeRoundState(phrases, nextRound, Math.random, phraseRef.current);
    roundRef.current = nextRound;
    phraseRef.current = st.phrase;
    aliveIndexRef.current = st.aliveIndex;
    setRound(nextRound);
    setPhrase(st.phrase);
    setAliveIndex(st.aliveIndex);
    setY(st.y);
    setSpeed(st.speed * speedFactor);
    setLetterFlashIndex(-1);
  };

  useEffect(() => {
    if (!started) return;
    resetGame(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  useEffect(() => {
    if (!started) return;
    setSpeed(nextSpeed(round) * speedFactor);
  }, [speedFactor, started, round]);

  useEffect(() => {
    if (!started || paused || gameOver) return;

    const loop = (ts) => {
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      setY((prev) => {
        const next = prev + speed * dt;
        if (next >= LOSS_LINE && aliveIndex < phrase.length) {
          setGameOver(true);
          return LOSS_LINE;
        }
        return next;
      });

      rafRef.current = window.requestAnimationFrame(loop);
    };

    rafRef.current = window.requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      lastTsRef.current = 0;
    };
  }, [started, paused, gameOver, speed, aliveIndex, phrase.length]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!startedRef.current || gameOverRef.current) return;

      if (e.key === 'Escape') {
        setPaused((v) => !v);
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (pausedRef.current) return;
      if (isModifierKey(e.key)) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const currentPhrase = phraseRef.current || '';
      const currentIndex = aliveIndexRef.current;
      if (!currentPhrase || currentIndex >= currentPhrase.length) return;

      const expected = currentPhrase[currentIndex];
      const typed = resolveInputChar(e, langRef.current);
      if (keysMatch(typed, expected)) {
        e.preventDefault();
        e.stopPropagation();
        setGunFlash(true);
        setLetterFlashIndex(currentIndex);
        setScore((v) => v + 1);
        setHits((v) => v + 1);

        window.setTimeout(() => setGunFlash(false), 120);
        const next = currentIndex + 1;
        if (next >= currentPhrase.length) {
          prepareNextRound(roundRef.current + 1);
          aliveIndexRef.current = 0;
          setLetterFlashIndex(-1);
        } else {
          aliveIndexRef.current = next;
          setAliveIndex(next);
          window.setTimeout(() => setLetterFlashIndex(-1), 100);
        }
      } else {
        e.preventDefault();
        e.stopPropagation();
        setMisses((v) => v + 1);
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    document.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      document.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, []);

  const onStart = () => {
    if (!started) {
      resetGame(1);
      setStarted(true);
      return;
    }
    if (gameOver) {
      resetGame(1);
      setStarted(true);
      return;
    }
    setPaused(false);
  };

  const onRestart = () => {
    resetGame(1);
    setStarted(true);
  };

  const accuracy = calcAccuracy(hits, misses);

  return (
    <div className="ki-wrap">
      <h2>Keyboard Invaders</h2>

      <div className="ki-toolbar">
        <label htmlFor="lang">Фразы:</label>
        <select
          id="lang"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
        >
          <option value="en">EN</option>
          <option value="ru">RU</option>
        </select>
        <label htmlFor="tempo">Темп:</label>
        <select
          id="tempo"
          value={tempo}
          onChange={(e) => setTempo(e.target.value)}
        >
          <option value="beginner">Я первый раз за клавиатурой (10 px/s)</option>
          <option value="very_slow">Очень медленно (19 px/s)</option>
          <option value="slow">Медленно</option>
          <option value="normal">Нормально</option>
          <option value="fast">Быстро</option>
        </select>
      </div>

      <div className="ki-panel">
        <div>Score: {score}</div>
        <div>Round: {round}</div>
        <div>Misses: {misses}</div>
        <div>Accuracy: {accuracy}%</div>
        <div>Speed: {Math.round(speed)} px/s</div>
      </div>

      <div className="ki-actions">
        <button onClick={onStart}>Start</button>
        <button onClick={onRestart}>Restart</button>
      </div>

      <div className="ki-hint">
        Печатай первую живую букву слева направо. Пауза: Esc. Пробел учитывается как символ.
      </div>

      <div className="ki-game" style={{ height: `${GAME_HEIGHT}px` }}>
        <div className={`ki-gun ${gunFlash ? 'flash' : ''}`} />
        <div className="ki-loss-line" />

        <div className="ki-phrase" style={{ transform: `translateY(${y}px)` }}>
          {phrase.split('').map((ch, i) => {
            const dead = i < aliveIndex;
            const active = i === aliveIndex;
            const flash = i === letterFlashIndex;
            return (
              <span
                key={`${ch}-${i}-${round}`}
                className={`ki-char${dead ? ' dead' : ''}${active ? ' active' : ''}${flash ? ' flash' : ''}`}
              >
                {ch === ' ' ? '\u00A0' : ch}
              </span>
            );
          })}
        </div>

        {!started && <div className="ki-overlay">Нажми Start</div>}
        {started && paused && !gameOver && <div className="ki-overlay">Пауза</div>}
        {gameOver && <div className="ki-overlay">Game Over</div>}
      </div>
    </div>
  );
}
