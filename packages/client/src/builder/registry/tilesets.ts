/**
 * Comprehensive tileset registry.
 *
 * Every TSX file shipped in `packages/client/public/maps/` (and subfolders)
 * is declared here with rich metadata:
 *
 *   - id             stable slug used for lookup
 *   - file           path relative to /maps/ (may contain subfolders)
 *   - name           display name shown in the picker
 *   - category       default category for every tile in the set
 *   - tags           extra search terms (hit by the picker search box)
 *   - seasonal       "summer" | "autumn" | "spring" | "winter" (optional)
 *   - blocks         whole-tileset collision flag (trees, walls, buildings)
 *   - defaultLayer   layer the picker should auto-switch to when brushing
 *   - subRegions     tile-id ranges that override the above for a subset
 *                    of tiles in the sheet (lets a mixed sheet split into
 *                    e.g. Containers / Lights / Furniture)
 *
 * Adding a new TSX: append here. Sub-region ranges can be filled in as we
 * visually identify which tile ids correspond to which category.
 */

import type { CategoryId } from "./categories.js";
import type { LayerId }    from "./layers.js";

export type Season = "summer" | "autumn" | "spring" | "winter";

/** A contiguous block of tile IDs inside a tileset that overrides the
 *  tileset's default category/flags. Tile IDs are the raw linear index
 *  (row * columns + col). Later regions win when overlapping. */
export interface SubRegion {
  category:     CategoryId;
  /** Inclusive start tile id. */
  from:         number;
  /** Inclusive end tile id. */
  to:           number;
  blocks?:      boolean;
  defaultLayer?: LayerId;
  /** Short label shown alongside the tile in the picker. Optional. */
  label?:       string;
}

export interface TilesetDef {
  id:            string;
  file:          string;          // relative to /maps/
  name:          string;          // display name
  category:      CategoryId;
  tags?:         string[];
  seasonal?:     Season;
  blocks?:       boolean;
  defaultLayer?: LayerId;
  subRegions?:   SubRegion[];
  /** True → still loaded for rendering, but not shown in the picker. */
  hidden?:       boolean;
  /** Free-form notes for authors. */
  notes?:        string;
}

// ---------------------------------------------------------------------------
// Summer (top-level — the default packs for Heaven)
// ---------------------------------------------------------------------------

