// frontend/src/Match3.jsx
import React, { useMemo, useRef, useState } from 'react';

const ROWS = 8;
const COLS = 8;
const DEFAULT_CELL = 48;
const GAP = 6;
const FRAME_PAD = 10; // CSS padding in .match3-frame
const SWAP_MS = 350;   // slower, more visible
const CLEAR_MS = 380;  // clearer fade/scale
const FALL_MS = 350;   // fall matches swap speed

// Colors tuned for higher contrast between blue/cyan
const COLORS = ['#e57373', '#1565c0', '#81c784', '#ffb74d', '#ba68c8', '#4dd0e1'];

let GEM_ID = 1;
const makeGem = (t) => ({ id: `g${GEM_ID++}`, t });
const randGem = () => makeGem(Math.floor(Math.random() * COLORS.length));

function cloneGrid(grid) {
  return grid.map(row => row.slice());
}

function generateInitialGrid() {
  const grid = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => randGem()));
  // Avoid starting matches
  let attempts = 0;
  while (findMatches(grid).size > 0 && attempts < 100) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) grid[r][c] = randGem();
    }
    attempts++;
  }
  return grid;
}

function findMatches(grid) {
  const toClear = new Set();
  // rows
  for (let r = 0; r < ROWS; r++) {
    let runStart = 0;
    for (let c = 1; c <= COLS; c++) {
      const end = c === COLS;
      const same = !end && grid[r][c] && grid[r][runStart] && grid[r][c].t === grid[r][runStart].t;
      if (!same) {
        const runLen = c - runStart;
        if (grid[r][runStart] && runLen >= 3) {
          for (let k = runStart; k < c; k++) toClear.add(`${r},${k}`);
        }
        runStart = c;
      }
    }
  }
  // cols
  for (let c = 0; c < COLS; c++) {
    let runStart = 0;
    for (let r = 1; r <= ROWS; r++) {
      const end = r === ROWS;
      const same = !end && grid[r][c] && grid[runStart][c] && grid[r][c].t === grid[runStart][c].t;
      if (!same) {
        const runLen = r - runStart;
        if (grid[runStart][c] && runLen >= 3) {
          for (let k = runStart; k < r; k++) toClear.add(`${k},${c}`);
        }
        runStart = r;
      }
    }
  }
  return toClear;
}

function collapse(grid) {
  for (let c = 0; c < COLS; c++) {
    const stack = [];
    for (let r = ROWS - 1; r >= 0; r--) if (grid[r][c]) stack.push(grid[r][c]);
    for (let r = ROWS - 1; r >= 0; r--) grid[r][c] = stack[ROWS - 1 - r] ?? null;
  }
}

function refill(grid) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) if (!grid[r][c]) grid[r][c] = randGem();
  }
}

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

