/**
 * Canonical layer registry.
 *
 * Every placed tile lives on exactly one of these layers. Layers define:
 *   - render z-order (lower renders below higher)
 *   - whether the layer blocks player movement
 *   - whether tiles on the layer render above or below the player sprite
 *
 * Changing z values re-sorts all actors globally. Adding a new layer here
 * automatically surfaces it in the builder toolbar (see builder.html).
 *
 * Reserved layer IDs: "ground" | "decor" | "walls" | "canopy". These strings
 * are the wire format: they're sent to the server in BUILDER_PLACE_TILE and
 * stored in `user_map_tiles.layer`. Do not rename without a migration.
 */

export type LayerId = "ground" | "decor" | "walls" | "canopy";

export interface LayerDef {
  id: LayerId;
  name: string;
  description: string;
  /** Excalibur render z (Actor.z). Lower → drawn earlier (behind). */
  z: number;
  /** When true, tiles on this layer block the builder's movement and become
   *  collision in the frozen server JSON. */
  collides: boolean;
  /** When true, tiles render above the player sprite (e.g. tree canopies). */
  aboveCharacter: boolean;
  /** Display order in the toolbar (left → right). */
  order: number;
}

/** Authoritative list. Keep sorted by z so reviewers can see the stack. */
export const LAYERS: LayerDef[] = [
  {
    id: "ground",
    name: "Ground",
    description: "Floor tiles — grass, dirt, paths, water. Non-colliding; visible under all other layers.",
    z: 10,
    collides: false,
    aboveCharacter: false,
    order: 1,
  },
  {
    id: "decor",
    name: "Decor",
    description: "Small decoration — flowers, bushes, rugs. Non-colliding; player can walk over.",
    z: 20,
    collides: false,
    aboveCharacter: false,
    order: 2,
  },
  {
    id: "walls",
    name: "Walls",
    description: "Solid structures — trees, walls, buildings. Blocks player movement; rendered just above the player.",
    z: 60,
    collides: true,
    aboveCharacter: true,
    order: 3,
  },
  {
    id: "canopy",
    name: "Canopy",
    description: "Overhead foliage and roofs. Renders above the player so they appear underneath.",
    z: 200,
    collides: false,
    aboveCharacter: true,
    order: 4,
  },
];

/** Z for the player actor; placed between decor (below) and walls (above). */
export const PLAYER_Z = 50;

const byId = new Map(LAYERS.map((l) => [l.id, l]));

export function getLayer(id: LayerId): LayerDef {
  const l = byId.get(id);
  if (!l) throw new Error(`Unknown layer: ${id}`);
  return l;
}

export function listLayersByOrder(): LayerDef[] {
  return [...LAYERS].sort((a, b) => a.order - b.order);
}

/** All layer IDs whose tiles block player movement. */
export const COLLIDING_LAYERS: LayerId[] = LAYERS.filter((l) => l.collides).map((l) => l.id);

/** Layer stacking from topmost (drawn last) → bottom. Used by hit-testing
 *  so "erase" and "select" act on the visually topmost tile. */
export const LAYER_HIT_ORDER: LayerId[] = [...LAYERS]
  .sort((a, b) => b.z - a.z)
  .map((l) => l.id);
