import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './MatchPathPuzzle.css';
import levelsData from './levels.json';

function key(r, c) { return `${r},${c}`; }
function manhattan(a, b) { return Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]); }

export default function MatchPathPuzzle() {
  const [levelIndex, setLevelIndex] = useState(0);
  const level = levelsData[levelIndex % levelsData.length];
  const N = level.size;

  // Fixed icons map and endpoints
  const endpoints = useMemo(() => {
    const map = new Map(); // key -> {pairId, icon, color}
    const Nloc = level?.size ?? 0;
    (level?.pairs || []).forEach(p => {
      if (!p || !Array.isArray(p.a) || !Array.isArray(p.b)) return;
      const [ar, ac] = p.a, [br, bc] = p.b;
      if (
        Number.isInteger(ar) && Number.isInteger(ac) && ar>=0 && ac>=0 && ar<Nloc && ac<Nloc &&
        Number.isInteger(br) && Number.isInteger(bc) && br>=0 && bc>=0 && br<Nloc && bc<Nloc
      ) {
        map.set(key(ar, ac), { pairId: p.id, icon: p.icon, color: p.color, endpoint: 'a' });
        map.set(key(br, bc), { pairId: p.id, icon: p.icon, color: p.color, endpoint: 'b' });
      }
    });
    return map;
  }, [level]);

  // Paths and ownership
  const [paths, setPaths] = useState(() => ({})); // id -> [[r,c], ...]
  const [own, setOwn] = useState(() => Array.from({length:N}, () => Array(N).fill(null))); // pairId or null
  const [activePair, setActivePair] = useState(null);
  const [connectedCount, setConnectedCount] = useState(0);
  const [won, setWon] = useState(false);
  const historyRef = useRef([]); // stack of {paths, own}
  const draggingRef = useRef(false);

  const resetLevel = useCallback(() => {
    setPaths({});
    setOwn(Array.from({length:N}, () => Array(N).fill(null)));
    setActivePair(null);
    setWon(false);
    setConnectedCount(0);
    historyRef.current = [];
  }, [N]);

  useEffect(() => { resetLevel(); /* eslint-disable-next-line */ }, [levelIndex]);

  const pushHistory = useCallback((nextPaths, nextOwn) => {
    historyRef.current.push({
      paths: JSON.parse(JSON.stringify(nextPaths)),
      own: nextOwn.map(row => row.slice())
    });
  }, []);

  const undo = () => {
    if (historyRef.current.length < 2) return;
    historyRef.current.pop();
    const prev = historyRef.current[historyRef.current.length - 1];
    setPaths(prev.paths);
    setOwn(prev.own);
    setActivePair(null);
    validateWin(prev.paths, prev.own);
  };

  const setStateAndSave = (nextPaths, nextOwn) => {
    setPaths(nextPaths);
    setOwn(nextOwn);
    pushHistory(nextPaths, nextOwn);
    validateWin(nextPaths, nextOwn);
  };

  const isCellEndpoint = (r, c) => endpoints.has(key(r,c));
  const endpointInfo = (r, c) => endpoints.get(key(r,c));

  const canStartAt = (r, c) => {
    // Разрешаем старт с иконки пары или с любой своей занятой клетки (для отката/продолжения)
    if (endpoints.has(key(r,c))) return true;
    return !!own[r][c];
  };

  const startPath = (pairId, start) => {
    const nextPaths = JSON.parse(JSON.stringify(paths));
    // Restart path for this pair from the start cell
    nextPaths[pairId] = [start];
    // Rebuild ownership: clear all cells of this pair
    const nextOwn = own.map(row => row.slice());
    for (let rr=0; rr<N; rr++) for (let cc=0; cc<N; cc++) if (nextOwn[rr][cc] === pairId) nextOwn[rr][cc] = null;
    nextOwn[start[0]][start[1]] = pairId;
    setActivePair(pairId);
    setStateAndSave(nextPaths, nextOwn);
  };

  const startFromExisting = (pairId, r, c) => {
    const nextPaths = JSON.parse(JSON.stringify(paths));
    const path = nextPaths[pairId] || [];
    const idx = path.findIndex(([rr,cc]) => rr===r && cc===c);
    const nextOwn = own.map(row => row.slice());
    if (idx >= 0) {
      // truncate to this cell and free tail
      for (let i = path.length - 1; i > idx; i--) {
        const [tr, tc] = path[i];
        nextOwn[tr][tc] = null;
      }
      nextPaths[pairId] = path.slice(0, idx + 1);
    } else {
      // inconsistency fallback: treat as fresh start from this cell
      nextPaths[pairId] = [[r,c]];
      nextOwn[r][c] = pairId;
    }
    setActivePair(pairId);
    setStateAndSave(nextPaths, nextOwn);
  };

  const cutForeignPathAtCell = (pairId, r, c, nextPaths, nextOwn) => {
    const other = nextOwn[r][c];
    if (!other || other === pairId) return;
    const path = nextPaths[other] || [];
    // remove full path (simpler variant allowed by rules)
    for (const [pr, pc] of path || []) nextOwn[pr][pc] = null;
    nextPaths[other] = [];
  };

  const extendPathTo = (r, c) => {
    if (!draggingRef.current || !activePair) return;
    const nextPaths = JSON.parse(JSON.stringify(paths));
    const nextOwn = own.map(row => (row ? row.slice() : Array(N).fill(null)));
    const path = nextPaths[activePair] || [];
    const last = path[path.length - 1];
    if (!last) return;
    if (manhattan(last, [r,c]) !== 1) return; // only orthogonal step

    const cellOwner = nextOwn[r][c];
    const info = endpointInfo(r,c);
    // Can't step over foreign endpoint
    if (info && info.pairId !== activePair) return;

    // Backtracking on own path: truncate back to cell if exists
    const idxInOwn = path.findIndex(([rr,cc]) => rr===r && cc===c);
    if (idxInOwn >= 0) {
      for (let i = path.length - 1; i > idxInOwn; i--) {
        const [tr, tc] = path[i];
        nextOwn[tr][tc] = null;
      }
      nextPaths[activePair] = path.slice(0, idxInOwn + 1);
      setStateAndSave(nextPaths, nextOwn);
      return;
    }

    // If occupied by other pair -> cut that path
    if (cellOwner && cellOwner !== activePair) {
      cutForeignPathAtCell(activePair, r, c, nextPaths, nextOwn);
    }

    // Extend into the cell
    nextPaths[activePair] = [...path, [r,c]];
    nextOwn[r][c] = activePair;
    setStateAndSave(nextPaths, nextOwn);
  };

  const onCellDown = (r, c) => {
    if (!canStartAt(r,c)) return;
    draggingRef.current = true;
    const info = endpointInfo(r,c);
    if (info) {
      startPath(info.pairId, [r,c]);
      return;
    }
    const owner = own[r][c];
    if (owner) {
      startFromExisting(owner, r, c);
    }
  };
  const onCellEnter = (r, c) => { if (draggingRef.current) extendPathTo(r,c); };
  const onMouseUp = () => { draggingRef.current = false; setActivePair(null); };

  // Touch handling: translate touch position -> cell under finger via elementFromPoint
  const boardRef = useRef(null);
  const handleTouchStart = (e) => {
    const t = e.touches[0];
    if (!t) return;
    const el = document.elementFromPoint(t.clientX, t.clientY);
    const r = parseInt(el?.getAttribute('data-r') || '-1', 10);
    const c = parseInt(el?.getAttribute('data-c') || '-1', 10);
    if (r>=0 && c>=0) onCellDown(r,c);
    e.preventDefault();
  };
  const handleTouchMove = (e) => {
    const t = e.touches[0];
    if (!t) return;
    const el = document.elementFromPoint(t.clientX, t.clientY);
    const r = parseInt(el?.getAttribute('data-r') || '-1', 10);
    const c = parseInt(el?.getAttribute('data-c') || '-1', 10);
    if (r>=0 && c>=0) onCellEnter(r,c);
    e.preventDefault();
  };
  const handleTouchEnd = (e) => {
    draggingRef.current = false;
    setActivePair(null);
    if (e) e.preventDefault();
  };

  const validateWin = (p = paths, o = own) => {
    // A pair is connected if its path starts at one endpoint and ends at the other
    const ok = (level?.pairs || []).every(pair => {
      if (!pair || !Array.isArray(pair.a) || !Array.isArray(pair.b)) return false;
      const path = p[pair.id] || [];
      if (path.length < 2) return false;
      const hasA = path.some(([r,c]) => r===pair.a[0] && c===pair.a[1]);
      const hasB = path.some(([r,c]) => r===pair.b[0] && c===pair.b[1]);
      return hasA && hasB;
    });
    const connected = (level?.pairs || []).filter(pair => {
      if (!pair || !Array.isArray(pair.a) || !Array.isArray(pair.b)) return false;
      const path = p[pair.id] || [];
      const hasA = path.some(([r,c]) => r===pair.a[0] && c===pair.a[1]);
      const hasB = path.some(([r,c]) => r===pair.b[0] && c===pair.b[1]);
      return hasA && hasB;
    }).length;
    setConnectedCount(connected);
    if (!ok) { setWon(false); return; }
    if (level?.fillAllCells) {
      for (let r=0;r<N;r++) for (let c=0;c<N;c++) if (!o[r][c] && !endpoints.has(key(r,c))) { setWon(false); return; }
    }
    setWon(true);
  };

  // Build pipes per cell
  const cellRender = (r,c) => {
    const k = key(r,c);
    const info = endpoints.get(k);
    const owned = own[r]?.[c] ?? null;
    const color = info?.color || (owned ? (level?.pairs || []).find(p => p.id===owned)?.color : null);
    return (
      <div
        key={k}
        className={`mp-cell ${info ? 'icon' : ''} ${activePair && info && info.pairId===activePair ? 'active' : ''}`}
        data-r={r} data-c={c}
        onMouseDown={() => onCellDown(r,c)}
        onMouseEnter={() => onCellEnter(r,c)}
      >
        {owned && <div className="pipe" style={{ background: color }} />}
        {info && <span aria-hidden>{info.icon}</span>}
      </div>
    );
  };

  useEffect(() => {
    const up = () => onMouseUp();
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  return (
    <div className="mp-wrap">
      <h2>Match‑Path</h2>
      <div className="mp-top">
        <div className="mp-status">Соединено: {connectedCount}/{level.pairs.length}</div>
        <div className="mp-toolbar">
          <button onClick={resetLevel}>Reset</button>
          <button onClick={undo}>Undo</button>
          <button onClick={() => setLevelIndex((i)=> (i+1)%levelsData.length)} disabled={!won}>Следующий уровень</button>
        </div>
      </div>
      <div className="mp-board-frame">
        <div
          className="mp-board touch-game-surface"
          ref={boardRef}
          style={{ gridTemplateColumns: `repeat(${N}, 44px)`, gridTemplateRows: `repeat(${N}, 44px)` }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          {Array.from({length:N}).map((_, r) => (
            Array.from({length:N}).map((__, c) => cellRender(r,c))
          ))}
        </div>
      </div>
      <div>
        <div style={{ margin: '8px 0' }}>Выбор уровня</div>
        <div className="mp-levels">
          {levelsData.map((_, i) => (
            <button key={i} onClick={() => setLevelIndex(i)} style={{ fontWeight: i===levelIndex ? 700 : 500 }}>{i+1}</button>
          ))}
        </div>
      </div>
      {won && (
        <div className="mp-modal" role="dialog" aria-modal="true">
          <div className="box">
            <h3>Уровень пройден!</h3>
            <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop: 8 }}>
              <button onClick={() => { resetLevel(); }}>Повторить</button>
              <button onClick={() => { setLevelIndex((i)=> (i+1)%levelsData.length); }}>Следующий уровень</button>
            </div>
          </div>
        </div>
      )}
      <div className="mp-hint">Правила: соедините иконки парами, двигаясь по клеткам ортогонально. Линии не пересекаются; можно перерисовывать и «обрезать» другие линии.</div>
    </div>
  );
}
