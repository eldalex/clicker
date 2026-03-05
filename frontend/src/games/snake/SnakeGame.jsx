import React, { useEffect, useMemo, useRef, useState } from 'react';
import './snake.css';
import {
  GRID_SIZE,
  BASE_TICK_MS,
  createInitialSnake,
  isOppositeDirection,
  randomFoodCell,
  stepSnake,
} from './engine';

const CELL = 20;
const CANVAS_SIZE = GRID_SIZE * CELL;

function keyToDir(key) {
  if (key === 'ArrowUp' || key === 'w' || key === 'W') return 'up';
  if (key === 'ArrowDown' || key === 's' || key === 'S') return 'down';
  if (key === 'ArrowLeft' || key === 'a' || key === 'A') return 'left';
  if (key === 'ArrowRight' || key === 'd' || key === 'D') return 'right';
  return null;
}

function createNewGame() {
  const snake = createInitialSnake();
  return {
    snake,
    dir: 'right',
    food: randomFoodCell(snake, GRID_SIZE),
    score: 0,
    speedMs: BASE_TICK_MS,
    gameOver: false,
  };
}

export default function SnakeGame() {
  const canvasRef = useRef(null);
  const touchStartRef = useRef(null);
  const [game, setGame] = useState(() => createNewGame());
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);

  const dirRef = useRef(game.dir);
  useEffect(() => { dirRef.current = game.dir; }, [game.dir]);

  const level = useMemo(() => 1 + Math.floor(game.score / 5), [game.score]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === ' ') {
        if (!started || game.gameOver) return;
        setPaused((v) => !v);
        e.preventDefault();
        return;
      }

      const next = keyToDir(e.key);
      if (!next || !started || paused || game.gameOver) return;

      const curr = dirRef.current;
      if (next === curr || isOppositeDirection(curr, next)) return;

      setGame((prev) => ({ ...prev, dir: next }));
      e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [started, paused, game.gameOver]);

  useEffect(() => {
    if (!started || paused || game.gameOver) return;
    const t = setInterval(() => {
      setGame((prev) => stepSnake(prev, GRID_SIZE));
    }, game.speedMs);
    return () => clearInterval(t);
  }, [started, paused, game.gameOver, game.speedMs]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.fillStyle = '#f6efe2';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      const p = i * CELL;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, CANVAS_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(CANVAS_SIZE, p);
      ctx.stroke();
    }

    if (game.food) {
      ctx.fillStyle = '#d94b3d';
      ctx.beginPath();
      ctx.arc(game.food.x * CELL + CELL / 2, game.food.y * CELL + CELL / 2, CELL * 0.34, 0, Math.PI * 2);
      ctx.fill();
    }

    game.snake.forEach((cell, idx) => {
      ctx.fillStyle = idx === 0 ? '#2b6a4a' : '#3f8a61';
      ctx.fillRect(cell.x * CELL + 1, cell.y * CELL + 1, CELL - 2, CELL - 2);
    });

    if (!started || paused || game.gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px Segoe UI';
      if (!started) ctx.fillText('Нажми Start', CANVAS_SIZE / 2, CANVAS_SIZE / 2);
      else if (game.gameOver) ctx.fillText('Game Over', CANVAS_SIZE / 2, CANVAS_SIZE / 2);
      else ctx.fillText('Пауза', CANVAS_SIZE / 2, CANVAS_SIZE / 2);
    }
  }, [game, started, paused]);

  const applyDirection = (next) => {
    if (!next || !started || paused || game.gameOver) return;
    const curr = dirRef.current;
    if (next === curr || isOppositeDirection(curr, next)) return;
    setGame((prev) => ({ ...prev, dir: next }));
  };

  const onTouchStart = (e) => {
    const t = e.touches && e.touches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    e.preventDefault();
  };

  const onTouchMove = (e) => {
    const start = touchStartRef.current;
    if (!start) return;
    const t = e.touches && e.touches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (Math.max(ax, ay) < 24) return;
    const next = ax >= ay ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    applyDirection(next);
    // Позволяет делать цепочки поворотов без отрыва пальца
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    e.preventDefault();
  };

  const onTouchEnd = () => {
    touchStartRef.current = null;
  };

  const onStart = () => {
    if (!started) setStarted(true);
    if (game.gameOver) {
      setGame(createNewGame());
      setPaused(false);
      setStarted(true);
    }
  };

  const onRestart = () => {
    setGame(createNewGame());
    setPaused(false);
    setStarted(true);
  };

  return (
    <div className="snake-wrap">
      <h2>Snake</h2>

      <div className="snake-panel">
        <div>Score: {game.score}</div>
        <div>Level: {level}</div>
        <div>Speed: {Math.round(1000 / game.speedMs)} t/s</div>
      </div>

      <div className="snake-actions">
        <button onClick={onStart}>Start</button>
        <button onClick={onRestart}>Restart</button>
      </div>

      <div className="snake-hint">
        Управление: стрелки/WASD. Пауза: Space. Стены смертельны.
      </div>

      <div className="snake-play-area touch-game-surface">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="snake-canvas"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={() => { touchStartRef.current = null; }}
        />
      </div>
    </div>
  );
}
