import { describe, expect, it } from 'vitest';
import {
  createInitialSnake,
  isOppositeDirection,
  randomFoodCell,
  stepSnake,
  computeTickMs,
} from './engine';

describe('snake engine', () => {
  it('creates snake with length 3', () => {
    const s = createInitialSnake();
    expect(s).toHaveLength(3);
  });

  it('prevents opposite direction helper', () => {
    expect(isOppositeDirection('left', 'right')).toBe(true);
    expect(isOppositeDirection('up', 'left')).toBe(false);
  });

  it('spawns food not on snake', () => {
    const snake = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    const food = randomFoodCell(snake, 3, () => 0);
    expect(food).not.toEqual({ x: 0, y: 0 });
    expect(food).not.toEqual({ x: 1, y: 0 });
  });

  it('grows and scores when eating food', () => {
    const state = {
      snake: [{ x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }],
      dir: 'right',
      food: { x: 4, y: 3 },
      score: 0,
      speedMs: 180,
      gameOver: false,
    };
    const next = stepSnake(state, 20, () => 0.5);
    expect(next.score).toBe(1);
    expect(next.snake).toHaveLength(4);
  });

  it('ends game when hitting wall', () => {
    const state = {
      snake: [{ x: 19, y: 0 }, { x: 18, y: 0 }, { x: 17, y: 0 }],
      dir: 'right',
      food: { x: 5, y: 5 },
      score: 0,
      speedMs: 180,
      gameOver: false,
    };
    const next = stepSnake(state, 20, () => 0.5);
    expect(next.gameOver).toBe(true);
  });

  it('increases speed over score thresholds', () => {
    expect(computeTickMs(0)).toBeGreaterThan(computeTickMs(10));
  });
});
