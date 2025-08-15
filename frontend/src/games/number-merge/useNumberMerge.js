import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GRID_SIZE, createEmptyGrid, spawnRandom,
  slideLeft, slideRight, slideUp, slideDown,
  hasMoves, hasReachedTarget, cloneGrid
} from './engine';

const LS_GRID = 'nm_grid';
const LS_SCORE = 'nm_score';
const LS_BEST = 'nm_best';
const TARGET = 2048;
const LS_MAXTILE = 'nm_maxTile';

export function useNumberMerge() {
  const [grid, setGrid] = useState(() => createEmptyGrid());
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [target] = useState(TARGET);
  const [won, setWon] = useState(false);
  const [over, setOver] = useState(false);
  const [maxTile, setMaxTile] = useState(0);
  const prevRef = useRef(null); // {grid, score}

  useEffect(() => {
    try {
      const gRaw = localStorage.getItem(LS_GRID);
      const sRaw = localStorage.getItem(LS_SCORE);
      const bRaw = localStorage.getItem(LS_BEST);
      const mRaw = localStorage.getItem(LS_MAXTILE);
      let gValid = false;
      if (gRaw) {
        const g = JSON.parse(gRaw);
        if (Array.isArray(g) && g.length === GRID_SIZE && g.every(r => Array.isArray(r) && r.length === GRID_SIZE)) {
          setGrid(g); gValid = true;
        }
      }
      if (sRaw) setScore(Math.max(0, parseInt(sRaw, 10) || 0));
      if (bRaw) setBest(Math.max(0, parseInt(bRaw, 10) || 0));
      if (mRaw) setMaxTile(Math.max(0, parseInt(mRaw, 10) || 0));
      if (!gValid) {
        let g = createEmptyGrid();
        g = spawnRandom(spawnRandom(g));
        setGrid(g);
      }
    } catch (_) {
      let g = createEmptyGrid();
      g = spawnRandom(spawnRandom(g));
      setGrid(g);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_GRID, JSON.stringify(grid));
      localStorage.setItem(LS_SCORE, String(score));
      localStorage.setItem(LS_BEST, String(best));
      localStorage.setItem(LS_MAXTILE, String(maxTile));
    } catch (_) {}
  }, [grid, score, best, maxTile]);

  const applyMove = useCallback((dir) => {
    if (won || over) return;
    const slide = dir === 'left' ? slideLeft
      : dir === 'right' ? slideRight
      : dir === 'up' ? slideUp
      : dir === 'down' ? slideDown : null;
    if (!slide) return;
    const before = grid;
    const step = slide(before);
    if (!step.moved) return;
    prevRef.current = { grid: cloneGrid(before), score };
    let next = step.grid;
    next = spawnRandom(next);
    const nextScore = score + step.scoreGain;
    setGrid(next);
    setScore(nextScore);
    if (nextScore > best) setBest(nextScore);
    // track max tile and victory
    let currentMax = 0;
    for (const row of next) for (const v of row) if (v > currentMax) currentMax = v;
    if (currentMax > maxTile) setMaxTile(currentMax);
    if (hasReachedTarget(next, TARGET)) setWon(true);
    if (!hasMoves(next)) setOver(true);
  }, [grid, score, best, maxTile, won, over]);

  const undo = useCallback(() => {
    const prev = prevRef.current;
    if (!prev) return;
    setGrid(prev.grid);
    setScore(prev.score);
    setWon(false);
    setOver(false);
    prevRef.current = null;
  }, []);

  const restart = useCallback(() => {
    let g = createEmptyGrid();
    g = spawnRandom(spawnRandom(g));
    setGrid(g);
    setScore(0);
    setWon(false);
    setOver(false);
    setMaxTile(0);
    prevRef.current = null;
  }, []);

  return {
    grid, score, best, target, won, over, maxTile,
    applyMove, undo, restart,
  };
}
