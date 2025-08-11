// frontend/src/Match3.jsx
import React, { useEffect, useMemo, useState } from 'react';

const ROWS = 8;
const COLS = 8;
const COLORS = ['#e57373', '#64b5f6', '#81c784', '#ffb74d', '#ba68c8', '#4dd0e1'];

const randGem = () => Math.floor(Math.random() * COLORS.length);

const inBounds = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;

function generateInitialGrid() {
  // Generate without immediate matches to start
  const grid = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, randGem));
  const hasRuns = () => findMatches(grid).size > 0;
  let attempts = 0;
  while (hasRuns() && attempts < 100) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        grid[r][c] = randGem();
      }
    }
    attempts++;
  }
  return grid;
}

function cloneGrid(grid) {
  return grid.map(row => row.slice());
}

function findMatches(grid) {
  const toClear = new Set(); // store key as `${r},${c}`
  // Rows
  for (let r = 0; r < ROWS; r++) {
    let runStart = 0;
    for (let c = 1; c <= COLS; c++) {
      if (c === COLS || grid[r][c] !== grid[r][runStart]) {
        const runLen = c - runStart;
        if (grid[r][runStart] != null && runLen >= 3) {
          for (let k = runStart; k < c; k++) toClear.add(`${r},${k}`);
        }
        runStart = c;
      }
    }
  }
  // Cols
  for (let c = 0; c < COLS; c++) {
    let runStart = 0;
    for (let r = 1; r <= ROWS; r++) {
      if (r === ROWS || grid[r][c] !== grid[runStart][c]) {
        const runLen = r - runStart;
        if (grid[runStart][c] != null && runLen >= 3) {
          for (let k = runStart; k < r; k++) toClear.add(`${k},${c}`);
        }
        runStart = r;
      }
    }
  }
  return toClear;
}

function collapseAndRefill(grid) {
  for (let c = 0; c < COLS; c++) {
    const col = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r][c] != null) col.push(grid[r][c]);
    }
    for (let r = ROWS - 1; r >= 0; r--) {
      grid[r][c] = col[ROWS - 1 - r] ?? null;
    }
    for (let r = 0; r < ROWS; r++) {
      if (grid[r][c] == null) grid[r][c] = randGem();
    }
  }
}

export default function Match3() {
  const [grid, setGrid] = useState(() => generateInitialGrid());
  const [selected, setSelected] = useState(null); // {r,c}
  const [score, setScore] = useState(0);
  const [busy, setBusy] = useState(false);

  const keyOf = (r, c) => `${r},${c}`;

  const tryResolve = async (g) => {
    // Resolve cascades synchronously without animations for simplicity
    let totalCleared = 0;
    while (true) {
      const matches = findMatches(g);
      if (matches.size === 0) break;
      matches.forEach(k => {
        const [r, c] = k.split(',').map(Number);
        g[r][c] = null;
      });
      totalCleared += matches.size;
      collapseAndRefill(g);
    }
    if (totalCleared > 0) setScore(s => s + totalCleared);
  };

  const handleCellClick = (r, c) => {
    if (busy) return;
    if (!selected) {
      setSelected({ r, c });
      return;
    }
    if (selected.r === r && selected.c === c) {
      setSelected(null);
      return;
    }
    const dr = Math.abs(selected.r - r);
    const dc = Math.abs(selected.c - c);
    if (dr + dc !== 1) {
      // not adjacent: reselect
      setSelected({ r, c });
      return;
    }
    // attempt swap
    setBusy(true);
    setSelected(null);
    const next = cloneGrid(grid);
    const { r: r1, c: c1 } = selected;
    const tmp = next[r1][c1];
    next[r1][c1] = next[r][c];
    next[r][c] = tmp;

    const producesMatch = findMatches(next).size > 0;
    if (!producesMatch) {
      setBusy(false);
      return; // ignore invalid swap
    }
    (async () => {
      await tryResolve(next);
      setGrid(next.map(row => row.slice()));
      setBusy(false);
    })();
  };

  const reset = () => {
    setScore(0);
    setSelected(null);
    setGrid(generateInitialGrid());
  };

  const board = useMemo(() => grid, [grid]);

  return (
    <div className="match3-wrapper">
      <h2>Три в ряд</h2>
      <div className="match3-info">
        <div>Очки: {score}</div>
        <button onClick={reset} disabled={busy}>Сброс</button>
      </div>
      <div className="match3-board" style={{ gridTemplateColumns: `repeat(${COLS}, 48px)` }}>
        {board.map((row, r) => (
          row.map((gem, c) => {
            const isSel = selected && selected.r === r && selected.c === c;
            return (
              <button
                key={keyOf(r, c)}
                className={`match3-cell${isSel ? ' selected' : ''}`}
                onClick={() => handleCellClick(r, c)}
                disabled={busy}
                aria-label={`cell-${r}-${c}`}
              >
                <div className="gem" style={{ background: COLORS[gem] }} />
              </button>
            );
          })
        ))}
      </div>
    </div>
  );
}

