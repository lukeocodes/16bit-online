/**
 * Layer type contracts. Data lives in the database (`map_layers` table)
 * and is fetched via `store.ts` at boot. See AGENTS.md "Data in the
 * Database".
 *
 * Layer IDs are wire format — they're stored in `user_map_tiles.layer`
 * and sent over the BUILDER_PLACE_TILE opcode. Do not rename without a
 * data migration.
 */

export type LayerId = "ground" | "decor" | "walls" | "canopy";

export interface LayerDef {
  id: LayerId;
  name: string;
  description: string;
  /** Excalibur render z (Actor.z). Lower → drawn earlier (behind). */
  z: number;
  /** When true, tiles on this layer block movement. */
  collides: boolean;
  /** When true, tiles render above the player sprite (e.g. tree canopies). */
  aboveCharacter: boolean;
  /** Display order in the toolbar (left → right). */
  order: number;
}

/** Z for the player actor; placed between decor (below) and walls (above).
 *  Constant — not data that designers tune, so not in the DB. */
export const PLAYER_Z = 50;

// Runtime accessors live in ./store.ts — re-export for import ergonomics.
// `listLayers`, `listLayersByOrder`, `getLayer`, `layerHitOrder`,
// `collidingLayers`.
export {
  listLayers,
  listLayersByOrder,
  getLayer,
  layerHitOrder,
  collidingLayers,
} from "./store.js";