const SUMMER: TilesetDef[] = [
  {
    id:       "summer-forest-wang",
    file:     "summer forest wang tiles.tsx",
    name:     "Summer Forest — Wang Terrain",
    category: "terrain",
    tags:     ["wang", "grass", "dirt", "sand", "water", "path"],
    seasonal: "summer",
    defaultLayer: "ground",
  },
  {
    id:       "summer-forest-wang-alt",
    file:     "summer-forest-wang-tiles.tsx",
    name:     "Summer Forest — Wang Terrain (alt)",
    category: "terrain",
    tags:     ["wang"],
    seasonal: "summer",
    defaultLayer: "ground",
    hidden:   true, // duplicate of summer-forest-wang; kept loaded for backward compat
  },
  {
    id:       "summer-forest",
    file:     "summer forest.tsx",
    name:     "Summer Forest — Decor Sheet",
    category: "forest",
    tags:     ["bush", "log", "stump", "flower", "mushroom", "rock"],
    seasonal: "summer",
    defaultLayer: "decor",
    // TODO: fill sub-regions for plants/containers/lights once tile-ids are identified.
  },
  {
    id:       "summer-forest-alt",
    file:     "summer-forest.tsx",
    name:     "Summer Forest — Decor Sheet (alt)",
    category: "forest",
    seasonal: "summer",
    defaultLayer: "decor",
    hidden:   true,
  },
  {
    id:       "summer-tree-wall",
    file:     "summer-forest-tree-wall.tsx",
    name:     "Summer Tree — Trunks (solid)",
    category: "trees",
    tags:     ["tree", "wall", "trunk", "bark"],
    seasonal: "summer",
    blocks:   true,
    defaultLayer: "walls",
  },
  {
    id:       "summer-tree-canopy",
    file:     "summer-forest-tree-wall-canopy.tsx",
    name:     "Summer Tree — Canopies",
    category: "trees",
    tags:     ["tree", "canopy", "leaves"],
    seasonal: "summer",
    defaultLayer: "canopy",
  },
  {
    id:       "summer-trees-80x112",
    file:     "summer trees 80x112.tsx",
    name:     "Summer — Standalone Trees",
    category: "trees",
    tags:     ["tree", "large"],
    seasonal: "summer",
    blocks:   true,
    defaultLayer: "walls",
  },
  {
    id:       "summer-water-sparkles",
    file:     "summer water sparkles.tsx",
    name:     "Summer Water — Sparkles (animated)",
    category: "water",
    tags:     ["water", "animated", "sparkle"],
    seasonal: "summer",
    defaultLayer: "decor",
  },
  {
    id:       "summer-waterfall",
    file:     "summer waterfall B.tsx",
    name:     "Summer Waterfall (animated)",
    category: "water",
    tags:     ["water", "waterfall", "animated"],
    seasonal: "summer",
    defaultLayer: "ground",
  },
  {
    id:       "summer-16x32",
    file:     "summer 16x32.tsx",
    name:     "Summer — Tall Props (16×32)",
    category: "props",
    tags:     ["tall", "flower", "mushroom"],
    seasonal: "summer",
    defaultLayer: "decor",
  },
  {
    id:       "summer-32x32",
    file:     "summer 32x32.tsx",
    name:     "Summer — Medium Props (32×32)",
    category: "props",
    tags:     ["barrel", "crate", "box", "sign"],
    seasonal: "summer",
    defaultLayer: "decor",
  },
];

// ---------------------------------------------------------------------------
// Seasonal test-zone packs (every one of these lives under test-zones/<zone>/)
// ---------------------------------------------------------------------------

const AUTUMN: TilesetDef[] = [
  { id: "autumn-forest-wang", file: "test-zones/autumn-forest/autumn forest wang tiles.tsx",
    name: "Autumn Forest — Wang", category: "terrain", seasonal: "autumn", defaultLayer: "ground" },
  { id: "autumn-forest",      file: "test-zones/autumn-forest/autumn forest (leaves).tsx",
    name: "Autumn Forest — Decor", category: "forest", seasonal: "autumn", defaultLayer: "decor" },
  { id: "autumn-trees",       file: "test-zones/autumn-forest/autumn trees (leaves) 80x112.tsx",
    name: "Autumn Trees", category: "trees", seasonal: "autumn", blocks: true, defaultLayer: "walls" },
  { id: "autumn-16x32",       file: "test-zones/autumn-forest/autumn 16x32.tsx",
    name: "Autumn Tall Props", category: "props", seasonal: "autumn", defaultLayer: "decor" },
  { id: "autumn-32x32",       file: "test-zones/autumn-forest/autumn 32x32.tsx",
    name: "Autumn Medium Props", category: "props", seasonal: "autumn", defaultLayer: "decor" },
  { id: "autumn-water",       file: "test-zones/autumn-forest/autumn water sparkles.tsx",
    name: "Autumn Water Sparkles", category: "water", seasonal: "autumn", defaultLayer: "decor" },
  { id: "autumn-waterfall",   file: "test-zones/autumn-forest/autumn waterfall B.tsx",
    name: "Autumn Waterfall", category: "water", seasonal: "autumn", defaultLayer: "ground" },
];

