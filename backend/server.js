const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Включаем CORS (для режима разработки, когда фронт и бек на разных портах)
app.use(cors());

// Middleware для парсинга JSON-тел запроса
app.use(express.json());

// Хранилище рекордов в памяти: { имя: лучший_результат }
const leaderboard = {};

// Маршрут GET /api/scores – возвращает отсортированный список рекордов
app.get('/api/scores', (req, res) => {
  // Преобразуем словарь в массив записей
  const entries = Object.keys(leaderboard).map(name => ({
    name,
    score: leaderboard[name]
  }));
  // Сортируем по убыванию очков
  entries.sort((a, b) => b.score - a.score);
  res.json(entries);
});

// Маршрут POST /api/score – получает имя и результат игрока, обновляет таблицу
app.post('/api/score', (req, res) => {
  const { name, score } = req.body;
  if (typeof name !== 'string' || typeof score !== 'number') {
    return res.status(400).send('Invalid request');
  }
  const trimmedName = name.trim();
  if (!trimmedName) {
    return res.status(400).send('Name is required');
  }
  // Обновляем рекорд для данного имени, если он выше текущего
  if (!leaderboard[trimmedName] || score > leaderboard[trimmedName]) {
    leaderboard[trimmedName] = score;
  }
  // Отправляем обновлённый список рекордов в ответе
  const entries = Object.keys(leaderboard).map(n => ({ name: n, score: leaderboard[n] }));
  entries.sort((a, b) => b.score - a.score);
  res.json(entries);
});

// Если приложение запущено в продакшене, обслуживаем статические файлы фронтенда
app.use(express.static(path.join(__dirname, 'build')));
// Обработка маршрутов, не относящихся к API, возврат index.html для поддержки маршрутизации фронтенда
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
