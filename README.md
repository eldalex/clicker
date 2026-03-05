+ Простенький кликер 
+ vpn притворяющийся кликером 
+ ansible playbook для развёртывания всего этого дела.


для работы надо заполнить параметры в ansible/group_vars/all.yml

+ domain - твой арендованный домен
+ trojan_password - придумай пароль для vpn
+ ansible_user/ansible_ssh_pass - креды твоего арендованного vps 
+ Дополнительно указать ip твоего VPS в inventory.ini

установка:
+ ansible-playbook playbook.yml

Клиент для андроида:
+ https://github.com/MetaCubeX/ClashMetaForAndroid/releases

Клиент для windows:
+ https://www.clashforwindows.net/

конфиг для clash в комплекте. 
<p>просто добавь правил по аналогии:</p>

1. Направлять в прокси - DOMAIN-SUFFIX,youtube.com,PROXY
2. Принудительно отправлять напрямки - DOMAIN-SUFFIX,2ip.ru,DIRECT

---

API: рекорды и токены загрузки
- GET `/api/score?user=<name>&game=<id>`: создаёт пользователя при первом обращении, возвращает `{ score, version, load_token }`. Токен обязателен для последующего сохранения и действует кратковременно.
- POST `/api/score` JSON: `{ user, game, score, load_token }` — сохраняет рекорд (upsert по `(user, game)`), инкрементирует версию. При неверном/просроченном токене отвечает 409.
- GET `/api/scores?game=<id>`: топ-таблица для игры (по умолчанию `clicker`).

Пример cURL
- Получить токен: `curl 'http://localhost:3000/api/score?user=Alex&game=clicker'`
- Сохранить: `curl -X POST 'http://localhost:3000/api/score' -H 'Content-Type: application/json' -d '{"user":"Alex","game":"clicker","score":123,"load_token":"<скопируй из GET>"}'`
- Проверить топ: `curl 'http://localhost:3000/api/scores?game=clicker'`

Локальный запуск (Node)
- Backend: `cd backend && npm install && npm start`
- БД: SQLite создаётся автоматически в `backend/data/game.db` (переопределите `DB_DIR`/`DB_PATH`).

Docker
- Сборка: `docker build -t clicker .`
- Запуск: `docker run -p 3000:3000 clicker`

---

Новые мини-игры
- `Snake`
  - Управление: стрелки или `WASD`
  - `Space` — пауза
  - Стены смертельны (выход за поле = поражение)
  - В UI: `Start`, `Restart`, `Score`, `Level`, `Speed`
- `Keyboard Invaders`
  - Печатайте первую «живую» букву слева направо
  - `P` — пауза
  - Пробел (`Space`) считается обычным символом фразы
  - Есть переключатель языка фраз: `EN`/`RU`
  - В UI: `Start`, `Restart`, `Score`, `Round`, `Misses`, `Accuracy`, `Speed`

Как открыть
- На стартовом экране (выбор игры) появились две новые карточки:
  - `Snake`
  - `Keyboard Invaders`

Тесты
- Во фронтенде добавлены unit-тесты для логики:
  - `frontend/src/games/snake/engine.test.js`
  - `frontend/src/games/keyboard-invaders/engine.test.js`
- Запуск: `cd frontend && npm test`
