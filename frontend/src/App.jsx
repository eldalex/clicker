// frontend/src/App.jsx
import React, { useState, useRef, useEffect } from 'react';

const catImages = [
  '/cat1.png',
  '/cat2.png',
  '/cat3.png',
  '/cat4.png',
  '/cat5.png'
];

const achievementsList = [
  { id: 'click_1', text: 'Первый мяу!', condition: stats => stats.score >= 1 },
  { id: 'click_100', text: '100 мяу!', condition: stats => stats.score >= 100 },
  { id: 'click_200', text: '200 мяу!', condition: stats => stats.score >= 200 },
  { id: 'cps_5', text: '5 кликов/сек', condition: stats => stats.maxCPS >= 5 },
  { id: 'cps_10', text: '10 кликов/сек', condition: stats => stats.maxCPS >= 10 }
];

const playSound = (src) => {
  const audio = new Audio(src);
  audio.play();
};

function App() {
  const [name, setName] = useState('');
  const [started, setStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [maxCPS, setMaxCPS] = useState(0);
  const [unlocked, setUnlocked] = useState(new Set());
  const [leaderboard, setLeaderboard] = useState([]);
  const clickTimesRef = useRef([]);
  const [boomText, setBoomText] = useState(null);
  const [rageStart, setRageStart] = useState(null);
  const [rageActive, setRageActive] = useState(false);
  const [rageProgress, setRageProgress] = useState(0);
  const [bonusClicks, setBonusClicks] = useState([]);
  const [rageEffect, setRageEffect] = useState(false);
  const [calmEffect, setCalmEffect] = useState(false);

  const [imageIndex, setImageIndex] = useState(0);
  const clickTimerRef = useRef(null);
  const lastClickTimeRef = useRef(Date.now());
  const activeClickDurationRef = useRef(0);

  // Save progress on change
  useEffect(() => {
    if (!started) return;
    localStorage.setItem('playerName', name);
    localStorage.setItem('score', score);
    localStorage.setItem('unlocked', JSON.stringify(Array.from(unlocked)));
  }, [name, score, unlocked, started]);

  useEffect(() => {
    fetch('/api/scores').then(res => res.json()).then(setLeaderboard);
  }, []);

  useEffect(() => {
    const decayInterval = setInterval(() => {
      const now = Date.now();
      const idleTime = now - lastClickTimeRef.current;
      if (idleTime >= 3000 && imageIndex > 0) {
        setImageIndex(prev => Math.max(prev - 1, 0));
        lastClickTimeRef.current = now;
        activeClickDurationRef.current = Math.max(activeClickDurationRef.current - 5000, 0);
        playSound('/purr.mp3');
        setCalmEffect(true);
        setTimeout(() => setCalmEffect(false), 1000);
      }
    }, 1000);

    return () => clearInterval(decayInterval);
  }, [imageIndex]);

  const startGame = () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const savedName = localStorage.getItem('playerName');
    if (savedName === trimmed) {
      const savedScore = parseInt(localStorage.getItem('score'), 10);
      if (!isNaN(savedScore)) {
        setScore(savedScore);
      }
      const savedUnlocked = localStorage.getItem('unlocked');
      if (savedUnlocked) {
        try {
          const parsed = JSON.parse(savedUnlocked);
          if (Array.isArray(parsed)) {
            setUnlocked(new Set(parsed));
          }
        } catch (e) {
          console.error('Failed to parse saved achievements', e);
        }
      }
    } else {
      setScore(0);
      setUnlocked(new Set());
    }

    setStarted(true);
  };

  const getCatImage = () => {
    return catImages[imageIndex];
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

    const newScore = score + 1;
    setScore(newScore);
    playSound('/meow.mp3');
    setBoomText(['+1', 'MEOW!', 'WOW'][Math.floor(Math.random() * 3)]);
    setTimeout(() => setBoomText(null), 500);

    const newUnlocked = new Set(unlocked);
    achievementsList.forEach(ach => {
      if (!newUnlocked.has(ach.id) && ach.condition({ score: newScore, maxCPS: cps })) {
        newUnlocked.add(ach.id);
        playSound('/fanfare.mp3');
      }
    });
    setUnlocked(newUnlocked);

    if (cps >= 6) {
      if (!rageStart) {
        setRageStart(now);
        setRageProgress(0);
      } else {
        const duration = now - rageStart;
        setRageProgress(Math.min(duration / 10000 * 100, 100));
        if (!rageActive && duration >= 10000) {
          setRageActive(true);
          setRageEffect(true);
          setScore(prev => prev + 100);
          playSound('/fanfare.mp3');
          setBoomText('🔥 ЯРОСТЬ!');

          let i = 0;
          const interval = setInterval(() => {
            setBonusClicks(prev => [
              ...prev,
              {
                id: Date.now() + i,
                x: Math.random() * 200 - 100,
                y: Math.random() * 200 - 100
              }
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

  const submitScore = () => {
    fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score })
    }).then(res => res.json()).then(setLeaderboard);
  };


  return (
    <div className="container">
      {!started ? (
        <div className="start">
          <h2>Имя:</h2>
          <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && startGame()} />
          <button onClick={startGame}>Играть</button>
        </div>
      ) : (
        <div className="game">
          <h1>Привет, {name}!</h1>
          <div className={`clicker-container ${rageEffect ? 'shake' : ''} ${calmEffect ? 'fade-glow' : ''}`}>
            <img
              src={getCatImage()}
              alt="Cat Clicker"
              className="clicker-img"
              onClick={handleClick}
            />
            {boomText && <div className="boom-text">{boomText}</div>}
            {rageProgress > 0 && (
              <div className="rage-bar">
                <div className="rage-fill" style={{ width: `${rageProgress}%` }} />
              </div>
            )}
            {bonusClicks.map(c => (
              <div
                key={c.id}
                className="bonus-click"
                style={{ left: `${50 + c.x}px`, top: `${50 + c.y}px` }}>
                +1 клик
              </div>
            ))}
            {calmEffect && (
              <div className="zzz-bubble">Zzz...</div>
            )}
          </div>
          <div>Очки: {score}</div>
          <div>Макс CPS: {maxCPS}</div>

          <div className="achievements">
            <h3>Достижения</h3>
            <ul>
              {achievementsList.map(ach => (
                <li key={ach.id}>{unlocked.has(ach.id) ? '✅' : '🔒'} {ach.text}</li>
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
      )}
    </div>
  );
}

export default App;

