// Summer Forest Tree Wall — Tile Relationship Map
// =================================================
// Sheet: summer forest tree wall 128x128.png
//   768×512px, 6 cols × 4 rows, each tile 128×128px (= 8×8 grid of 16px subtiles)
//
// The sheet is designed for surrounding a CLEARING with forest.
// Each tile describes which sides have forest on them.
//
// Reading directly from the sheet image (col, row):
//
//  Col:   0           1           2           3           4           5
//  Row 0: CLEAR_TL    CLEAR_T     INNER_TR    CLEAR_TR    PATH_T      CLEAR_TR_v2
//  Row 1: CLEAR_L     FILL        CLEAR_R     INNER_TL    INNER_BR    INNER_BL
//  Row 2: CLEAR_BL    CLEAR_B     INNER_BR    CLEAR_BR    PATH_B      CLEAR_BR_v2
//  Row 3: CONCAVE_TL  CONCAVE_TR  CONCAVE_BL  CONCAVE_BR  (unused)    (unused)
//
// Naming convention — what forest neighbours does this tile expect?
//   CLEAR_TL  = clearing top-left corner  → forest N and W, open S and E
//   CLEAR_T   = clearing top edge         → forest N, open S
//   CLEAR_TR  = clearing top-right corner → forest N and E, open S and W
//   CLEAR_L   = clearing left edge        → forest W, open E
//   CLEAR_R   = clearing right edge       → forest E, open W
//   CLEAR_BL  = clearing bottom-left      → forest S and W, open N and E
//   CLEAR_B   = clearing bottom edge      → forest S, open N
//   CLEAR_BR  = clearing bottom-right     → forest S and E, open N and W
//   FILL      = solid forest interior     → forest all sides
//   INNER_TL  = concave inner corner TL   → forest N, E, S — open NW corner
//   INNER_TR  = concave inner corner TR   → forest N, W, S — open NE corner
//   INNER_BL  = concave inner corner BL   → forest N, E, S — open SW corner
//   INNER_BR  = concave inner corner BR   → forest W, S, E — open SE corner
//   CONCAVE_* = alternative concave corner tiles (row 3)

export const WALL_COLS = 6;
export const WALL_ROWS = 4;
export const WALL_FRAME_PX = 128;
export const WALL_SUBTILE_PX = 16;

// [col, row] into the 128×128 sheet
export const WALL_TILE = {
  CLEAR_TL:   [0, 0] as [number, number], // forest N+W  → open clearing top-left corner
  CLEAR_T:    [1, 0] as [number, number], // forest N    → open clearing top edge
  INNER_TR:   [2, 0] as [number, number], // inner concave top-right
  CLEAR_TR:   [3, 0] as [number, number], // forest N+E  → open clearing top-right corner
  CLEAR_L:    [0, 1] as [number, number], // forest W    → open clearing left edge
  FILL:       [1, 1] as [number, number], // forest all sides (interior)
  CLEAR_R:    [2, 1] as [number, number], // forest E    → open clearing right edge
  INNER_TL:   [3, 1] as [number, number], // inner concave top-left
  INNER_BR:   [4, 1] as [number, number], // inner concave bottom-right
  INNER_BL:   [5, 1] as [number, number], // inner concave bottom-left
  CLEAR_BL:   [0, 2] as [number, number], // forest S+W  → open clearing bottom-left corner
  CLEAR_B:    [1, 2] as [number, number], // forest S    → open clearing bottom edge
  CLEAR_BR:   [3, 2] as [number, number], // forest S+E  → open clearing bottom-right corner
  CONCAVE_TL: [0, 3] as [number, number], // alternative concave corners
  CONCAVE_TR: [1, 3] as [number, number],
  CONCAVE_BL: [2, 3] as [number, number],
  CONCAVE_BR: [3, 3] as [number, number],
} as const;

// 8-direction neighbour bitmask
export const N  = 1 << 0;
export const NE = 1 << 1;
export const E  = 1 << 2;
export const SE = 1 << 3;
export const S  = 1 << 4;
export const SW = 1 << 5;
export const W  = 1 << 6;
export const NW = 1 << 7;

