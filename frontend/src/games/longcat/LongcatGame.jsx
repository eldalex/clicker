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
  const filledCount = visitedSet.size;

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
    setVisitedSet(v);
  };

  useEffect(() => { setupLevel(levelIndex); /* eslint-disable-next-line */ }, [levelIndex]);

  // Обработка клавиш
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key;
      let next = dirRef.current;
      if (k === 'ArrowUp' || k === 'w' || k === 'W') next = 'up';
      else if (k === 'ArrowDown' || k === 's' || k === 'S') next = 'down';
      else if (k === 'ArrowLeft' || k === 'a' || k === 'A') next = 'left';
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') next = 'right';
      else if (k === ' ') { // пробел: Start/Pause
        setRunning(r => {
          const newState = !r;
          setStatus(newState ? STATUS.running : STATUS.paused);
          return newState;
        });
        return;
      }
      // запрет разворота на 180
      const opp = { up: 'down', down: 'up', left: 'right', right: 'left' };
      if (next && opp[next] !== dirRef.current) setDir(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
      const bodySet = new Set(prev.map(([x,y]) => keyOf(x,y)));
      if (bodySet.has(k)) { setStatus(STATUS.over); setRunning(false); return prev; }

      // движение: наращиваем, хвост не удаляем (заполняем поле)
      const nextSnake = [...prev, [nx, ny]];
      const isNew = !visitedSet.has(k);
      if (isNew) setVisitedSet(v => { const nv = new Set(v); nv.add(k); return nv; });
      setTicks(t => t + 1);

      // завершение уровня
      const newVisitedSize = visitedSet.size + (isNew ? 1 : 0);
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

  // Кнопки
  const onStartPause = () => {
    setRunning(r => { const nr = !r; setStatus(nr ? STATUS.running : STATUS.paused); return nr; });
  };
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
          <button onClick={onStartPause}>{running ? 'Pause' : 'Start'}</button>
          <button onClick={onRestart}>Restart</button>
          <button onClick={onNextLevel} disabled={status !== STATUS.complete}>Next Level</button>
        </div>
      </div>

      <div className="longcat-board-frame">
        <div
          className="longcat-board"
          style={{ gridTemplateColumns: `repeat(${gridWidth}, var(--cell-size))`, gridTemplateRows: `repeat(${gridHeight}, var(--cell-size))` }}
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
      <div style={{ fontSize: '0.85rem', color: '#666' }}>Управление: стрелки или WASD. Пробел — Start/Pause.</div>
    </div>
  );
}
