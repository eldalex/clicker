# Clicker Games

Небольшой сайт с браузерными мини-играми, таблицами рекордов и простым backend API.

## Что внутри

- React/Vite frontend.
- Express backend.
- SQLite для локального хранения рекордов.
- Несколько мини-игр в одном интерфейсе.
- Dockerfile для сборки единого образа.

## Игры

- `Clicker`
- `Match3`
- `Longcat`
- `Match-Path`
- `Number Merge`
- `Snake`
- `Keyboard Invaders`

## Локальный запуск

Backend:

```bash
cd backend
npm install
npm start
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

По умолчанию backend слушает `3000`, а Vite запускает frontend dev server отдельно.

## Docker

Сборка:

```bash
docker build -t clicker .
```

Запуск:

```bash
docker run -p 3000:3000 clicker
```

## Тесты

```bash
cd frontend
npm test
```
