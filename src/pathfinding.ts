export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }
export interface GridOptions { width: number; height: number; cell?: number; bounds: Rect }

interface Cell { x: number; y: number }
const key = (cell: Cell) => `${cell.x},${cell.y}`;

export function pointWalkable(point: Point, obstacles: Rect[], bounds: Rect): boolean {
  if (point.x < bounds.x || point.x > bounds.x + bounds.width || point.y < bounds.y || point.y > bounds.y + bounds.height) return false;
  return !obstacles.some((rect) => point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height);
}

/** Small deterministic A* grid, adequate for the single-room restaurant. */
export function findPath(start: Point, goal: Point, obstacles: Rect[], options: GridOptions): Point[] {
  const cellSize = options.cell ?? 30;
  const columns = Math.ceil(options.width / cellSize);
  const rows = Math.ceil(options.height / cellSize);
  const center = (cell: Cell): Point => ({ x: cell.x * cellSize + cellSize / 2, y: cell.y * cellSize + cellSize / 2 });
  const walkableCell = (cell: Cell) => cell.x >= 0 && cell.y >= 0 && cell.x < columns && cell.y < rows && pointWalkable(center(cell), obstacles, options.bounds);
  const nearest = (point: Point): Cell | undefined => {
    const origin = { x: Math.floor(point.x / cellSize), y: Math.floor(point.y / cellSize) };
    for (let radius = 0; radius < 6; radius += 1) {
      for (let y = origin.y - radius; y <= origin.y + radius; y += 1) {
        for (let x = origin.x - radius; x <= origin.x + radius; x += 1) {
          const cell = { x, y };
          if (walkableCell(cell)) return cell;
        }
      }
    }
    return undefined;
  };
  const first = nearest(start);
  const last = nearest(goal);
  if (!first || !last) return [];
  const open: Cell[] = [first];
  const openKeys = new Set([key(first)]);
  const cameFrom = new Map<string, Cell>();
  const costs = new Map<string, number>([[key(first), 0]]);
  const heuristic = (cell: Cell) => Math.abs(cell.x - last.x) + Math.abs(cell.y - last.y);
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let found = false;

  while (open.length > 0 && !found) {
    open.sort((a, b) => (costs.get(key(a))! + heuristic(a)) - (costs.get(key(b))! + heuristic(b)) || a.y - b.y || a.x - b.x);
    const current = open.shift()!;
    openKeys.delete(key(current));
    if (current.x === last.x && current.y === last.y) { found = true; break; }
    for (const [dx, dy] of directions) {
      const next = { x: current.x + dx, y: current.y + dy };
      if (!walkableCell(next)) continue;
      const nextKey = key(next);
      const cost = costs.get(key(current))! + 1;
      if (cost >= (costs.get(nextKey) ?? Number.POSITIVE_INFINITY)) continue;
      costs.set(nextKey, cost);
      cameFrom.set(nextKey, current);
      if (!openKeys.has(nextKey)) { open.push(next); openKeys.add(nextKey); }
    }
  }
  if (!found) return [];
  const cells: Cell[] = [last];
  while (key(cells[0]) !== key(first)) cells.unshift(cameFrom.get(key(cells[0]))!);
  const raw = cells.map(center);
  raw[0] = pointWalkable(start, obstacles, options.bounds) ? { ...start } : center(first);
  const safeGoal = pointWalkable(goal, obstacles, options.bounds) ? { ...goal } : center(last);
  raw.push(safeGoal);

  const visible = (from: Point, to: Point) => {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(distance / 10));
    for (let index = 1; index <= steps; index += 1) {
      const t = index / steps;
      if (!pointWalkable({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }, obstacles, options.bounds)) return false;
    }
    return true;
  };
  const smoothed: Point[] = [];
  let anchor = 0;
  while (anchor < raw.length - 1) {
    let next = raw.length - 1;
    while (next > anchor + 1 && !visible(raw[anchor], raw[next])) next -= 1;
    smoothed.push(raw[next]);
    anchor = next;
  }
  return smoothed;
}
