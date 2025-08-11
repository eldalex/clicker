// Набор уровней Longcat: размеры, стены и старт
// Координаты: x в [0..w-1], y в [0..h-1]
// Поддержка гибкого редактирования: можно задать либо список стен, либо карту символов.
// Символы карты: '#' — стена, '.' — пусто, 'S' — старт кота.

function fromMap(map) {
  const h = map.length;
  const w = map[0]?.length || 0;
  const walls = [];
  let start = null;
  for (let y = 0; y < h; y++) {
    const row = map[y];
    if (row.length !== w) throw new Error('Нерегулярная ширина строк карты уровня');
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === '#') walls.push([x, y]);
      else if (ch === 'S') start = [x, y];
    }
  }
  return { w, h, walls, start };
}

// Longcat: 5 уровней по скринам (минимальные размеры + явный периметр)
export const LEVELS = [
  // L0 — 3x3, кот в центре
  (() => {
    return fromMap([
      '...',
      '.S.',
      '...'
    ]);
  })(),

  // L1 — «пустая комната» (только периметр)
  (() => {
    {
    return fromMap([
	'######',
	'#....#',
	'#..S.#',
	'#.##.#',
	'#....#',
	'######'
    ]);
  })(),

  // L2 — «ступенька/вырез» в левом верхнем углу (форма комнаты как на скрине Level 2)
  (() => {
    const w = 11, h = 9;
    const walls = [];
    // общий периметр
    for (let x = 1; x < w - 1; x++) { walls.push([x, 0], [x, h - 1]); }
    for (let y = 1; y < h - 1; y++) { walls.push([0, y], [w - 1, y]); }
    // «ступенька» (внутрь комнаты): дорисовываем перемычки периметра
    // верхний участок вправо
    for (let x = 0; x <= 2; x++) walls.push([x, 2]);
    // вертикаль вниз
    for (let y = 0; y <= 2; y++) walls.push([2, y]);
    // получаем форму: сначала идём от (0,0) вправо, спускаемся на y=2, входим на x=2 и дальше вниз — как на скрине
    // (если хочешь другой масштаб «ступеньки» — скажи, подвинем x/y)
    return { w, h, walls };
  })(),

  // L3 — «горизонтальная балка» в середине комнаты
  (() => {
    const w = 10, h = 8;
    const walls = [];
    for (let x = 0; x < w; x++) { walls.push([x, 0], [x, h - 1]); }
    for (let y = 1; y < h - 1; y++) { walls.push([0, y], [w - 1, y]); }
    // балка от x=2 до x=w-3 на середине
    const yBar = Math.floor(h / 2);
    for (let x = 2; x <= w - 3; x++) walls.push([x, yBar]);
    return { w, h, walls };
  })(),

  // L4 — «кольцо-коридор» вокруг центрального квадрата + левый карман-старт
  // (внешний периметр с угловой нишей + остров внутри)
  (() => {
    const w = 12, h = 10;
    const walls = [];
    // внешний периметр, но с «карманом» слева (вырез 2×3)
    for (let x = 0; x < w; x++) { walls.push([x, 0], [x, h - 1]); }
    for (let y = 1; y < h - 1; y++) { walls.push([w - 1, y]); }
    // левая стенка с разрывом (карман y=3..5 открыт)
    for (let y = 1; y < h - 1; y++) {
      if (y < 3 || y > 5) walls.push([0, y]);
    }
    // верхняя кромка кармана
    for (let x = 0; x <= 2; x++) walls.push([x, 3]);
    // нижняя кромка кармана
    for (let x = 0; x <= 2; x++) walls.push([x, 5]);

    // центральный «остров» 4×4
    const ox = 4, oy = 3, ow = 4, oh = 4;
    for (let x = ox; x < ox + ow; x++) { walls.push([x, oy], [x, oy + oh - 1]); }
    for (let y = oy + 1; y < oy + oh - 1; y++) { walls.push([ox, y], [ox + ow - 1, y]); }

    return { w, h, walls };
  })(),

  // L5 — «шляпка» сверху (периметр с выступом) + два внутренних квадрата
  (() => {
    const w = 13, h = 9;
    const walls = [];
    // базовый прямоугольный периметр
    for (let x = 0; x < w; x++) { walls.push([x, 0], [x, h - 1]); }
    for (let y = 1; y < h - 1; y++) { walls.push([0, y], [w - 1, y]); }
    // верхний «выступ/шляпка» шириной 5 по центру
    const capW = 5, capY = 0, capX0 = Math.floor((w - capW) / 2);
    // вертикали шляпки
    for (let y = 0; y <= 2; y++) {
      walls.push([capX0, y], [capX0 + capW - 1, y]);
    }
    // горизонталь шляпки (крышка)
    for (let x = capX0; x < capX0 + capW; x++) walls.push([x, 2]);

    // два внутренних квадрата 2×2 (слева-низ и центр-право)
    const squares = [
      { x: 3, y: 4 },  // левый
      { x: 8, y: 3 },  // правый
    ];
    for (const { x: sx, y: sy } of squares) {
      for (let x = sx; x < sx + 2; x++) { walls.push([x, sy], [x, sy + 1]); }
      for (let y = sy; y < sy + 2; y++) { walls.push([sx, y], [sx + 1, y]); }
    }

    return { w, h, walls };
  })(),
];

