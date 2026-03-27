export interface RGB {
  r: number;
  g: number;
  b: number;
}

function rgb(r: number, g: number, b: number): RGB { return { r, g, b }; }

/** Convert RGB (0-1 floats) to hex number for PixiJS */
export function rgbToHex(c: RGB): number {
  return (Math.round(c.r * 255) << 16) | (Math.round(c.g * 255) << 8) | Math.round(c.b * 255);
}

export interface TileType {
  id: number;        // Maps 1:1 to BiomeType enum value
  name: string;
  color: RGB;
  walkable: boolean;
  /** Color used when tile is impassable (steep or biome-blocked) */
  impassableColor: RGB;
}

// Tile types matching BiomeType enum (0-17)
const TILE_TYPES: TileType[] = [
  { id: 0,  name: "deep_ocean",          color: rgb(0.05, 0.10, 0.30), walkable: false, impassableColor: rgb(0.02, 0.04, 0.15) },
  { id: 1,  name: "shallow_ocean",       color: rgb(0.10, 0.20, 0.45), walkable: false, impassableColor: rgb(0.04, 0.08, 0.20) },
  { id: 2,  name: "beach",               color: rgb(0.76, 0.70, 0.50), walkable: true,  impassableColor: rgb(0.40, 0.35, 0.25) },
  { id: 3,  name: "temperate_grassland",  color: rgb(0.30, 0.55, 0.20), walkable: true,  impassableColor: rgb(0.18, 0.15, 0.10) },
  { id: 4,  name: "temperate_forest",    color: rgb(0.15, 0.42, 0.15), walkable: true,  impassableColor: rgb(0.08, 0.15, 0.06) },
  { id: 5,  name: "dense_forest",        color: rgb(0.08, 0.30, 0.08), walkable: true,  impassableColor: rgb(0.04, 0.12, 0.04) },
  { id: 6,  name: "boreal_forest",       color: rgb(0.12, 0.32, 0.18), walkable: true,  impassableColor: rgb(0.06, 0.14, 0.08) },
  { id: 7,  name: "mountain",            color: rgb(0.50, 0.47, 0.44), walkable: true,  impassableColor: rgb(0.20, 0.18, 0.17) },
  { id: 8,  name: "snow_peak",           color: rgb(0.95, 0.95, 0.97), walkable: false, impassableColor: rgb(0.12, 0.11, 0.13) },
  { id: 9,  name: "tundra",              color: rgb(0.55, 0.58, 0.50), walkable: true,  impassableColor: rgb(0.25, 0.26, 0.22) },
  { id: 10, name: "desert",              color: rgb(0.78, 0.68, 0.40), walkable: true,  impassableColor: rgb(0.40, 0.32, 0.18) },
  { id: 11, name: "scrubland",           color: rgb(0.55, 0.50, 0.30), walkable: true,  impassableColor: rgb(0.28, 0.24, 0.14) },
  { id: 12, name: "swamp",               color: rgb(0.25, 0.30, 0.15), walkable: true,  impassableColor: rgb(0.12, 0.14, 0.07) },
  { id: 13, name: "highland",            color: rgb(0.42, 0.47, 0.32), walkable: true,  impassableColor: rgb(0.20, 0.22, 0.15) },
  { id: 14, name: "meadow",              color: rgb(0.42, 0.58, 0.25), walkable: true,  impassableColor: rgb(0.22, 0.20, 0.12) },
  { id: 15, name: "river_valley",        color: rgb(0.30, 0.42, 0.20), walkable: true,  impassableColor: rgb(0.15, 0.20, 0.10) },
  { id: 16, name: "river",               color: rgb(0.15, 0.25, 0.50), walkable: false, impassableColor: rgb(0.06, 0.10, 0.22) },
  { id: 17, name: "lake",                color: rgb(0.12, 0.22, 0.48), walkable: false, impassableColor: rgb(0.05, 0.09, 0.20) },
];

const tileMap = new Map<number, TileType>();
for (const tile of TILE_TYPES) tileMap.set(tile.id, tile);

export function getTileType(id: number): TileType { return tileMap.get(id) || TILE_TYPES[0]; }
export function getAllTileTypes(): readonly TileType[] { return TILE_TYPES; }