/**
 * Given a bitmask of which neighbours are also forest,
 * return the [sheetCol, sheetRow] for the correct wall tile.
 *
 * The logic: which cardinal sides are open (not forest)?
 * That determines the tile variant.
 */
export function getWallTile(mask: number): [number, number] {
  const n  = !!(mask & N);
  const e  = !!(mask & E);
  const s  = !!(mask & S);
  const w  = !!(mask & W);
  const ne = !!(mask & NE);
  const se = !!(mask & SE);
  const sw = !!(mask & SW);
  const nw = !!(mask & NW);

  // Open on all sides or isolated — shouldn't happen in a proper border, use fill
  if (!n && !e && !s && !w) return WALL_TILE.FILL;

  // Solid interior — forest on all 4 cardinal sides
  if (n && e && s && w) return WALL_TILE.FILL;

  // Straight edges — forest on exactly one cardinal side
  if ( n && !e && !s && !w) return WALL_TILE.CLEAR_T;
  if (!n &&  e && !s && !w) return WALL_TILE.CLEAR_R;
  if (!n && !e &&  s && !w) return WALL_TILE.CLEAR_B;
  if (!n && !e && !s &&  w) return WALL_TILE.CLEAR_L;

  // Outer corners — forest on exactly two adjacent cardinal sides
  if ( n && !e && !s &&  w) return WALL_TILE.CLEAR_TL;
  if ( n &&  e && !s && !w) return WALL_TILE.CLEAR_TR;
  if (!n &&  e &&  s && !w) return WALL_TILE.CLEAR_BR;
  if (!n && !e &&  s &&  w) return WALL_TILE.CLEAR_BL;

  // Opposite edges — forest on two opposite sides (corridor)
  if ( n && !e &&  s && !w) return WALL_TILE.FILL; // N+S corridor → fill
  if (!n &&  e && !s &&  w) return WALL_TILE.FILL; // E+W corridor → fill

  // Three cardinal sides — inner concave corners
  // Forest N+E+S, open W → inner left wall, concave on NW/SW
  if ( n &&  e &&  s && !w) return nw ? WALL_TILE.INNER_TL  : WALL_TILE.CONCAVE_TL;
  // Forest N+W+S, open E → inner right wall, concave on NE/SE
  if ( n && !e &&  s &&  w) return ne ? WALL_TILE.INNER_TR  : WALL_TILE.CONCAVE_TR;
  // Forest N+E+W, open S → inner bottom wall, concave on NE/NW
  if ( n &&  e && !s &&  w) return se ? WALL_TILE.INNER_BR  : WALL_TILE.CONCAVE_BR;
  // Forest S+E+W, open N → inner top wall, concave on SE/SW
  if (!n &&  e &&  s &&  w) return sw ? WALL_TILE.INNER_BL  : WALL_TILE.CONCAVE_BL;

  return WALL_TILE.FILL;
}

export interface WallPlacement {
  tileCol: number;
  tileRow: number;
  wallTile: [number, number];
  solid: boolean;
}

export function computeWallPlacements(
  cols: number,
  rows: number,
  isForest: (col: number, row: number) => boolean,
): WallPlacement[] {
  const results: WallPlacement[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isForest(c, r)) continue;

      const get = (dc: number, dr: number) => isForest(c + dc, r + dr);

      let mask = 0;
      if (get( 0, -1)) mask |= N;
      if (get( 1, -1)) mask |= NE;
      if (get( 1,  0)) mask |= E;
      if (get( 1,  1)) mask |= SE;
      if (get( 0,  1)) mask |= S;
      if (get(-1,  1)) mask |= SW;
      if (get(-1,  0)) mask |= W;
      if (get(-1, -1)) mask |= NW;

      results.push({ tileCol: c, tileRow: r, wallTile: getWallTile(mask), solid: true });
    }
  }

  return results;
}
