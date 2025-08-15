import React, { useEffect, useRef, useState } from 'react';
import './styles.css';
import { useNumberMerge } from './useNumberMerge';

export default function NumberMergeGame({ playerName }) {
  const { grid, score, best, target, won, over, applyMove, restart, maxTile } = useNumberMerge();
  const [leaderboard, setLeaderboard] = useState([]);
  const touchRef = useRef(null);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      const k = e.key;
      let dir = null;
      if (k === 'ArrowLeft') dir = 'left';
      else if (k === 'ArrowRight') dir = 'right';
      else if (k === 'ArrowUp') dir = 'up';
      else if (k === 'ArrowDown') dir = 'down';
      if (dir) { applyMove(dir); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [applyMove]);

  const onTouchStart = (e) => {
    const t = e.touches && e.touches[0];
    if (!t) return;
    touchRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e) => {
    if (!touchRef.current) return;
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchRef.current.x;
    const dy = t.clientY - touchRef.current.y;
    touchRef.current = null;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (Math.max(ax, ay) < 20) return;
    const dir = ax >= ay ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    applyMove(dir);
  };

  // fetch leaderboard on mount and after saves
  useEffect(() => {
    fetch('/api/scores?game=number-merge').then(r => r.json()).then(setLeaderboard).catch(() => {});
  }, []);

  // auto-save best score and max tile
  useEffect(() => {
    const user = (playerName || '').trim();
    if (!user) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const getRes = await fetch(`/api/score?user=${encodeURIComponent(user)}&game=number-merge`);
        const getData = await getRes.json();
        const token = getData?.load_token;
        if (!token) return;
        const res = await fetch('/api/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user, game: 'number-merge', score: best, load_token: token, meta: { max_tile: maxTile } })
        });
        if (res.ok) {
          fetch('/api/scores?game=number-merge').then(r => r.json()).then(setLeaderboard).catch(() => {});
        }
      } catch (_) {}
    }, 600);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [playerName, best, maxTile]);

  return (
    <div className="nm-wrap">
      <h2>2048</h2>
      <div className="nm-top">
        <div className="nm-info">
          <div>Очки: {score}</div>
          <div>Рекорд: {best}</div>
          <div>Макс тайл: {maxTile}</div>
        </div>
        <button onClick={restart}>Новая игра</button>
      </div>
      {(won || over) && (
        <div className="nm-status">
          {won ? 'Победа! Собран 2048.' : 'Ходов нет. Проигрыш.'}
        </div>
      )}
      <div
        className="nm-board"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => (touchRef.current = null)}
      >
        {grid.map((row, r) =>
          row.map((v, c) => (
            <div key={`${r}-${c}`} className={`nm-cell v${v || 2}`}>
              {v ? <>🐱 {v}</> : ''}
            </div>
          ))
        )}
      </div>
      <div className="nm-tutorial">
        Управление: стрелки клавиатуры и свайпы. Объединяй одинаковых 🐱, чтобы удваивать число. Достигни цели!
      </div>
      <div className="leaderboard" style={{ width: '100%', maxWidth: 420 }}>
        <h3>Таблица лидеров</h3>
        <table style={{ width: '100%' }}>
          <thead>
            <tr><th>#</th><th>Имя</th><th>Очки</th><th>Макс тайл</th></tr>
          </thead>
          <tbody>
            {leaderboard.map((e, i) => {
              let mt = '';
              try { mt = e.meta ? (JSON.parse(e.meta)?.max_tile ?? '') : ''; } catch (_) {}
              return (
                <tr key={e.name + i}><td>{i + 1}</td><td>{e.name}</td><td>{e.score}</td><td>{mt}</td></tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
