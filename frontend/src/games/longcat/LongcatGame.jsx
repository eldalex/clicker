// Longcat (Snake-лабиринт): заполняем все свободные клетки, не врезаемся
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LEVELS } from './levels';
import './longcat.css';
// Sprite assets (SVG URLs)
import head_up from './assets/head_up.svg';
import head_down from './assets/head_down.svg';
import head_left from './assets/head_left.svg';
import head_right from './assets/head_right.svg';
import body_horizontal from './assets/body_horizontal.svg';
import body_vertical from './assets/body_vertical.svg';
import body_turn_ur from './assets/body_turn_ur.svg';
import body_turn_ul from './assets/body_turn_ul.svg';
import body_turn_dr from './assets/body_turn_dr.svg';
import body_turn_dl from './assets/body_turn_dl.svg';
import tail_up from './assets/tail_up.svg';
import tail_down from './assets/tail_down.svg';
import tail_left from './assets/tail_left.svg';
import tail_right from './assets/tail_right.svg';

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
  const [levelsOpen, setLevelsOpen] = useState(false);
  const [levelFilter, setLevelFilter] = useState('');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false);
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

  // viewport watcher for mobile conditional UI
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = () => setIsMobile(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);

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
  const snakeIndexMap = useMemo(() => {
    const m = new Map();
    snake.forEach(([sx, sy], i) => m.set(keyOf(sx, sy), i));
    return m;
  }, [snake]);
  const head = snake[snake.length - 1];

  const onSelectLevel = (idx) => {
    setLevelIndex(idx % LEVELS.length);
    setLevelsOpen(false);
  };

  // --- Sprite assets mapping (using SVG files) ---
  const assets = {
    head_up, head_down, head_left, head_right,
    body_horizontal, body_vertical,
    body_turn_ur, body_turn_ul, body_turn_dr, body_turn_dl,
    tail_up, tail_down, tail_left, tail_right,
  };

  function dirBetween(a, b) {
    if (!a || !b) return null;
    const [ax, ay] = a; const [bx, by] = b;
    if (ax === bx && ay === by - 1) return 'down';
    if (ax === bx && ay === by + 1) return 'up';
    if (ay === by && ax === bx - 1) return 'right';
    if (ay === by && ax === bx + 1) return 'left';
    return null;
  }

  function headSpriteByDir(d) {
    switch (d) {
      case 'up': return assets.head_up;
      case 'down': return assets.head_down;
      case 'left': return assets.head_left;
      case 'right': return assets.head_right;
      default: return assets.head_right;
    }
  }

  function tailSpriteByDir(prev, tail) {
    const d = dirBetween(tail, prev);
    switch (d) {
      case 'up': return assets.tail_up;
      case 'down': return assets.tail_down;
      case 'left': return assets.tail_left;
      case 'right': return assets.tail_right;
      default: return assets.tail_right;
    }
  }

  function bodySpriteByNeighbors(prev, cur, next) {
    const d1 = dirBetween(prev, cur);
    const d2 = dirBetween(cur, next);
    if (!d1 || !d2) return assets.body_horizontal;
    if ((d1 === 'left' && d2 === 'right') || (d1 === 'right' && d2 === 'left')) return assets.body_horizontal;
    if ((d1 === 'up' && d2 === 'down') || (d1 === 'down' && d2 === 'up')) return assets.body_vertical;
    if ((d1 === 'up' && d2 === 'right') || (d1 === 'right' && d2 === 'up')) return assets.body_turn_ur;
    if ((d1 === 'up' && d2 === 'left') || (d1 === 'left' && d2 === 'up')) return assets.body_turn_ul;
    if ((d1 === 'down' && d2 === 'right') || (d1 === 'right' && d2 === 'down')) return assets.body_turn_dr;
    if ((d1 === 'down' && d2 === 'left') || (d1 === 'left' && d2 === 'down')) return assets.body_turn_dl;
    return assets.body_horizontal;
  }

  // Drawer accessibility helpers
  const drawerRef = useRef(null);
  const drawerTitleRef = useRef(null);
  useEffect(() => {
    if (levelsOpen) {
      setTimeout(() => {
        if (drawerTitleRef.current) drawerTitleRef.current.focus();
        else if (drawerRef.current) {
          const focusable = drawerRef.current.querySelector('button, [href], input, [tabindex]:not([tabindex="-1"])');
          if (focusable) focusable.focus();
        }
      }, 0);
    }
  }, [levelsOpen]);

  const onDrawerKeyDown = (e) => {
    if (!levelsOpen || !drawerRef.current) return;
    if (e.key === 'Escape') { setLevelsOpen(false); }
    if (e.key === 'Tab') {
      const nodes = drawerRef.current.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])');
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    }
  };

  return (
    <div className="longcat-wrap">
      <h2>Longcat</h2>
      <div className="longcat-header">
  <div className="longcat-controls">
    <button onClick={onRestart}>Restart</button>
    {isMobile ? (
      <button onClick={() => setLevelsOpen(true)} aria-expanded={levelsOpen} aria-controls="levels-drawer">{'\u0423\u0440\u043E\u0432\u043D\u0438 '}({levelIndex + 1}/{LEVELS.length})</button>
    ) : (
      <button onClick={onNextLevel} disabled={status !== STATUS.complete}>Next Level</button>
    )}
  </div>
</div>
<div className="longcat-main">
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

                const idx = snake.findIndex(([sx, sy]) => sx === x && sy === y);
                if (idx === -1) return <div key={k} className="cell empty" />;

                let bg = null;
                if (idx === snake.length - 1) {
                  bg = headSpriteByDir(dirRef.current);
                } else if (idx === 0) {
                  if (snake.length === 1) {
                    bg = headSpriteByDir(dirRef.current);
                  } else {
                    const prev = snake[1];
                    const tail = snake[0];
                    bg = tailSpriteByDir(prev, tail);
                  }
                } else {
                  const prev = snake[idx - 1];
                  const cur  = snake[idx];
                  const next = snake[idx + 1];
                  bg = bodySpriteByNeighbors(prev, cur, next);
                }

                let rot = 0;\n                // compute rotation based on segment type\n                if (idx === snake.length - 1) {\n                  rot = angleForDir(dirRef.current);\n                } else if (idx === 0 && snake.length > 1) {\n                  const prev = snake[1];\n                  const tail = snake[0];\n                  const d = dirBetween(tail, prev);\n                  rot = angleForDir(d);\n                } else if (idx > 0 && idx < snake.length - 1) {\n                  const prev = snake[idx - 1];\n                  const cur  = snake[idx];\n                  const next = snake[idx + 1];\n                  const d1 = dirBetween(prev, cur);\n                  const d2 = dirBetween(cur, next);\n                  const straight = ((d1 === "left" && d2 === "right") || (d1 === "right" && d2 === "left") || (d1 === "up" && d2 === "down") || (d1 === "down" && d2 === "up"));\n                  if (straight) {\n                    rot = (d1 === "up" || d1 === "down") ? 90 : 0;\n                  } else {\n                    const set = new Set([d1, d2]);\n                    if (set.has("up") && set.has("right")) rot = 0;\n                    else if (set.has("right") && set.has("down")) rot = 90;\n                    else if (set.has("down") && set.has("left")) rot = 180;\n                    else if (set.has("left") && set.has("up")) rot = 270;\n                  }\n                }\n                return <div key={k} className="cell sprite" style={{ backgroundImage: `url(${bg})`, transform: `rotate(${rot}deg)` }} />;
              })
            ))}
          </div>
        </div>

        <aside className="longcat-level-panel">
          <div className="panel-title">{'\u0412\u044B\u0431\u043E\u0440 \u0443\u0440\u043E\u0432\u043D\u044F'}</div>
          <div className="level-grid">
            {Array.from({ length: LEVELS.length }).map((_, i) => (
              <button
                key={i}
                className={`level-btn ${i === levelIndex ? 'active' : ''}`}
                onClick={() => onSelectLevel(i)}
                aria-pressed={i === levelIndex}
                title={`Уровень ${i + 1}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </aside>

        {isMobile && (
          <>
            {levelsOpen && <div className="levels-drawer-backdrop" onClick={() => setLevelsOpen(false)} />}
            <div
              id="levels-drawer"
              className={`levels-drawer ${levelsOpen ? 'open' : ''}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="levels-drawer-title"
              ref={drawerRef}
              onKeyDown={onDrawerKeyDown}
            >
              <div className="levels-drawer-header">
                <h3 id="levels-drawer-title" tabIndex={-1} ref={drawerTitleRef}>{'\u0412\u044B\u0431\u043E\u0440 \u0443\u0440\u043E\u0432\u043D\u044F'}</h3>
                <button className="close-btn" onClick={() => setLevelsOpen(false)} aria-label="Фильтр уровней">✕</button>
              </div>
              <div className="levels-drawer-controls">
                <input
                  type="text"
                  placeholder="Фильтр..."
                  value={levelFilter}
                  onChange={e => setLevelFilter(e.target.value)}
                  aria-label="Фильтр уровней"
                />
              </div>
              <div className="levels-drawer-content">
                <div className="level-grid">
                  {Array.from({ length: LEVELS.length }).map((_, i) => {
                    const label = String(i + 1);
                    if (levelFilter && !label.includes(levelFilter.trim())) return null;
                    return (
                      <button
                        key={i}
                        className={`level-btn ${i === levelIndex ? 'active' : ''}`}
                        onClick={() => onSelectLevel(i)}
                        aria-pressed={i === levelIndex}
                        title={`Уровень ${i + 1}`}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            
          </>
        )}
      </div>
      <div style={{ fontSize: '0.85rem', color: '#666' }}>Управление: стрелки/WASD или свайп/перетаскивание головы.</div>
    </div>
  );
}

  function angleForDir(d) {
    switch (d) {
      case 'right': return 0;
      case 'down': return 90;
      case 'left': return 180;
      case 'up': return 270;
      default: return 0;
    }
  }
