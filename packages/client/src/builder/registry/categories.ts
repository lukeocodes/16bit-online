/**
 * Canonical tile categories for the world-builder picker.
 *
 * Every category is advertised in the sidebar even when no tiles currently
 * match — that makes the taxonomy discoverable as the registry fills in over
 * time. Add a new category by appending to CATEGORIES.
 *
 * Category IDs are lowercase-kebab stable slugs; never rename, only add.
 * The `name` is the display string. `order` controls sidebar position.
 */

export type CategoryId =
  | "terrain"
  | "forest"
  | "trees"
  | "water"
  | "bridges"
  | "buildings"
  | "roofs"
  | "doors"
  | "windows"
  | "furniture"
  | "containers"
  | "lights"
  | "plants"
  | "signs"
  | "props"
  | "crops"
  | "livestock"
  | "characters"
  | "effects"
  | "uncategorised";

export interface CategoryDef {
  id: CategoryId;
  name: string;
  description: string;
  /** Display order in the picker sidebar (smaller → top). */
  order: number;
  /** Optional preview tile for the sidebar icon; `{ tileset, tileId }`. */
  preview?: { tileset: string; tileId: number };
  /** Related categories — shown as "see also" hints. */
  related?: CategoryId[];
}

export const CATEGORIES: CategoryDef[] = [
  {
    id: "terrain", name: "Terrain", order: 10,
    description: "Ground / floor tiles: grass, dirt, sand, stone paths, etc. Placed on the ground layer.",
    related: ["forest", "bridges"],
  },
  {
    id: "forest", name: "Forest", order: 20,
    description: "Mixed forest-theme decoration: bushes, logs, stumps, forest-floor detail.",
    related: ["trees", "plants", "terrain"],
  },
  {
    id: "trees", name: "Trees", order: 30,
    description: "Tree trunks (walls, solid) and canopies (render above the player, walk-under).",
    related: ["forest"],
  },
  {
    id: "plants", name: "Plants", order: 40,
    description: "Flowers, tall grass, mushrooms, and other small fauna.",
    related: ["crops", "forest"],
  },
  {
    id: "crops", name: "Crops", order: 45,
    description: "Cultivated crops — wheat, corn, pumpkin, planted beds, scarecrows.",
    related: ["plants"],
  },
  {
    id: "water", name: "Water", order: 50,
    description: "Water tiles (animated sparkles, waterfalls, ponds). Typically collision.",
    related: ["bridges"],
  },
  {
    id: "bridges", name: "Bridges", order: 60,
    description: "Wooden and stone bridges crossing water or gaps.",
    related: ["water"],
  },
  {
    id: "buildings", name: "Buildings", order: 70,
    description: "Exterior walls and structural building parts (thatch, timber, stone, half-timber).",
    related: ["roofs", "doors", "windows", "furniture"],
  },
  {
    id: "roofs", name: "Roofs", order: 72,
    description: "Roof tiles (thatched, tiled, shingle). Usually placed on the canopy layer.",
    related: ["buildings"],
  },
  {
    id: "doors", name: "Doors", order: 74,
    description: "Interior and exterior doors. Will become interactable when the door system lands.",
    related: ["buildings"],
  },
  {
    id: "windows", name: "Windows", order: 76,
    description: "Windows set into walls. Purely visual for now.",
    related: ["buildings"],
  },
  {
    id: "furniture", name: "Furniture", order: 80,
    description: "Beds, tables, chairs, stoves, shelves — indoor fixtures.",
    related: ["buildings", "containers"],
  },
  {
    id: "containers", name: "Containers", order: 82,
    description: "Chests, barrels, crates, urns. Will hold items once the storage system lands.",
    related: ["furniture"],
  },
  {
    id: "lights", name: "Lights", order: 84,
    description: "Lanterns, torches, candles, campfires. Will emit light in the lighting pass.",
    related: ["furniture"],
  },
  {
    id: "signs", name: "Signs", order: 86,
    description: "Wooden signs, signposts, mailboxes. Will become interactable when the sign system lands.",
    related: ["props"],
  },
  {
    id: "characters", name: "Characters", order: 90,
    description: "NPC spawn markers and player spawns. Not regular tiles.",
    related: [],
  },
  {
    id: "livestock", name: "Livestock", order: 92,
    description: "Cows, sheep, chickens, pigs, horses. NPCs with livestock behaviour.",
    related: ["characters"],
  },
  {
    id: "effects", name: "Effects", order: 96,
    description: "Particle effects, smoke, weather — overlays that render above everything.",
    related: [],
  },
  {
    id: "props", name: "Props", order: 98,
    description: "Miscellaneous decorative objects that don't fit a more specific category.",
    related: [],
  },
  {
    id: "uncategorised", name: "Uncategorised", order: 999,
    description: "Tiles from tilesets that haven't been tagged into a specific category yet.",
    related: [],
  },
];

const byId = new Map(CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: CategoryId): CategoryDef | undefined {
  return byId.get(id);
}

export function listCategoriesByOrder(): CategoryDef[] {
  return [...CATEGORIES].sort((a, b) => a.order - b.order);
}
