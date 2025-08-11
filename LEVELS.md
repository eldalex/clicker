Уровни: формат и загрузка

Основная идея — хранить уровни в JSON с явной легендой (какой символ означает какую клетку), стартовой сеткой и стартовой позицией кота.

- size: размеры уровня (width, height)
- legend: соответствие символа типу клетки ("wall" или "empty")
- tiles: массив строк длиной height, каждая строка длиной width
- cat_start: координаты кота [x, y], 0,0 — левый верхний угол

Пример (3×3, кот в центре):

{
  "name": "Level 1",
  "size": { "width": 3, "height": 3 },
  "legend": { "#": "wall", ".": "empty" },
  "tiles": [
    "...",
    "...",
    "..."
  ],
  "cat_start": [1, 1]
}

Загрузка уровня в коде Python:

from level_loader import load_level
level = load_level("levels/level1.json")

# Доступ к данным
width, height = level.width, level.height
cx, cy = level.cat_start
is_wall_center = level.is_wall(cx, cy)

Правила:
- Кот не может начинать на стене (валидатор выдаст ошибку)
- Все строки в tiles должны иметь длину width, их количество — height
- Все символы в tiles должны быть описаны в legend

Редактирование уровня:
- Меняйте символы в tiles согласно legend
- Меняйте cat_start на желаемые координаты (x, y)

