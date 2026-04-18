// World unit constants — everything is expressed in these units.
//
// One TILE is the fundamental grid unit: 16×16 world pixels.
// All positions, sizes, and movement steps are multiples of TILE.
//
// Character sprite normalisation:
//   width  = 1 TILE  (16 units)
//   height = 2 TILES (32 units)
//
// Mana Seed NPC pack frames are 32×32px — rendered at native resolution
// they are exactly 1 tile wide × 2 tiles tall. No scaling required.

export const TILE = 16;

// Convenience
export const TILE_W = TILE;       // 16
export const TILE_H = TILE;       // 16
export const CHAR_W = TILE;       // 16  — character collision width
export const CHAR_H = TILE * 2;   // 32  — character sprite render height

/** Convert a tile column to world-space pixel centre */
export const tileToWorld = (tileCoord: number): number => (tileCoord + 0.5) * TILE;
