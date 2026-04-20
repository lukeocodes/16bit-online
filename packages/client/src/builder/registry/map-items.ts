/**
 * Map-item type registry (stub).
 *
 * A "map item" is a placed world object whose behaviour exceeds a static
 * sprite. Containers hold inventories; lights emit glow in the lighting
 * pass; doors can be opened and walked through; signs display text; NPC
 * spawns spawn an AI-driven character.
 *
 * This file is a placeholder: the UI, storage model, interaction protocol,
 * and server-side state for each kind still need designing. Once they do,
 * the picker will offer a dedicated "Place item" flow alongside tile
 * placement, and placements will live in their own DB table (e.g.
 * `user_map_items`) rather than `user_map_tiles`.
 *
 * For now, keeping the type list declared makes the intent visible and gives
 * downstream code somewhere to hang feature flags without more churn.
 */

export type MapItemKind =
  | "container"
  | "light"
  | "door"
  | "sign"
  | "npc-spawn"
  | "teleporter"
  | "crop-plot";

export interface MapItemTypeDef {
  kind:        MapItemKind;
  name:        string;
  description: string;
  /** Whether the item blocks player movement. Most do. */
  blocks:      boolean;
  /** Tile-like footprint the picker draws as a preview, if any. */
  preview?:    { tileset: string; tileId: number };
  /** True once the full behaviour is implemented end-to-end. */
  implemented: boolean;
}

export const MAP_ITEM_TYPES: MapItemTypeDef[] = [
  {
    kind: "container",
    name: "Container",
    description: "Chest, barrel, or crate that holds items. Opens an inventory UI on interact.",
    blocks: true,
    implemented: false,
  },
  {
    kind: "light",
    name: "Light Source",
    description: "Lantern, torch, or campfire. Emits a glow radius in the night-time lighting pass.",
    blocks: false,
    implemented: false,
  },
  {
    kind: "door",
    name: "Door",
    description: "Opens/closes on interact; may require a key. Walk-through when open; blocks when closed.",
    blocks: true,
    implemented: false,
  },
  {
    kind: "sign",
    name: "Sign",
    description: "Displays a text message on interact. Useful for zone names, quest hints, lore.",
    blocks: true,
    implemented: false,
  },
  {
    kind: "npc-spawn",
    name: "NPC Spawn",
    description: "Spawn marker for a named NPC. Links to an entry in the character model registry.",
    blocks: false,
    implemented: false,
  },
  {
    kind: "teleporter",
    name: "Teleporter",
    description: "Travel portal to another zone/map at a specified spawn point.",
    blocks: false,
    implemented: false,
  },
  {
    kind: "crop-plot",
    name: "Crop Plot",
    description: "Tilled ground patch where a crop can be planted, watered, and harvested.",
    blocks: false,
    implemented: false,
  },
];

const byKind = new Map(MAP_ITEM_TYPES.map((t) => [t.kind, t]));

export function getMapItemType(kind: MapItemKind): MapItemTypeDef | undefined {
  return byKind.get(kind);
}
