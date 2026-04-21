/**
 * Tileset type contracts. Data lives in the database (`tilesets` +
 * `tileset_sub_regions` + `tile_empty_flags` + `tile_animations` tables)
 * and is fetched via `store.ts` at boot. See AGENTS.md "Data in the
 * Database".
 *
 * Tileset filenames are wire format — they're stored in
 * `user_map_tiles.tileset`. Do not rename without a data migration.
 *
 * Use the builder UI (metadata editor + delete button) to author
 * per-tile / per-sheet metadata; changes persist via
 * `POST /api/builder/overrides`.
 */

import type { CategoryId } from "./categories.js";
import type { LayerId }    from "./layers.js";

export type Season = "summer" | "autumn" | "spring" | "winter";

/** A contiguous block of tile IDs inside a tileset that overrides the
 *  tileset's default category/flags. NULL fields mean "inherit from tileset
 *  default". Later regions (higher `displayOrder` in the DB) win when ranges
 *  overlap; the store returns them sorted asc, and `matchSubRegion`
 *  iterates in reverse so the last match wins.
 *
 *  Set `hide: true` to filter every tile in the range out of the picker —
 *  used for documentation/label tiles baked into Mana Seed home interior
 *  sheets ("Doorway" / "Walls" / "Door Goes Here"). */
export interface SubRegion {
  category:      CategoryId | null;
  from:          number;
  to:            number;
  blocks?:       boolean | null;
  defaultLayer?: LayerId | null;
  label?:        string | null;
  hide?:         boolean | null;
}

export interface TilesetDef {
  /** Stable slug, e.g. "summer-forest-wang". */
  id?: string;
  slug?: string;
  /** File path relative to /maps/. Primary key in the DB. */
  file: string;
  /** Display name (from the TSX `<tileset name=>`). */
  name?: string;
  category: CategoryId;
  tags?: string[];
  seasonal?: Season | null;
  blocks?: boolean;
  defaultLayer?: LayerId | null;
  subRegions?: SubRegion[];
  /** True → still loaded for rendering, but not shown in the picker. */
  hidden?: boolean;
  /** Future: heuristic hide for docs/label tiles (scanner not yet wired). */
  autoHideLabels?: boolean;
  notes?: string | null;
}

// Runtime accessors live in ./store.ts — re-export for import ergonomics.
// Callers get RemoteTilesetDef (extends TilesetDef with structural fields
// + emptyTiles + animations ingested from TSX). See store.ts.
export { listTilesets, getTilesetDef, matchSubRegion } from "./store.js";
export type { RemoteTilesetDef } from "./store.js";
