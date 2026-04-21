/**
 * Tile category type contracts. Data lives in the database and is fetched
 * via `store.ts` at boot. See AGENTS.md "Data in the Database" — this file
 * is NOT where categorization lives.
 *
 * Category IDs are lowercase-kebab stable slugs, matched 1:1 with the
 * `tile_categories.id` column. Never rename an ID; add new ones. Deleting
 * an ID requires a migration because it's referenced as a FK by
 * `tilesets.default_category_id`, `tileset_sub_regions.category_id`, and
 * `tile_overrides.category_id`.
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
  /** Optional preview tile for the sidebar icon. */
  preview?: { tileset: string; tileId: number };
  /** Related categories — shown as "see also" hints. */
  related?: CategoryId[];
}

// Runtime accessors live in ./store.ts — re-export for import ergonomics.
export { listCategoriesByOrder, getCategory } from "./store.js";