export default function Match3() {
  const [grid, setGrid] = useState(() => generateInitialGrid());
  const [selected, setSelected] = useState(null); // {r,c}
  const [score, setScore] = useState(0);
  const [busy, setBusy] = useState(false);
  const [clearingIds, setClearingIds] = useState(new Set());

  // Saving/leaderboard state (per-game: match3)
  const [player, setPlayer] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [bestSaved, setBestSaved] = useState(0);
  const saveTimerRef = useRef(null);

  const wrapRef = useRef(null);
  const [cell, setCell] = useState(DEFAULT_CELL);

  const boardW = COLS * cell + (COLS - 1) * GAP; // content area (without padding)
  const boardH = ROWS * cell + (ROWS - 1) * GAP;
  const totalW = boardW + FRAME_PAD * 2;
  const totalH = boardH + FRAME_PAD * 2;

  React.useEffect(() => {
    const calc = () => {
      const el = wrapRef.current;
      if (!el) return;
      const maxW = el.clientWidth;
      const rect = el.getBoundingClientRect();
      const viewportH = window.innerHeight;

      const defaultTotalW = COLS * DEFAULT_CELL + (COLS - 1) * GAP + FRAME_PAD * 2;
      const defaultTotalH = ROWS * DEFAULT_CELL + (ROWS - 1) * GAP + FRAME_PAD * 2;

      const isNarrow = window.matchMedia && window.matchMedia('(max-width: 640px)').matches;

      // Desktop/wide: always keep default size, no autosize
      if (!isNarrow) {
        setCell(DEFAULT_CELL);
        return;
      }

      // Mobile: fit by both width and height
      const availW = Math.max(0, maxW - FRAME_PAD * 2);
      const widthCell = Math.floor((availW - (COLS - 1) * GAP) / COLS);
      const availH = Math.max(0, viewportH - rect.top - 24 - FRAME_PAD * 2);
      const heightCell = Math.floor((availH - (ROWS - 1) * GAP) / ROWS);
      const next = Math.max(24, Math.min(DEFAULT_CELL, Math.min(widthCell, heightCell)));
      setCell(next);
    };
    calc();
    const ro = new ResizeObserver(calc);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener('orientationchange', calc);
    window.addEventListener('resize', calc);
    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', calc);
      window.removeEventListener('resize', calc);
    };
  }, []);

  // Load player name from localStorage and leaderboard
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('player_name') || localStorage.getItem('playerName');
      if (saved && typeof saved === 'string') setPlayer(saved);
    } catch (_) {}
  }, []);

  // Fetch current saved score once to initialize bestSaved
  React.useEffect(() => {
    const user = (player || '').trim();
    if (!user) return;
    (async () => {
      try {
        const res = await fetch(`/api/score?user=${encodeURIComponent(user)}&game=${encodeURIComponent('match3')}`);
        const data = await res.json();
        if (typeof data?.score === 'number') setBestSaved(Math.max(0, data.score));
      } catch (_) {}
    })();
  }, [player]);

  const fetchLeaderboard = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/scores?game=${encodeURIComponent('match3')}`);
      const data = await res.json();
      if (Array.isArray(data)) setLeaderboard(data);
    } catch (_) {}
  }, []);

  React.useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  const pos = (r, c) => ({
    transform: `translate(${c * (cell + GAP)}px, ${r * (cell + GAP)}px)`,
    width: `${cell}px`,
    height: `${cell}px`,
  });

  const swapCells = (g, a, b) => {
    const next = cloneGrid(g);
    const tmp = next[a.r][a.c];
    next[a.r][a.c] = next[b.r][b.c];
    next[b.r][b.c] = tmp;
    return next;
  };

  const resolveCascades = async (g) => {
    let total = 0;
    while (true) {
      const matches = findMatches(g);
      if (matches.size === 0) break;
      const idsToClear = new Set();
      matches.forEach(k => {
        const [r, c] = k.split(',').map(Number);
        if (g[r][c]) idsToClear.add(g[r][c].id);
      });
      setClearingIds(idsToClear);
      await sleep(CLEAR_MS);
      matches.forEach(k => {
        const [r, c] = k.split(',').map(Number);
        g[r][c] = null;
      });
      setClearingIds(new Set());
      total += matches.size;
      collapse(g);
      setGrid(g.map(row => row.slice())); // animate fall
      await sleep(FALL_MS);
      refill(g);
      setGrid(g.map(row => row.slice())); // spawn
      // small delay before next detection
      await sleep(30);
    }
    if (total) setScore(s => s + total);
  };

  const handleGemClick = (r, c) => {
    if (busy || !grid[r][c]) return;
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
      setSelected({ r, c });
      return;
    }
    // adjacent: try swap
    const a = { ...selected };
    const b = { r, c };
    setSelected(null);
    setBusy(true);
    const swapped = swapCells(grid, a, b);
    setGrid(swapped); // animate swap
    const hasMatch = findMatches(swapped).size > 0;
    (async () => {
      await sleep(SWAP_MS);
      if (!hasMatch) {
        setGrid(grid); // swap back
        await sleep(SWAP_MS);
        setBusy(false);
        return;
      }
      await resolveCascades(swapped);
      setBusy(false);
    })();
  };

  const reset = () => {
    setScore(0);
    setSelected(null);
    setClearingIds(new Set());
    setGrid(generateInitialGrid());
  };

  // Auto-save best score with debounce and token handling
  React.useEffect(() => {
    const user = (player || '').trim();
    if (!user) return; // no name: do not save
    if (score <= bestSaved) return; // nothing better to save

    // debounce consecutive changes
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const doPostWithFreshToken = async () => {
        // Always get a fresh token right before saving
        const getRes = await fetch(`/api/score?user=${encodeURIComponent(user)}&game=${encodeURIComponent('match3')}`);
        const getData = await getRes.json();
        const token = getData?.load_token;
        if (!token) throw new Error('no_token');
        const res = await fetch('/api/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user, game: 'match3', score, load_token: token })
        });
        return res;
      };
      try {
        let res = await doPostWithFreshToken();
        if (res.status === 409) {
          // Retry once with a fresh token
          res = await doPostWithFreshToken();
        }
        if (!res.ok) return;
        const top = await res.json();
        setBestSaved(prev => Math.max(prev, score));
        if (Array.isArray(top)) setLeaderboard(top);
      } catch (_) {
        // ignore transient errors
      }
    }, 800);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [score, player, bestSaved]);

  const gems = useMemo(() => {
    const list = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const g = grid[r][c];
        if (!g) continue;
        list.push({ r, c, gem: g });
      }
    }
    return list;
  }, [grid]);

  return (
    <div className="match3-wrapper">
      <h2>Три в ряд</h2>
      <div className="match3-info">
        <div>Очки: {score}</div>
        <button onClick={reset} disabled={busy}>Сброс</button>
      </div>
      {!player?.trim() ? (
        <div className="match3-info" style={{ color: '#a55', fontSize: '0.95rem' }}>
          Укажите имя на стартовом экране, чтобы сохранять рекорды.
        </div>
      ) : null}
      <div className="match3-board-wrap" ref={wrapRef}>
        <div className="match3-frame">
          <div className="match3-board" style={{ width: `${boardW}px`, height: `${boardH}px` }}>
        {gems.map(({ r, c, gem }) => {
          const isSel = selected && selected.r === r && selected.c === c;
          const clearing = clearingIds.has(gem.id);
          return (
            <button
              key={gem.id}
              className={`match3-gem${isSel ? ' selected' : ''}`}
              style={pos(r, c)}
              onClick={() => handleGemClick(r, c)}
              disabled={busy}
              aria-label={`cell-${r}-${c}`}
            >
              <div
                className={`gem-box${clearing ? ' clearing' : ''}`}
                style={{ background: COLORS[gem.t], width: `${cell}px`, height: `${cell}px` }}
              />
            </button>
          );
        })}
          </div>
        </div>
      </div>
      <div style={{ width: '100%', marginTop: '0.75rem' }}>
        <h3 style={{ margin: '0.25rem 0' }}>Таблица лидеров (Match3)</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {leaderboard.slice(0, 10).map((e, i) => (
            <li key={e.name + i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span>{i + 1}. {e.name}</span>
              <span>{e.score}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
