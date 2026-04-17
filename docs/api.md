# API

Backend хранит рекорды мини-игр и выдаёт короткоживущий токен загрузки перед сохранением результата.

## Рекорды и токены загрузки

- `GET /api/score?user=<name>&game=<id>`: создаёт пользователя при первом обращении, возвращает `{ score, version, load_token }`. Токен обязателен для последующего сохранения и действует кратковременно.
- `POST /api/score` JSON: `{ user, game, score, load_token }` - сохраняет рекорд (upsert по `(user, game)`), инкрементирует версию. При неверном или просроченном токене отвечает `409`.
- `GET /api/scores?game=<id>`: топ-таблица для игры. По умолчанию используется `clicker`.

## Пример cURL

Получить токен:

```bash
curl 'http://localhost:3000/api/score?user=Alex&game=clicker'
```

Сохранить:

```bash
curl -X POST 'http://localhost:3000/api/score' \
  -H 'Content-Type: application/json' \
  -d '{"user":"Alex","game":"clicker","score":123,"load_token":"<скопируй из GET>"}'
```

Проверить топ:

```bash
curl 'http://localhost:3000/api/scores?game=clicker'
```

## Локальная база

SQLite создаётся автоматически в `backend/data/game.db`.

Путь можно переопределить переменными окружения:

- `DB_DIR`
- `DB_PATH`