const SPRING: TilesetDef[] = [
  { id: "spring-forest-wang", file: "test-zones/spring-forest/spring forest wang tiles.tsx",
    name: "Spring Forest — Wang", category: "terrain", seasonal: "spring", defaultLayer: "ground" },
  { id: "spring-forest",      file: "test-zones/spring-forest/spring forest.tsx",
    name: "Spring Forest — Decor", category: "forest", seasonal: "spring", defaultLayer: "decor" },
  { id: "spring-trees",       file: "test-zones/spring-forest/spring trees 80x112.tsx",
    name: "Spring Trees", category: "trees", seasonal: "spring", blocks: true, defaultLayer: "walls" },
  { id: "spring-16x32",       file: "test-zones/spring-forest/spring 16x32.tsx",
    name: "Spring Tall Props", category: "props", seasonal: "spring", defaultLayer: "decor" },
  { id: "spring-32x32",       file: "test-zones/spring-forest/spring 32x32.tsx",
    name: "Spring Medium Props", category: "props", seasonal: "spring", defaultLayer: "decor" },
  { id: "spring-water",       file: "test-zones/spring-forest/spring water sparkles.tsx",
    name: "Spring Water Sparkles", category: "water", seasonal: "spring", defaultLayer: "decor" },
  { id: "spring-waterfall",   file: "test-zones/spring-forest/spring waterfall B.tsx",
    name: "Spring Waterfall", category: "water", seasonal: "spring", defaultLayer: "ground" },
];

const WINTER: TilesetDef[] = [
  { id: "winter-forest-wang", file: "test-zones/winter-forest/winter forest wang tiles (snowy).tsx",
    name: "Winter Forest — Wang (snowy)", category: "terrain", seasonal: "winter", defaultLayer: "ground" },
  { id: "winter-forest",      file: "test-zones/winter-forest/winter forest (snowy).tsx",
    name: "Winter Forest — Decor", category: "forest", seasonal: "winter", defaultLayer: "decor" },
  { id: "winter-trees",       file: "test-zones/winter-forest/winter trees (snowy) 80x112.tsx",
    name: "Winter Trees (snowy)", category: "trees", seasonal: "winter", blocks: true, defaultLayer: "walls" },
  { id: "winter-16x32",       file: "test-zones/winter-forest/winter (snowy) 16x32.tsx",
    name: "Winter Tall Props (snowy)", category: "props", seasonal: "winter", defaultLayer: "decor" },
  { id: "winter-32x32",       file: "test-zones/winter-forest/winter (snowy) 32x32.tsx",
    name: "Winter Medium Props (snowy)", category: "props", seasonal: "winter", defaultLayer: "decor" },
  { id: "winter-water",       file: "test-zones/winter-forest/winter water sparkles B 16x16.tsx",
    name: "Winter Water Sparkles", category: "water", seasonal: "winter", defaultLayer: "decor" },
  { id: "winter-waterfall",   file: "test-zones/winter-forest/winter waterfall B 16x16.tsx",
    name: "Winter Waterfall", category: "water", seasonal: "winter", defaultLayer: "ground" },
];

const SUMMER_WATERFALL: TilesetDef[] = [
  { id: "sw-48x32", file: "test-zones/summer-waterfall/summer 48x32.tsx",
    name: "Summer — Wide Props (48×32)", category: "props", seasonal: "summer", defaultLayer: "decor" },
  { id: "sw-tree-wall", file: "test-zones/summer-waterfall/summer forest, tree wall.tsx",
    name: "Summer Tree — Wall (alt)", category: "trees", seasonal: "summer", blocks: true, defaultLayer: "walls", hidden: true },
  { id: "sw-tree-canopy", file: "test-zones/summer-waterfall/summer forest, tree wall (canopy only).tsx",
    name: "Summer Tree — Canopy (alt)", category: "trees", seasonal: "summer", defaultLayer: "canopy", hidden: true },
];

// ---------------------------------------------------------------------------
// Buildings — home interior packs (4 variants)
// ---------------------------------------------------------------------------

