// frontend/src/App.jsx
import React, { useState, useRef, useEffect } from 'react';
import Match3 from './Match3';
import LongcatGame from './games/longcat/LongcatGame';

const catImages = [
  '/cat1.png',
  '/cat2.png',
  '/cat3.png',
  '/cat4.png',
  '/cat5.png'
];

const achievementsList = [
  { id: 'click_1', text: 'Первый клик!', condition: stats => stats.score >= 1 },
  { id: 'click_100', text: '100 очков!', condition: stats => stats.score >= 100 },
  { id: 'click_200', text: '200 очков!', condition: stats => stats.score >= 200 },
  { id: 'cps_5', text: '5 кликов/сек', condition: stats => stats.maxCPS >= 5 },
  { id: 'cps_10', text: '10 кликов/сек', condition: stats => stats.maxCPS >= 10 }
];

const playSound = (src) => {
  const audio = new Audio(src);
  audio.play();
};

function App() {
  const [selectedGame, setSelectedGame] = useState(null); // 'clicker' | 'match3'
  const [name, setName] = useState('');
  const [started, setStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [autoClickers, setAutoClickers] = useState(0);
  const [maxCPS, setMaxCPS] = useState(0);
  const [unlocked, setUnlocked] = useState(new Set());
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadToken, setLoadToken] = useState(null);
  const clickTimesRef = useRef([]);
  const [boomText, setBoomText] = useState(null);
  const [rageStart, setRageStart] = useState(null);
  const [rageActive, setRageActive] = useState(false);
  const [rageProgress, setRageProgress] = useState(0);
  const [bonusClicks, setBonusClicks] = useState([]);
  const [rageEffect, setRageEffect] = useState(false);
  const [calmEffect, setCalmEffect] = useState(false);

  const [targetVisible, setTargetVisible] = useState(false);
  const [targetPos, setTargetPos] = useState({ x: 0, y: 0 });
  const gameRef = useRef(null);
  const targetMoveRef = useRef(null);
  const targetHideRef = useRef(null);

  const [imageIndex, setImageIndex] = useState(0);
  const clickTimerRef = useRef(null);
  const lastClickTimeRef = useRef(Date.now());
  const activeClickDurationRef = useRef(0);

  // Prefill name from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('player_name') || localStorage.getItem('playerName');
      if (saved && typeof saved === 'string') setName(saved);
    } catch (_) {}
  }, []);

  // ����-����� ��� ������� ��� ������ � ������� �����
  useEffect(() => {
    if (selectedGame === 'clicker' && name.trim() && !started) {
      startGame();
    }
  }, [selectedGame, name]);

  // Save progress on change
  useEffect(() => {
    if (!started) return;
    localStorage.setItem('playerName', name);
    localStorage.setItem('player_name', name);
    localStorage.setItem('score', score);
    localStorage.setItem('coins', coins);
    localStorage.setItem('autoClickers', autoClickers);
    localStorage.setItem('unlocked', JSON.stringify(Array.from(unlocked)));
  }, [name, score, coins, autoClickers, unlocked, started]);

  useEffect(() => {
    fetch('/api/scores?game=' + encodeURIComponent(selectedGame || 'clicker'))
      .then(res => res.json()).then(setLeaderboard).catch(() => {});
  }, [selectedGame, started]);

  // Fetch load_token after starting (name entered) for the selected game
  useEffect(() => {
    if (!started) return;
    const user = (name || '').trim();
    const game = selectedGame || 'clicker';
    if (!user) return;
    fetch(`/api/score?user=${encodeURIComponent(user)}&game=${encodeURIComponent(game)}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.load_token) setLoadToken(data.load_token);
        if (data && typeof data.score === 'number') {
          setScore(prev => Math.max(prev, data.score));
        }
      })
      .catch(() => {});
  }, [started, name, selectedGame]);

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

  useEffect(() => {
    if (!started || autoClickers === 0) return;
    const interval = setInterval(() => {
      addPoints(autoClickers);
    }, 1000);
    return () => clearInterval(interval);
  }, [autoClickers, started]);

  useEffect(() => {
    if (!started) return;

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

    const interval = setInterval(showTarget, 60000);

    return () => {
      clearInterval(interval);
      clearInterval(targetMoveRef.current);
      clearTimeout(targetHideRef.current);
    };
  }, [started]);

  const startGame = () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const savedName = localStorage.getItem('player_name') || localStorage.getItem('playerName');
    if (savedName === trimmed) {
      const savedScore = parseInt(localStorage.getItem('score'), 10);
      if (!isNaN(savedScore)) {
        setScore(savedScore);
      }
      const savedCoins = parseInt(localStorage.getItem('coins'), 10);
      if (!isNaN(savedCoins)) {
        setCoins(savedCoins);
      }
      const savedClickers = parseInt(localStorage.getItem('autoClickers'), 10);
      if (!isNaN(savedClickers)) {
        setAutoClickers(savedClickers);
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
      setCoins(0);
      setAutoClickers(0);
      setUnlocked(new Set());
    }

    setStarted(true);
  };

  const resetToSelector = () => {
    setStarted(false);
    setSelectedGame(null);
  };

  const getCatImage = () => {
    return catImages[imageIndex];
  };

  const addPoints = (amount) => {
    setScore(prevScore => {
      const newScore = prevScore + amount;

      setCoins(prevCoins => prevCoins + amount);

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
        setRageProgress(Math.min(duration / 10000 * 100, 100));
        if (!rageActive && duration >= 10000) {
          setRageActive(true);
          setRageEffect(true);
          addPoints(100);
          playSound('/fanfare.mp3');
          setBoomText('&#1044;&#1080;&#1082;&#1086;&#1089;&#1090;&#1100;!');

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

  const handleTargetClick = () => {
    addPoints(50);
    setTargetVisible(false);
    clearInterval(targetMoveRef.current);
    clearTimeout(targetHideRef.current);
  };

  const submitScore = () => {
    const user = (name || '').trim();
    const game = selectedGame || 'clicker';
    if (!user) return;
    fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, game, score, load_token: loadToken })
    })
      .then(async res => {
        if (res.status === 409) {
          // Try to refresh token silently for next attempt
          try {
            const fresh = await fetch(`/api/score?user=${encodeURIComponent(user)}&game=${encodeURIComponent(game)}`).then(r => r.json());
            if (fresh && fresh.load_token) setLoadToken(fresh.load_token);
          } catch (e) {}
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

  // ��� �������� �� ��������� �������� (��� �������������� ������)

  return (
    <div className="container">
      {!selectedGame ? (
        <div className="start">
          <h2>&#1042;&#1099;&#1073;&#1086;&#1088; &#1080;&#1075;&#1088;&#1099;</h2>
          <div style={{ marginBottom: '0.5rem' }}>
            &#1048;&#1084;&#1103;: <input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="game-choices">
            <button className="game-card" onClick={() => setSelectedGame('clicker')}>&#1050;&#1083;&#1080;&#1082;&#1077;&#1088;</button>
            <button className="game-card" onClick={() => setSelectedGame('match3')}>Match3</button>
            <button className="game-card" onClick={() => setSelectedGame('longcat')}>Longcat</button>
          </div>
        </div>
      ) : selectedGame === 'match3' ? (
        <div>
          <div style={{ textAlign: 'left', marginBottom: '0.5rem' }}>
            <button onClick={resetToSelector}>&#1053;&#1072;&#1079;&#1072;&#1076; &#1082; &#1074;&#1099;&#1073;&#1086;&#1088;&#1091; &#1080;&#1075;&#1088;&#1099;</button>
          </div>
          <Match3 />
        </div>
      ) : selectedGame === 'longcat' ? (
        <div>
          <div style={{ textAlign: 'left', marginBottom: '0.5rem' }}>
            <button onClick={resetToSelector}>&#1053;&#1072;&#1079;&#1072;&#1076; &#1082; &#1074;&#1099;&#1073;&#1086;&#1088;&#1091; &#1080;&#1075;&#1088;&#1099;</button>
          </div>
          <LongcatGame />
        </div>
      ) : (
        <div className="game-wrapper">
        <div className="game" ref={gameRef}>
          <div style={{ textAlign: 'left', marginBottom: '0.5rem' }}>
            <button onClick={resetToSelector}>&#1053;&#1072;&#1079;&#1072;&#1076; &#1082; &#1074;&#1099;&#1073;&#1086;&#1088;&#1091; &#1080;&#1075;&#1088;&#1099;</button>
          </div>
          <h1>&#1044;&#1086;&#1073;&#1088;&#1086; &#1087;&#1086;&#1078;&#1072;&#1083;&#1086;&#1074;&#1072;&#1090;&#1100;, {name}!</h1>
          <div
            className="target"
            style={{
              left: `${targetPos.x}px`,
              top: `${targetPos.y}px`,
              display: targetVisible ? 'block' : 'none'
            }}
            onClick={handleTargetClick}
          />
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
                +1 ����
              </div>
            ))}
            {calmEffect && (
              <div className="zzz-bubble">Zzz...</div>
            )}
          </div>
          <div>&#1054;&#1095;&#1082;&#1080;: {score}</div>
          <div>&#1052;&#1072;&#1082;&#1089; CPS: {maxCPS}</div>

          <div className="achievements">
            <h3>&#1044;&#1086;&#1089;&#1090;&#1080;&#1078;&#1077;&#1085;&#1080;&#1103;</h3>
            <ul>
              {achievementsList.map(ach => (
                <li key={ach.id}>{unlocked.has(ach.id) ? "✔" : ""} {ach.text}</li>
              ))}
            </ul>
          </div>

          <div className="leaderboard">
            <h3>&#1058;&#1072;&#1073;&#1083;&#1080;&#1094;&#1072; &#1083;&#1080;&#1076;&#1077;&#1088;&#1086;&#1074;</h3>
            <table>
              <thead>
                <tr><th>#</th><th>&#1048;&#1084;&#1103;</th><th>&#1054;&#1095;&#1082;&#1080;</th></tr>
              </thead>
              <tbody>
                {leaderboard.map((e, i) => (
                  <tr key={i}><td>{i + 1}</td><td>{e.name}</td><td>{e.score}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={submitScore} disabled={score === 0}>&#1054;&#1090;&#1087;&#1088;&#1072;&#1074;&#1080;&#1090;&#1100; &#1088;&#1077;&#1079;&#1091;&#1083;&#1100;&#1090;&#1072;&#1090;</button>
          </div>
          <div className="side-panel">
            <div>&#1052;&#1086;&#1085;&#1077;&#1090;&#1099;: {coins}</div>
            <div>&#1040;&#1074;&#1090;&#1086;&#1082;&#1083;&#1080;&#1082;&#1077;&#1088;&#1099;: {autoClickers}</div>
            <button onClick={buyClicker} disabled={coins < clickerCost}>&#1050;&#1091;&#1087;&#1080;&#1090;&#1100; &#1082;&#1083;&#1080;&#1082;&#1077;&#1088; ({clickerCost})</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;


























