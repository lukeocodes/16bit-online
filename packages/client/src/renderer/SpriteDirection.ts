/**
 * 8-directional isometric sprite direction mapping.
 * Maps world-space (facingX, facingZ) to a sprite sheet column index (0-7).
 *
 * Isometric directions (looking at the screen):
 *   0 = South (toward camera, default idle)
 *   1 = Southwest
 *   2 = West
 *   3 = Northwest
 *   4 = North (away from camera)
 *   5 = Northeast
 *   6 = East
 *   7 = Southeast
 */

// Direction index lookup: key = `${facingX},${facingZ}`
const DIRECTION_MAP: Record<string, number> = {
  "0,1": 0,   // S  (world +Z = toward camera in iso)
  "-1,1": 1,  // SW
  "-1,0": 2,  // W
  "-1,-1": 3, // NW
  "0,-1": 4,  // N  (world -Z = away from camera)
  "1,-1": 5,  // NE
  "1,0": 6,   // E
  "1,1": 7,   // SE
};

/** Convert facing vector to direction index (0-7). Defaults to 0 (south). */
export function facingToDirection(facingX: number, facingZ: number): number {
  const key = `${Math.sign(facingX) || 0},${Math.sign(facingZ) || 0}`;
  return DIRECTION_MAP[key] ?? 0;
}

/** Convert direction index to isometric screen offset for eye placement */
export function directionToIsoOffset(dir: number): { x: number; y: number } {
  // Pre-computed isometric offsets for each direction
  const offsets: Array<{ x: number; y: number }> = [
    { x: 0, y: 0.5 },    // S
    { x: -0.4, y: 0.3 }, // SW
    { x: -0.5, y: 0 },   // W
    { x: -0.4, y: -0.3 },// NW
    { x: 0, y: -0.5 },   // N
    { x: 0.4, y: -0.3 }, // NE
    { x: 0.5, y: 0 },    // E
    { x: 0.4, y: 0.3 },  // SE
  ];
  return offsets[dir] ?? offsets[0];
}

export const DIRECTION_COUNT = 8;

/** Direction names for debugging */
export const DIRECTION_NAMES = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"];