const BUILDINGS: TilesetDef[] = [
  {
    id:       "home-thatch",
    file:     "test-zones/thatch-home/home interiors, thatch roof v1.tsx",
    name:     "Home — Thatch",
    category: "buildings",
    tags:     ["home", "thatch", "wall", "floor", "roof", "door", "window", "furniture", "container", "light"],
    blocks:   true,
    defaultLayer: "walls",
    notes:    "Mixed sheet containing walls/floors/doors/windows/furniture/containers/lights. " +
              "Sub-regions will carve this into distinct categories as tile-ids are identified.",
    // TODO subRegions: [ { from, to, category: "containers", ... }, ... ]
  },
  {
    id:       "home-timber",
    file:     "test-zones/timber-home/home interiors, timber roof.tsx",
    name:     "Home — Timber",
    category: "buildings",
    tags:     ["home", "timber", "wall", "floor", "roof", "door", "window", "furniture"],
    blocks:   true,
    defaultLayer: "walls",
  },
  {
    id:       "home-half-timber",
    file:     "test-zones/half-timber-home/home interiors, half-timber.tsx",
    name:     "Home — Half-Timber",
    category: "buildings",
    tags:     ["home", "half-timber"],
    blocks:   true,
    defaultLayer: "walls",
  },
  {
    id:       "home-stonework",
    file:     "test-zones/stonework-home/home interiors, stonework.tsx",
    name:     "Home — Stonework",
    category: "buildings",
    tags:     ["home", "stonework", "stone", "castle"],
    blocks:   true,
    defaultLayer: "walls",
  },
];

// ---------------------------------------------------------------------------
// Bridges
// ---------------------------------------------------------------------------

const BRIDGES: TilesetDef[] = [
  {
    id:       "bonus-bridge",
    file:     "bonus bridge.tsx",
    name:     "Bridges — Bonus",
    category: "bridges",
    tags:     ["wooden", "stone"],
    defaultLayer: "decor",
  },
];

// ---------------------------------------------------------------------------
// Generic terrain / trees packs (multi-season or top-level misc)
// ---------------------------------------------------------------------------

const MISC: TilesetDef[] = [
  {
    id:       "terrain",
    file:     "terrain.tsx",
    name:     "Terrain (generic)",
    category: "terrain",
    defaultLayer: "ground",
  },
  {
    id:       "trees",
    file:     "trees.tsx",
    name:     "Trees (generic)",
    category: "trees",
    blocks:   true,
    defaultLayer: "walls",
  },
];

// ---------------------------------------------------------------------------
// Excluded (kept unregistered to avoid picker clutter)
// ---------------------------------------------------------------------------
//
// "collision & alpha.tsx" — visualisation helper emitted by Tiled for editing
// collision shapes in-editor. Never a tileable game tile.

// ---------------------------------------------------------------------------
// Merged list
// ---------------------------------------------------------------------------

export const TILESETS: TilesetDef[] = [
  ...SUMMER,
  ...AUTUMN,
  ...SPRING,
  ...WINTER,
  ...SUMMER_WATERFALL,
  ...BUILDINGS,
  ...BRIDGES,
  ...MISC,
];

// -------- Lookup helpers ---------------------------------------------------

const byFile = new Map(TILESETS.map((t) => [t.file, t]));
const byId   = new Map(TILESETS.map((t) => [t.id, t]));

export function getTilesetDef(file: string): TilesetDef | undefined {
  return byFile.get(file);
}
export function getTilesetDefById(id: string): TilesetDef | undefined {
  return byId.get(id);
}
export function listTilesets(): TilesetDef[] {
  return TILESETS;
}

/** Find the sub-region (if any) that a given tile-id within a tileset
 *  belongs to. Returns undefined when no override applies. */
export function matchSubRegion(def: TilesetDef, tileId: number): SubRegion | undefined {
  if (!def.subRegions) return undefined;
  // Iterate in reverse so later entries win on overlap.
  for (let i = def.subRegions.length - 1; i >= 0; i--) {
    const r = def.subRegions[i];
    if (tileId >= r.from && tileId <= r.to) return r;
  }
  return undefined;
}
