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
    // старт: явные координаты из уровня или первая свободная клетка сверху-слева
    const wallSet = new Set(level.walls.map(([x,y]) => keyOf(x,y)));
    const explicit = Array.isArray(level.start) && level.start.length === 2 ? level.start : null;
    if (explicit && !wallSet.has(keyOf(explicit[0], explicit[1]))) {
      return [explicit];
    }
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
  const runningRef = useRef(running);
  useEffect(() => { runningRef.current = running; }, [running]);
  const snakeRef = useRef(snake);
  useEffect(() => { snakeRef.current = snake; }, [snake]);
  const gridWRef = useRef(gridWidth);
  const gridHRef = useRef(gridHeight);
  useEffect(() => { gridWRef.current = gridWidth; }, [gridWidth]);
  useEffect(() => { gridHRef.current = gridHeight; }, [gridHeight]);
  const wallSetRef = useRef(wallSet);
  useEffect(() => { wallSetRef.current = wallSet; }, [wallSet]);

  // Инициализация уровня / рестарт
  const setupLevel = (idx) => {
    const L = LEVELS[idx % LEVELS.length];
    setGridWidth(L.w);
    setGridHeight(L.h);
    setWalls(L.walls);
    // стартовая позиция
    const wset = new Set(L.walls.map(([x,y]) => keyOf(x,y)));
    let start = null;
    const explicit = Array.isArray(L.start) && L.start.length === 2 ? L.start : null;
    if (explicit && !wset.has(keyOf(explicit[0], explicit[1]))) {
      start = explicit;
    } else {
      for (let y = 0; y < L.h && !start; y++) for (let x = 0; x < L.w; x++) if (!wset.has(keyOf(x,y))) { start = [x,y]; break; }
    }
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
    // сброс жеста/перетаскивания при смене уровня
    activeRef.current = false;
    startRef.current = null;
  };

  useEffect(() => { setupLevel(levelIndex); /* eslint-disable-next-line */ }, [levelIndex]);

  // Вспомогательные функции: проверка клетки и установка направления, когда движение остановлено
  const isValidCell = (x, y, bodySet) => {
    if (x < 0 || x >= gridWRef.current || y < 0 || y >= gridHRef.current) return false;
    const k = keyOf(x, y);
    if (wallSetRef.current.has(k)) return false;
    if (bodySet.has(k)) return false;
    return true;
  };

  const setDirectionImmediate = (wanted) => {
    if (!wanted) return;
    if (runningRef.current) return; // нельзя менять направление во время движения
    const curSnake = snakeRef.current;
    const head = curSnake[curSnake.length - 1];
    const d = DIRS[wanted];
    const bodySet = new Set(curSnake.map(([x,y]) => keyOf(x,y)));
    const nx = head[0] + d.dx; const ny = head[1] + d.dy;
    if (!isValidCell(nx, ny, bodySet)) return; // не стартуем в препятствие
    dirRef.current = wanted;
    setDir(wanted);
    setRunning(true);
    setStatus(STATUS.running);
  };

  // Ref на актуальную функцию выбора направления для обработчика клавиатуры
  const chooseDirRef = useRef(setDirectionImmediate);
  useEffect(() => { chooseDirRef.current = setDirectionImmediate; });

  // Обработка клавиш (только выбор направления при остановке)
  useEffect(() => {
    const mapKeyToDir = (e) => {
      const k = e.key;
      const c = e.code;
      if (k === 'ArrowUp' || c === 'ArrowUp' || k === 'Up' || c === 'Up' || c === 'KeyW' || k === 'w' || k === 'W' || c === 'Numpad8') return 'up';
      if (k === 'ArrowDown' || c === 'ArrowDown' || k === 'Down' || c === 'Down' || c === 'KeyS' || k === 's' || k === 'S' || c === 'Numpad2') return 'down';
      if (k === 'ArrowLeft' || c === 'ArrowLeft' || k === 'Left' || c === 'Left' || c === 'KeyA' || k === 'a' || k === 'A' || c === 'Numpad4') return 'left';
      if (k === 'ArrowRight' || c === 'ArrowRight' || k === 'Right' || c === 'Right' || c === 'KeyD' || k === 'd' || k === 'D' || c === 'Numpad6') return 'right';
      return null;
    };
    const onKey = (e) => {
      const next = mapKeyToDir(e);
      if (!next) return;
      chooseDirRef.current(next);
      e.preventDefault();
      e.stopPropagation();
    };
    // Перехватываем на стадии capture, чтобы гарантированно поймать
    window.addEventListener('keydown', onKey, { passive: false, capture: true });
    document.addEventListener('keydown', onKey, { passive: false, capture: true });
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true });
      document.removeEventListener('keydown', onKey, { capture: true });
    };
  }, []);

  // На размонтировании подстрахуемся и сбросим возможное «залипание» жеста
  useEffect(() => {
    return () => {
      activeRef.current = false;
      startRef.current = null;
    };
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

  // Альтернативный шаг с учётом правил: двигаемся прямо, на препятствии ждём ввода, Game Over только если ходов нет
  const doStep = () => {
    setSnake(prev => {
      const cur = prev[prev.length - 1];
      const { dx, dy } = DIRS[dirRef.current] || { dx: 0, dy: 0 };
      const nx = cur[0] + dx;
      const ny = cur[1] + dy;
      const bodySetAll = new Set(prev.map(([x,y]) => keyOf(x,y)));
      const aheadValid = (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) && !wallSet.has(keyOf(nx, ny)) && !bodySetAll.has(keyOf(nx, ny));
      if (!aheadValid) {
        // Проверим наличие любых допустимых направлений
        const hasAlternative = Object.values(DIRS).some(({ dx: ddx, dy: ddy }) => {
          const tx = cur[0] + ddx; const ty = cur[1] + ddy;
          const kk = keyOf(tx, ty);
          return (tx >= 0 && tx < gridWidth && ty >= 0 && ty < gridHeight) && !wallSet.has(kk) && !bodySetAll.has(kk);
        });
        if (!hasAlternative) {
          setStatus(STATUS.over);
          setRunning(false);
          return prev;
        }
        // Иначе ждём выбора игрока
        setRunning(false);
        setStatus(STATUS.paused);
        return prev;
      }

      // Выполняем шаг вперёд
      const nextSnake = [...prev, [nx, ny]];
      const kk = keyOf(nx, ny);
      const isNew = !visitedRef.current.has(kk);
      if (isNew) {
        visitedRef.current.add(kk);
        setVisitedSet(new Set(visitedRef.current));
      }
      setTicks(t => t + 1);

      const newVisitedSize = filledRef.current + (isNew ? 1 : 0);
      filledRef.current = newVisitedSize;
      setFilledCount(newVisitedSize);
      if (newVisitedSize >= totalFreeCells) {
        setStatus(STATUS.complete);
        setRunning(false);
      } else {
        if (running) setStatus(STATUS.running);
      }
      return nextSnake;
    });
  };

  // Таймер
  useEffect(() => {
    if (!running || status === STATUS.complete || status === STATUS.over) return;
    const id = setInterval(doStep, tickMs);
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
    setDirectionImmediate(wanted);
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

  // Сброс «жеста» при уходе курсора/отмене касания, чтобы не залипало состояние
  const onPointerCancel = (e) => {
    activeRef.current = false;
    startRef.current = null;
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
           onMouseLeave={onPointerCancel}
           onTouchStart={onPointerDown}
           onTouchMove={onPointerMove}
           onTouchEnd={onPointerUp}
           onTouchCancel={onPointerCancel}
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
