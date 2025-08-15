import { describe, it, expect } from 'vitest';
import { createEmptyGrid, slideLeft, slideRight, slideUp, slideDown, hasMoves } from './engine';

describe('number-merge engine', () => {
  it('merges equal tiles once per row', () => {
    const g = createEmptyGrid();
    g[0] = [2, 2, 0, 0];
    const { grid, scoreGain, moved } = slideLeft(g);
    expect(grid[0][0]).toBe(4);
    expect(grid[0][1]).toBe(0);
    expect(scoreGain).toBe(4);
    expect(moved).toBe(true);
  });

  it('prevents double merge in one move', () => {
    const g = createEmptyGrid();
    g[0] = [2, 2, 2, 0];
    const { grid, scoreGain } = slideLeft(g);
    expect(grid[0]).toEqual([4, 2, 0, 0]);
    expect(scoreGain).toBe(4);
  });

  it('no movement when grid unchanged', () => {
    const g = createEmptyGrid();
    g[0] = [2, 4, 8, 16];
    const { moved } = slideLeft(g);
    expect(moved).toBe(false);
  });

  it('hasMoves false on full blocked grid', () => {
    const g = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(hasMoves(g)).toBe(false);
  });
});

