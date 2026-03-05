export const GRID_SIZE = 20;
export const BASE_TICK_MS = 180;
export const MIN_TICK_MS = 80;
export const SPEEDUP_EVERY = 5;

export function createInitialSnake() {
  return [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
}

export function isOppositeDirection(a, b) {
  return (
    (a === 'up' && b === 'down') ||
    (a === 'down' && b === 'up') ||
    (a === 'left' && b === 'right') ||
    (a === 'right' && b === 'left')
  );
}

export function nextHead(head, dir) {
  if (dir === 'up') return { x: head.x, y: head.y - 1 };
  if (dir === 'down') return { x: head.x, y: head.y + 1 };
  if (dir === 'left') return { x: head.x - 1, y: head.y };
  return { x: head.x + 1, y: head.y };
}

export function isOutOfBounds(cell, size = GRID_SIZE) {
  return cell.x < 0 || cell.y < 0 || cell.x >= size || cell.y >= size;
}

export function cellKey(c) {
  return `${c.x},${c.y}`;
}

export function randomFoodCell(snake, size = GRID_SIZE, rng = Math.random) {
  const occupied = new Set(snake.map(cellKey));
  const free = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const k = `${x},${y}`;
      if (!occupied.has(k)) free.push({ x, y });
    }
  }
  if (free.length === 0) return null;
  return free[Math.floor(rng() * free.length)];
}

export function computeTickMs(score) {
  const level = Math.floor(score / SPEEDUP_EVERY);
  return Math.max(MIN_TICK_MS, BASE_TICK_MS - level * 10);
}

export function stepSnake(state, size = GRID_SIZE, rng = Math.random) {
  const { snake, dir, food, score } = state;
  const head = snake[0];
  const nh = nextHead(head, dir);
  const ate = food && nh.x === food.x && nh.y === food.y;

  if (isOutOfBounds(nh, size)) {
    return { ...state, gameOver: true };
  }

  const bodyToCheck = ate ? snake : snake.slice(0, -1);
  const hitSelf = bodyToCheck.some((c) => c.x === nh.x && c.y === nh.y);
  if (hitSelf) {
    return { ...state, gameOver: true };
  }

  const nextSnake = [nh, ...snake];
  if (!ate) nextSnake.pop();

  const nextScore = ate ? score + 1 : score;
  const nextFood = ate ? randomFoodCell(nextSnake, size, rng) : food;

  return {
    ...state,
    snake: nextSnake,
    food: nextFood,
    score: nextScore,
    speedMs: computeTickMs(nextScore),
    gameOver: false,
  };
}
