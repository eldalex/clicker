// Набор уровней Longcat: размеры и стены (x,y)
// Координаты: x в [0..w-1], y в [0..h-1]

export const LEVELS = [
  // Уровень 1: пустое поле 14x10
  { w: 14, h: 10, walls: [] },

  // Уровень 2: рамка из стен с коридором
  (() => {
    const w = 16, h = 12;
    const walls = [];
    // Внутренняя рамка (оставим разрыв для входа/выхода)
    for (let x = 1; x < w - 1; x++) {
      if (x !== Math.floor(w / 2)) walls.push([x, 1]);
      if (x !== Math.floor(w / 2) - 1) walls.push([x, h - 2]);
    }
    for (let y = 2; y < h - 2; y++) {
      if (y !== Math.floor(h / 2)) walls.push([1, y]);
      if (y !== Math.floor(h / 2) - 1) walls.push([w - 2, y]);
    }
    return { w, h, walls };
  })(),

  // Уровень 3: простая зигзаг-решётка с проходами
  (() => {
    const w = 18, h = 12;
    const walls = [];
    for (let y = 2; y < h - 2; y += 2) {
      for (let x = 2; x < w - 2; x++) {
        if ((y % 4 === 0 && x % 5 !== 0) || (y % 4 === 2 && x % 5 !== 1)) {
          walls.push([x, y]);
        }
      }
    }
    // Добавим вертикальные проходы
    for (let y = 2; y < h - 2; y++) walls.push([0, y], [w - 1, y]); // боковые колонны (границы)
    // Уберём часть стен для гарантии проходимости коридорами
    const keep = new Set(['3,2','8,4','13,6']);
    return { w, h, walls: walls.filter(([x,y]) => !keep.has(`${x},${y}`)) };
  })(),
];

