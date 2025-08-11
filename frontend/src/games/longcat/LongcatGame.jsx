// Longcat (Snake-лабиринт): заполняем все свободные клетки, не врезаемся
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LEVELS } from './levels';
import './longcat.css';

// Направления движения
const DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

const STATUS = {
  running: 'Running',
  paused: 'Paused',
  over: 'Game Over',
  complete: 'Level Complete',
};

// Ключ ячейки
const keyOf = (x, y) => `${x},${y}`;

export default function LongcatGame() {
  // Параметры уровня
  const [levelIndex, setLevelIndex] = useState(0);
  const level = LEVELS[levelIndex % LEVELS.length];
  const [gridWidth, setGridWidth] = useState(level.w);
  const [gridHeight, setGridHeight] = useState(level.h);
  const [walls, setWalls] = useState(level.walls);

  // Состояние игры
  const [snake, setSnake] = useState(() => {
    // старт: первая свободная клетка сверху-слева
    const wallSet = new Set(level.walls.map(([x,y]) => keyOf(x,y)));
    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        if (!wallSet.has(keyOf(x,y))) return [[x, y]];
      }
    }
    return [[0, 0]];
  });
  const [dir, setDir] = useState('right');
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState(STATUS.paused);
  const [tickMs, setTickMs] = useState(130); // 120..150 мс
  const [ticks, setTicks] = useState(0);

  // Учёт посещённых свободных клеток
  const wallSet = useMemo(() => new Set(walls.map(([x,y]) => keyOf(x,y))), [walls]);
  const totalFreeCells = gridWidth * gridHeight - wallSet.size;
  const [visitedSet, setVisitedSet] = useState(() => new Set());
  const visitedRef = useRef(new Set());
  const [filledCount, setFilledCount] = useState(0);
  const filledRef = useRef(0);

  // Для запрета мгновенного разворота
  const dirRef = useRef(dir);
  useEffect(() => { dirRef.current = dir; }, [dir]);

  // Инициализация уровня / рестарт
  const setupLevel = (idx) => {
    const L = LEVELS[idx % LEVELS.length];
    setGridWidth(L.w);
    setGridHeight(L.h);
    setWalls(L.walls);
    // стартовая позиция
    const wset = new Set(L.walls.map(([x,y]) => keyOf(x,y)));
    let start = null;
    for (let y = 0; y < L.h && !start; y++) for (let x = 0; x < L.w; x++) if (!wset.has(keyOf(x,y))) { start = [x,y]; break; }
    const initialSnake = [start || [0,0]];
    setSnake(initialSnake);
    setDir('right');
    setRunning(false);
    setStatus(STATUS.paused);
    setTicks(0);
    const v = new Set();
    const [sx, sy] = initialSnake[0];
    if (!wset.has(keyOf(sx, sy))) v.add(keyOf(sx, sy));
    visitedRef.current = new Set(v);
    setVisitedSet(v);
    filledRef.current = v.size;
    setFilledCount(v.size);
  };

  useEffect(() => { setupLevel(levelIndex); /* eslint-disable-next-line */ }, [levelIndex]);

  // Обработка клавиш (только смена направления, без Start/Pause)
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key;
      let next = dirRef.current;
      if (k === 'ArrowUp' || k === 'w' || k === 'W') next = 'up';
      else if (k === 'ArrowDown' || k === 's' || k === 'S') next = 'down';
      else if (k === 'ArrowLeft' || k === 'a' || k === 'A') next = 'left';
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') next = 'right';
      else { return; }
      // запрет разворота на 180
      const opp = { up: 'down', down: 'up', left: 'right', right: 'left' };
      if (!next) return;
      if (!running) {
        setDir(next);
        setRunning(true);
        setStatus(STATUS.running);
        e.preventDefault();
        return;
      }
      if (next !== dirRef.current && opp[next] !== dirRef.current) {
        setDir(next);
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', onKey, { passive: false });
    return () => document.removeEventListener('keydown', onKey, { passive: false });
  }, []);

  // Один шаг
  const step = () => {
    setSnake(prev => {
      const cur = prev[prev.length - 1];
      const { dx, dy } = DIRS[dirRef.current] || { dx: 0, dy: 0 };
      const nx = cur[0] + dx;
      const ny = cur[1] + dy;
      // границы
      if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight) {
        setStatus(STATUS.over); setRunning(false); return prev;
      }
      const k = keyOf(nx, ny);
      if (wallSet.has(k)) { setStatus(STATUS.over); setRunning(false); return prev; }
      // столкновение с телом
      const bodySetAll = new Set(prev.map(([x,y]) => keyOf(x,y)));
      if (bodySetAll.has(k)) { setStatus(STATUS.over); setRunning(false); return prev; }

      // движение: наращиваем, хвост не удаляем (заполняем поле)
      const nextSnake = [...prev, [nx, ny]];
      const isNew = !visitedRef.current.has(k);
      if (isNew) {
        visitedRef.current.add(k);
        const snapshot = new Set(visitedRef.current);
        setVisitedSet(snapshot);
      }
      setTicks(t => t + 1);

      // завершение уровня
      const newVisitedSize = filledRef.current + (isNew ? 1 : 0);
      filledRef.current = newVisitedSize;
      setFilledCount(newVisitedSize);
      if (newVisitedSize >= totalFreeCells) {
        setStatus(STATUS.complete);
        setRunning(false);
      } else {
        if (running) setStatus(STATUS.running); // поддерживаем статус
      }
      return nextSnake;
    });
  };

  // Таймер
  useEffect(() => {
    if (!running || status === STATUS.complete || status === STATUS.over) return;
    const id = setInterval(step, tickMs);
    return () => clearInterval(id);
  }, [running, tickMs, status]);

  // Свайпы/перетаскивание
  const boardRef = useRef(null);
  const startRef = useRef(null); // {x,y}
  const activeRef = useRef(false);

  const setDirectionByDelta = (dx, dy) => {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; // порог
    const horiz = Math.abs(dx) >= Math.abs(dy);
    const wanted = horiz ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    const opp = { up: 'down', down: 'up', left: 'right', right: 'left' };
    if (!running) {
      setDir(wanted);
      setRunning(true);
      setStatus(STATUS.running);
      return;
    }
    if (wanted !== dirRef.current && opp[wanted] !== dirRef.current) {
      setDir(wanted);
    }
  };

  const cellFromPoint = (clientX, clientY) => {
    const el = boardRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const GAP = 2; // как в CSS
    const totalW = rect.width;
    const totalH = rect.height;
    const cellW = (totalW - GAP * (gridWidth - 1)) / gridWidth;
    const cellH = (totalH - GAP * (gridHeight - 1)) / gridHeight;
    const rx = clientX - rect.left;
    const ry = clientY - rect.top;
    const cx = Math.floor(rx / (cellW + GAP));
    const cy = Math.floor(ry / (cellH + GAP));
    if (cx < 0 || cx >= gridWidth || cy < 0 || cy >= gridHeight) return null;
    return [cx, cy];
  };

  const onPointerDown = (e) => {
    // Разрешаем свайп в любом месте на тач; на мыши — только с головы
    const isTouch = e.pointerType === 'touch' || e.type === 'touchstart';
    let ok = true;
    if (!isTouch) {
      const cell = cellFromPoint(e.clientX ?? e.touches?.[0]?.clientX, e.clientY ?? e.touches?.[0]?.clientY);
      const head = snake[snake.length - 1];
      ok = !!cell && head && cell[0] === head[0] && cell[1] === head[1];
    }
    if (!ok) return;
    activeRef.current = true;
    const cx = e.clientX ?? (e.touches ? e.touches[0].clientX : 0);
    const cy = e.clientY ?? (e.touches ? e.touches[0].clientY : 0);
    startRef.current = { x: cx, y: cy };
    e.preventDefault();
  };
  const onPointerMove = (e) => {
    if (!activeRef.current) return;
    const cx = e.clientX ?? (e.touches ? e.touches[0].clientX : 0);
    const cy = e.clientY ?? (e.touches ? e.touches[0].clientY : 0);
    const { x, y } = startRef.current || { x: cx, y: cy };
    setDirectionByDelta(cx - x, cy - y);
    e.preventDefault();
  };
  const onPointerUp = (e) => {
    if (!activeRef.current) return;
    activeRef.current = false;
    startRef.current = null;
    e.preventDefault();
  };

  // Кнопки
  const onRestart = () => setupLevel(levelIndex);
  const onNextLevel = () => { if (status === STATUS.complete) setLevelIndex(i => (i + 1) % LEVELS.length); };

  // Рендер сетки
  const bodySet = useMemo(() => new Set(snake.slice(0, -1).map(([x,y]) => keyOf(x,y))), [snake]);
  const head = snake[snake.length - 1];

  return (
    <div className="longcat-wrap">
      <h2>Longcat</h2>
      <div className="longcat-header">
        <div className="longcat-status">
          <span>Статус: {status}</span>
          <span>Тики: {ticks}</span>
          <span>Заполнено: {Math.floor((filledCount / totalFreeCells) * 100)}%</span>
          <span>Уровень: {levelIndex + 1}/{LEVELS.length}</span>
        </div>
        <div className="longcat-controls">
          <button onClick={onRestart}>Restart</button>
          <button onClick={onNextLevel} disabled={status !== STATUS.complete}>Next Level</button>
        </div>
      </div>

      <div className="longcat-board-frame"
           onMouseDown={onPointerDown}
           onMouseMove={onPointerMove}
           onMouseUp={onPointerUp}
           onTouchStart={onPointerDown}
           onTouchMove={onPointerMove}
           onTouchEnd={onPointerUp}
      >
        <div className="longcat-overlay">
          {status === STATUS.complete && <div className="badge win">Уровень пройден!</div>}
          {status === STATUS.over && <div className="badge lose">Game Over</div>}
        </div>
        <div
          className="longcat-board"
          style={{ gridTemplateColumns: `repeat(${gridWidth}, var(--cell-size))`, gridTemplateRows: `repeat(${gridHeight}, var(--cell-size))` }}
          ref={boardRef}
        >
          {Array.from({ length: gridHeight }).map((_, y) => (
            Array.from({ length: gridWidth }).map((__, x) => {
              const k = keyOf(x, y);
              if (wallSet.has(k)) return <div key={k} className="cell wall" />;
              const isHead = head && head[0] === x && head[1] === y;
              const isBody = bodySet.has(k);
              const cls = isHead ? 'cell head' : isBody ? 'cell body' : 'cell empty';
              return <div key={k} className={cls} />;
            })
          ))}
        </div>
      </div>
      <div style={{ fontSize: '0.85rem', color: '#666' }}>Управление: стрелки/WASD или свайп/перетаскивание головы.</div>
    </div>
  );
}
