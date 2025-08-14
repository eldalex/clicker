import React, { useEffect, useRef, useState } from 'react';

const catImages = ['/cat1.png', '/cat2.png', '/cat3.png', '/cat4.png', '/cat5.png'];

const achievementsList = [
  { id: 'click_1', text: 'Первый клик!', condition: stats => stats.score >= 1 },
  { id: 'click_100', text: '100 очков!', condition: stats => stats.score >= 100 },
  { id: 'click_200', text: '200 очков!', condition: stats => stats.score >= 200 },
  { id: 'cps_5', text: '5 кликов/сек', condition: stats => stats.maxCPS >= 5 },
  { id: 'cps_10', text: '10 кликов/сек', condition: stats => stats.maxCPS >= 10 }
];

const playSound = (src) => {
  try {
    const audio = new Audio(src);
    audio.play();
  } catch (_) {}
};

export default function ClickerGame({ name, onBack }) {
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [autoClickers, setAutoClickers] = useState(0);
  const [maxCPS, setMaxCPS] = useState(0);
  const [unlocked, setUnlocked] = useState(new Set());
  const [leaderboard, setLeaderboard] = useState([]);
  const [boomText, setBoomText] = useState(null);
  const [rageStart, setRageStart] = useState(null);
  const [rageActive, setRageActive] = useState(false);
  const [rageProgress, setRageProgress] = useState(0);
  const [bonusClicks, setBonusClicks] = useState([]);
  const [rageEffect, setRageEffect] = useState(false);
  const [calmEffect, setCalmEffect] = useState(false);
  const [targetVisible, setTargetVisible] = useState(false);
  const [targetPos, setTargetPos] = useState({ x: 0, y: 0 });
  const [imageIndex, setImageIndex] = useState(0);
  const [loadToken, setLoadToken] = useState(null);

  const gameRef = useRef(null);
  const targetMoveRef = useRef(null);
  const targetHideRef = useRef(null);
  const clickTimesRef = useRef([]);
  const lastClickTimeRef = useRef(Date.now());
  const activeClickDurationRef = useRef(0);

  // Инициализация из localStorage и получения токена/счёта
  useEffect(() => {
    const savedName = localStorage.getItem('player_name') || localStorage.getItem('playerName');
    if (savedName === name) {
      const s = parseInt(localStorage.getItem('score') || '0', 10);
      const c = parseInt(localStorage.getItem('coins') || '0', 10);
      const a = parseInt(localStorage.getItem('autoClickers') || '0', 10);
      setScore(isNaN(s) ? 0 : s);
      setCoins(isNaN(c) ? 0 : c);
      setAutoClickers(isNaN(a) ? 0 : a);
      const savedUnlocked = localStorage.getItem('unlocked');
      if (savedUnlocked) {
        try {
          const parsed = JSON.parse(savedUnlocked);
          if (Array.isArray(parsed)) setUnlocked(new Set(parsed));
        } catch (_) {}
      }
    }

    fetch('/api/scores?game=clicker').then(r => r.json()).then(setLeaderboard).catch(() => {});
    if (name && name.trim()) {
      fetch(`/api/score?user=${encodeURIComponent(name.trim())}&game=clicker`)
        .then(r => r.json())
        .then(data => {
          if (data && data.load_token) setLoadToken(data.load_token);
          if (typeof data?.score === 'number') setScore(prev => Math.max(prev, data.score));
        }).catch(() => {});
    }
  }, [name]);

  // Сохранение прогресса
  useEffect(() => {
    localStorage.setItem('playerName', name);
    localStorage.setItem('player_name', name);
    localStorage.setItem('score', String(score));
    localStorage.setItem('coins', String(coins));
    localStorage.setItem('autoClickers', String(autoClickers));
    localStorage.setItem('unlocked', JSON.stringify(Array.from(unlocked)));
  }, [name, score, coins, autoClickers, unlocked]);

  // Декремент состояния кота при простое
  useEffect(() => {
    const decay = setInterval(() => {
      const now = Date.now();
      const idle = now - lastClickTimeRef.current;
      if (idle >= 3000 && imageIndex > 0) {
        setImageIndex(v => Math.max(v - 1, 0));
        lastClickTimeRef.current = now;
        activeClickDurationRef.current = Math.max(activeClickDurationRef.current - 5000, 0);
        playSound('/purr.mp3');
        setCalmEffect(true);
        setTimeout(() => setCalmEffect(false), 1000);
      }
    }, 1000);
    return () => clearInterval(decay);
  }, [imageIndex]);

  // Автокликеры
  useEffect(() => {
    if (autoClickers === 0) return;
    const t = setInterval(() => addPoints(autoClickers), 1000);
    return () => clearInterval(t);
  }, [autoClickers]);

  // Появляющаяся цель
  useEffect(() => {
    const moveTarget = () => {
      if (!gameRef.current) return;
      const rect = gameRef.current.getBoundingClientRect();
      const x = Math.random() * (rect.width - 40);
      const y = Math.random() * (rect.height - 40);
      setTargetPos({ x, y });
    };
    const hideTarget = () => {
      setTargetVisible(false);
      clearInterval(targetMoveRef.current);
    };
    const showTarget = () => {
      setTargetVisible(true);
      moveTarget();
      targetMoveRef.current = setInterval(moveTarget, 1000);
      targetHideRef.current = setTimeout(hideTarget, 30000);
    };
    const iv = setInterval(showTarget, 60000);
    return () => {
      clearInterval(iv);
      clearInterval(targetMoveRef.current);
      clearTimeout(targetHideRef.current);
    };
  }, []);

  const getCatImage = () => catImages[imageIndex];

  const addPoints = (amount) => {
    setScore(prev => {
      const newScore = prev + amount;
      setCoins(c => c + amount);
      setUnlocked(prevUnlocked => {
        const updated = new Set(prevUnlocked);
        achievementsList.forEach(ach => {
          if (!updated.has(ach.id) && ach.condition({ score: newScore, maxCPS })) {
            updated.add(ach.id);
            playSound('/fanfare.mp3');
          }
        });
        return updated;
      });
      return newScore;
    });
  };

  const handleClick = () => {
    const now = Date.now();
    lastClickTimeRef.current = now;
    activeClickDurationRef.current += 100;
    if (activeClickDurationRef.current >= 5000 && imageIndex < catImages.length - 1) {
      setImageIndex(prev => prev + 1);
      activeClickDurationRef.current = 0;
    }
    clickTimesRef.current.push(now);
    while (clickTimesRef.current.length && clickTimesRef.current[0] < now - 1000) {
      clickTimesRef.current.shift();
    }
    const cps = clickTimesRef.current.length;
    if (cps > maxCPS) setMaxCPS(cps);

    addPoints(1);
    playSound('/meow.mp3');
    setBoomText(['+1', 'MEOW!', 'WOW'][Math.floor(Math.random() * 3)]);
    setTimeout(() => setBoomText(null), 500);

    if (cps >= 6) {
      if (!rageStart) {
        setRageStart(now);
        setRageProgress(0);
      } else {
        const duration = now - rageStart;
        setRageProgress(Math.min((duration / 10000) * 100, 100));
        if (!rageActive && duration >= 10000) {
          setRageActive(true);
          setRageEffect(true);
          addPoints(100);
          playSound('/fanfare.mp3');
          setBoomText('Дикость!');

          let i = 0;
          const interval = setInterval(() => {
            setBonusClicks(prev => [
              ...prev,
              { id: Date.now() + i, x: Math.random() * 200 - 100, y: Math.random() * 200 - 100 }
            ]);
            i++;
            if (i >= 100) {
              clearInterval(interval);
              setTimeout(() => {
                setBonusClicks([]);
                setRageEffect(false);
                setBoomText(null);
              }, 1000);
            }
          }, 10);

          setRageStart(null);
          setRageProgress(0);
        }
      }
    } else {
      setRageStart(null);
      setRageActive(false);
      setRageProgress(0);
    }
  };

  const handleTargetClick = () => {
    addPoints(50);
    setTargetVisible(false);
    clearInterval(targetMoveRef.current);
    clearTimeout(targetHideRef.current);
  };

  const submitScore = () => {
    const user = (name || '').trim();
    if (!user) return;
    fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, game: 'clicker', score, load_token: loadToken })
    })
      .then(async res => {
        if (res.status === 409) {
          try {
            const fresh = await fetch(`/api/score?user=${encodeURIComponent(user)}&game=clicker`).then(r => r.json());
            if (fresh && fresh.load_token) setLoadToken(fresh.load_token);
          } catch (_) {}
          throw new Error('Save rejected (load_token). Try again.');
        }
        return res.json();
      })
      .then(setLeaderboard)
      .catch(() => {});
  };

  const buyClicker = () => {
    const cost = 100 * Math.pow(2, autoClickers);
    if (coins >= cost) {
      setCoins(coins - cost);
      setAutoClickers(autoClickers + 1);
    }
  };

  const clickerCost = 100 * Math.pow(2, autoClickers);

  return (
    <div className="game-wrapper">
      <div className="game" ref={gameRef}>
        <div style={{ textAlign: 'left', marginBottom: '0.5rem' }}>
          <button onClick={onBack}>Назад к выбору игры</button>
        </div>
        <h1>Добро пожаловать, {name}!</h1>
        <div
          className="target"
          style={{ left: `${targetPos.x}px`, top: `${targetPos.y}px`, display: targetVisible ? 'block' : 'none' }}
          onClick={handleTargetClick}
        />
        <div className={`clicker-container ${rageEffect ? 'shake' : ''} ${calmEffect ? 'fade-glow' : ''}`}>
          <img src={getCatImage()} alt="Cat Clicker" className="clicker-img" onClick={handleClick} />
          {boomText && <div className="boom-text">{boomText}</div>}
          {rageProgress > 0 && (
            <div className="rage-bar">
              <div className="rage-fill" style={{ width: `${rageProgress}%` }} />
            </div>
          )}
          {bonusClicks.map(c => (
            <div key={c.id} className="bonus-click" style={{ left: `${50 + c.x}px`, top: `${50 + c.y}px` }}>
              +1 бонус
            </div>
          ))}
          {calmEffect && <div className="zzz-bubble">Zzz...</div>}
        </div>
        <div>Очки: {score}</div>
        <div>Макс CPS: {maxCPS}</div>

        <div className="achievements">
          <h3>Достижения</h3>
          <ul>
            {achievementsList.map(ach => (
              <li key={ach.id}>{unlocked.has(ach.id) ? '✔' : ''} {ach.text}</li>
            ))}
          </ul>
        </div>

        <div className="leaderboard">
          <h3>Таблица лидеров</h3>
          <table>
            <thead>
              <tr><th>#</th><th>Имя</th><th>Очки</th></tr>
            </thead>
            <tbody>
              {leaderboard.map((e, i) => (
                <tr key={i}><td>{i + 1}</td><td>{e.name}</td><td>{e.score}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <button onClick={submitScore} disabled={score === 0}>Отправить результат</button>
      </div>
      <div className="side-panel">
        <div>Монеты: {coins}</div>
        <div>Автокликеры: {autoClickers}</div>
        <button onClick={buyClicker} disabled={coins < clickerCost}>Купить кликер ({clickerCost})</button>
      </div>
    </div>
  );
}

