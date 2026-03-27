/**
 * A* pathfinding for tile-based isometric movement.
 * Returns a list of tile positions from start to goal (excluding start).
 * Supports 8-directional movement with diagonal cost √2.
 */

type WalkableCheck = (x: number, z: number) => boolean;

interface Node {
  x: number;
  z: number;
  g: number; // cost from start
  h: number; // heuristic to goal
  f: number; // g + h
  parent: Node | null;
}

const SQRT2 = Math.SQRT2;

// 8-directional neighbors
const DIRS = [
  { dx: 1, dz: 0, cost: 1 },
  { dx: -1, dz: 0, cost: 1 },
  { dx: 0, dz: 1, cost: 1 },
  { dx: 0, dz: -1, cost: 1 },
  { dx: 1, dz: 1, cost: SQRT2 },
  { dx: 1, dz: -1, cost: SQRT2 },
  { dx: -1, dz: 1, cost: SQRT2 },
  { dx: -1, dz: -1, cost: SQRT2 },
];

function heuristic(ax: number, az: number, bx: number, bz: number): number {
  // Chebyshev distance (allows diagonal moves at cost √2)
  const dx = Math.abs(ax - bx);
  const dz = Math.abs(az - bz);
  return Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz);
}

/**
 * Find a path from (startX, startZ) to (goalX, goalZ).
 * Returns array of {x, z} tile positions (excluding start), or empty if no path.
 * maxNodes limits search to prevent freezing on large open areas.
 */
export function findPath(
  startX: number,
  startZ: number,
  goalX: number,
  goalZ: number,
  canWalk: WalkableCheck,
  maxNodes = 500,
): Array<{ x: number; z: number }> {
  if (startX === goalX && startZ === goalZ) return [];
  if (!canWalk(goalX, goalZ)) {
    // Goal not walkable — find nearest walkable tile to goal
    return findPathToNearest(startX, startZ, goalX, goalZ, canWalk, maxNodes);
  }

  const openSet: Node[] = [];
  const closedSet = new Set<string>();

  const startNode: Node = {
    x: startX, z: startZ,
    g: 0,
    h: heuristic(startX, startZ, goalX, goalZ),
    f: 0,
    parent: null,
  };
  startNode.f = startNode.g + startNode.h;
  openSet.push(startNode);

  let explored = 0;

  while (openSet.length > 0 && explored < maxNodes) {
    // Find lowest f-cost node (simple linear scan — fine for ≤500 nodes)
    let bestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[bestIdx].f) bestIdx = i;
    }
    const current = openSet[bestIdx];
    openSet.splice(bestIdx, 1);

    if (current.x === goalX && current.z === goalZ) {
      return reconstructPath(current);
    }

    const key = `${current.x},${current.z}`;
    if (closedSet.has(key)) continue;
    closedSet.add(key);
    explored++;

    for (const dir of DIRS) {
      const nx = current.x + dir.dx;
      const nz = current.z + dir.dz;
      const nKey = `${nx},${nz}`;

      if (closedSet.has(nKey)) continue;
      if (!canWalk(nx, nz)) continue;

      // For diagonal moves, check that both adjacent axis tiles are walkable
      if (dir.dx !== 0 && dir.dz !== 0) {
        if (!canWalk(current.x + dir.dx, current.z) || !canWalk(current.x, current.z + dir.dz)) {
          continue; // Can't cut corners
        }
      }

      const g = current.g + dir.cost;
      const h = heuristic(nx, nz, goalX, goalZ);

      // Check if already in open set with better g
      const existing = openSet.find(n => n.x === nx && n.z === nz);
      if (existing && existing.g <= g) continue;

      const node: Node = { x: nx, z: nz, g, h, f: g + h, parent: current };
      openSet.push(node);
    }
  }

  // No path found — return partial path toward goal (best we got)
  if (explored > 0) {
    // Find the explored node closest to goal
    let bestNode: Node | null = null;
    let bestH = Infinity;
    for (const key of closedSet) {
      const [x, z] = key.split(",").map(Number);
      const h = heuristic(x, z, goalX, goalZ);
      if (h < bestH) {
        bestH = h;
        // We need to find the actual node — but we only have the set
        // Fall back to returning empty (no partial paths to avoid weird behavior)
      }
    }
    void bestNode; // unused — partial path not implemented for simplicity
  }

  return [];
}

/** Find path to nearest walkable tile adjacent to an unwalkable goal */
function findPathToNearest(
  startX: number, startZ: number,
  goalX: number, goalZ: number,
  canWalk: WalkableCheck,
  maxNodes: number,
): Array<{ x: number; z: number }> {
  // Find the closest walkable tile to the goal
  for (const dir of DIRS) {
    const nx = goalX + dir.dx;
    const nz = goalZ + dir.dz;
    if (canWalk(nx, nz)) {
      return findPath(startX, startZ, nx, nz, canWalk, maxNodes);
    }
  }
  return [];
}

function reconstructPath(node: Node): Array<{ x: number; z: number }> {
  const path: Array<{ x: number; z: number }> = [];
  let current: Node | null = node;
  while (current?.parent) {
    path.unshift({ x: current.x, z: current.z });
    current = current.parent;
  }
  return path;
}
