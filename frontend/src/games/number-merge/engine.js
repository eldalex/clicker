export const GRID_SIZE = 4;

export function createEmptyGrid(size = GRID_SIZE) {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

export function cloneGrid(grid) {
  return grid.map(row => row.slice());
}

export function randomEmptyCell(grid) {
  const empties = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] === 0) empties.push([r, c]);
    }
  }
  if (empties.length === 0) return null;
  return empties[Math.floor(Math.random() * empties.length)];
}

export function spawnRandom(grid) {
  const next = cloneGrid(grid);
  const cell = randomEmptyCell(next);
  if (!cell) return next;
  const [r, c] = cell;
  next[r][c] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function compressAndMergeLine(line) {
  const nums = line.filter(v => v !== 0);
  let scoreGain = 0;
  const out = [];
  for (let i = 0; i < nums.length; i++) {
    if (i < nums.length - 1 && nums[i] === nums[i + 1]) {
      const merged = nums[i] * 2;
      out.push(merged);
      scoreGain += merged;
      i++;
    } else {
      out.push(nums[i]);
    }
  }
  while (out.length < line.length) out.push(0);
  return { out, scoreGain };
}

function transpose(grid) {
  const size = grid.length;
  const res = createEmptyGrid(size);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) res[c][r] = grid[r][c];
  }
  return res;
}

function reverseRows(grid) {
  return grid.map(row => row.slice().reverse());
}

function slideLeftOnce(grid) {
  const size = grid.length;
  const out = createEmptyGrid(size);
  let moved = false;
  let scoreGain = 0;
  for (let r = 0; r < size; r++) {
    const { out: merged, scoreGain: gain } = compressAndMergeLine(grid[r]);
    scoreGain += gain;
    out[r] = merged;
    if (!moved && merged.some((v, i) => v !== grid[r][i])) moved = true;
  }
  return { grid: out, moved, scoreGain };
}

export function slideLeft(grid) {
  return slideLeftOnce(grid);
}

export function slideRight(grid) {
  const reversed = reverseRows(grid);
  const step = slideLeftOnce(reversed);
  return { grid: reverseRows(step.grid), moved: step.moved, scoreGain: step.scoreGain };
}

export function slideUp(grid) {
  const t = transpose(grid);
  const step = slideLeftOnce(t);
  return { grid: transpose(step.grid), moved: step.moved, scoreGain: step.scoreGain };
}

export function slideDown(grid) {
  const t = transpose(grid);
  const step = slideRight(t);
  return { grid: transpose(step.grid), moved: step.moved, scoreGain: step.scoreGain };
}

export function hasMoves(grid) {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] === 0) return true;
    }
  }
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const v = grid[r][c];
      if (r + 1 < grid.length && grid[r + 1][c] === v) return true;
      if (c + 1 < grid.length && grid[r][c + 1] === v) return true;
    }
  }
  return false;
}

export function hasReachedTarget(grid, target) {
  let max = 0;
  for (const row of grid) for (const v of row) if (v > max) max = v;
  return max >= target;
}

