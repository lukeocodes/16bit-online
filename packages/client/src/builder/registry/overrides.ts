/**
 * Per-tile override type contract. Data lives in the database
 * (`tile_overrides` table) and is mutated via `store.ts`'s async
 * `setOverride` / `clearOverride`, which POST/DELETE
 * `/api/builder/overrides`. See AGENTS.md "Data in the Database".
 *
 * Apply order when resolving a tile entry:
 *   base TilesetDef → matching SubRegion → Override (last wins)
 *
 * Unlike the old localStorage implementation, overrides are shared across
 * all builder sessions — two people editing metadata see each other's
 * edits after the next registry refresh (or live via WebRTC broadcast,
 * Phase 1b).
 */
import type { CategoryId } from "./categories.js";
import type { LayerId }    from "./layers.js";

export interface TileOverride {
  category?:     CategoryId;
  /** Override the displayed label. When set, the picker uses this in
   *  place of the synthetic `<TilesetName> #<id>` string. */
  name?:         string;
  /** Tags merged with the tileset's own tags. */
  tags?:         string[];
  defaultLayer?: LayerId;
  blocks?:       boolean;
  hide?:         boolean;
}

// Runtime accessors live in ./store.ts — re-export for import ergonomics.
export {
  key,
  getOverride,
  setOverride,
  clearOverride,
  allOverrides,
  hasAnyOverride,
  exportOverridesJson,
} from "./store.js";
