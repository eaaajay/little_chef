import { describe, expect, it } from 'vitest';
import { findPath, pointWalkable, type Rect } from '../src/pathfinding';

const obstacles: Rect[] = [{ x: 85, y: 370, width: 1030, height: 135 }];
const options = { width: 1200, height: 900, bounds: { x: 45, y: 330, width: 1110, height: 525 } };

describe('restaurant pathfinding', () => {
  it('routes the chef from kitchen to dining room around the counter', () => {
    const goal = { x: 440, y: 680 };
    const path = findPath({ x: 600, y: 345 }, goal, obstacles, options);
    expect(path.length).toBeGreaterThan(1);
    expect(path.at(-1)).toEqual(goal);
    for (const point of path) expect(pointWalkable(point, obstacles, options.bounds)).toBe(true);
  });

  it('returns a direct path when no furniture blocks the destination', () => {
    const path = findPath({ x: 335, y: 345 }, { x: 470, y: 345 }, obstacles, options);
    expect(path).toEqual([{ x: 470, y: 345 }]);
  });

  it('never appends an unwalkable original target after snapping to the grid', () => {
    const path = findPath({ x: 600, y: 345 }, { x: 600, y: 420 }, obstacles, options);
    expect(path.length).toBeGreaterThan(0);
    expect(pointWalkable(path.at(-1)!, obstacles, options.bounds)).toBe(true);
    expect(path.at(-1)).not.toEqual({ x: 600, y: 420 });
  });
});
