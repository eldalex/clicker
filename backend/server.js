const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for dev
app.use(cors());
// JSON body
app.use(express.json());

// ---- SQLite setup ----
const DATA_DIR = process.env.DB_DIR || path.join(__dirname, 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'game.db');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(DB_PATH);

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  game_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  version INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, game_id)
);
`);

const stmtInsertUser = db.prepare('INSERT OR IGNORE INTO users(name) VALUES (?)');
const stmtGetUser = db.prepare('SELECT id FROM users WHERE name = ?');
const stmtGetScore = db.prepare(
  `SELECT s.score, s.version FROM scores s JOIN users u ON s.user_id = u.id
   WHERE u.name = ? AND s.game_id = ?`
);
const stmtUpsertScore = db.prepare(
  `INSERT INTO scores(user_id, game_id, score, version)
   VALUES (?, ?, ?, 0)
   ON CONFLICT(user_id, game_id)
   DO UPDATE SET score=excluded.score, version=scores.version+1, updated_at=CURRENT_TIMESTAMP`
);
const stmtTopScoresByGame = db.prepare(
  `SELECT u.name AS name, s.score AS score
   FROM scores s JOIN users u ON s.user_id = u.id
   WHERE s.game_id = ?
   ORDER BY s.score DESC, u.name ASC
   LIMIT 100`
);

// ---- In-memory load_token store ----
// key: `${user}\u0000${game}` -> { token, ts }
const loadTokens = new Map();
const tokenKey = (user, game) => `${user}\u0000${game}`;
const genToken = (user, game) => `${user}:${game}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

// Cleanup old tokens periodically (10 min TTL)
const TOKEN_TTL_MS = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of loadTokens.entries()) {
    if (now - v.ts > TOKEN_TTL_MS) loadTokens.delete(k);
  }
}, 5 * 60 * 1000).unref?.();

// ---- API ----

// GET single player score for a game, also issues a load_token
// Query: user, game
app.get('/api/score', (req, res) => {
  const user = (req.query.user || '').toString().trim();
  const game = (req.query.game || 'clicker').toString().trim();
  if (!user || !game) return res.status(400).json({ error: 'user and game are required' });

  const token = genToken(user, game);
  loadTokens.set(tokenKey(user, game), { token, ts: Date.now() });

  // Ensure user exists
  stmtInsertUser.run(user);
  const row = stmtGetScore.get(user, game);
  res.json({ score: row ? row.score : null, version: row ? row.version : 0, load_token: token });
});

// POST save score with required load_token
// Body: { user, game, score, load_token }
app.post('/api/score', (req, res) => {
  const { user, game = 'clicker', score, load_token } = req.body || {};
  if (typeof user !== 'string' || !user.trim() || typeof score !== 'number') {
    return res.status(400).json({ error: 'Invalid request' });
  }
  const expected = loadTokens.get(tokenKey(user, game));
  if (!expected || expected.token !== load_token) {
    return res.status(409).json({ error: 'Invalid or expired load_token' });
  }

  // Upsert
  stmtInsertUser.run(user);
  const u = stmtGetUser.get(user);
  stmtUpsertScore.run(u.id, game, Math.floor(score));
  // one-time token
  loadTokens.delete(tokenKey(user, game));

  // Return updated leaderboard for this game (for convenience)
  const gameId = game || 'clicker';
  const entries = stmtTopScoresByGame.all(gameId);
  res.json(entries);
});

// GET leaderboard for a game (default clicker) – keeps compatibility with existing frontend
app.get('/api/scores', (req, res) => {
  const game = (req.query.game || 'clicker').toString().trim();
  const entries = stmtTopScoresByGame.all(game);
  res.json(entries);
});

// Static serve built frontend
app.use(express.static(path.join(__dirname, 'build')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`SQLite DB: ${DB_PATH}`);
});

