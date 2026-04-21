/**
 * Per-tile metadata overrides — runtime edits made by the author in the
 * picker's right pane. Persists in localStorage keyed by `<tileset>:<tileId>`.
 *
 * Apply order:  base TilesetDef  →  matching SubRegion  →  Override
 * (overrides win, by design — they're explicit author intent).
 *
 * Use the picker's "Export overrides" button to dump the current set as
 * JSON; the dev can then bake those changes into `tilesets.ts` (typically as
 * SubRegion entries) so they ship with the build.
 */
import type { CategoryId } from "./categories.js";
import type { LayerId }    from "./layers.js";

export interface TileOverride {
  category?:     CategoryId;
  /** Override the displayed label. When set, the picker uses this in place
   *  of the synthetic `<TilesetName> #<id>` string. */
  name?:         string;
  /** Tags merged with the tileset's own tags. */
  tags?:         string[];
  defaultLayer?: LayerId;
  blocks?:       boolean;
  hide?:         boolean;
}

const LS_KEY = "builder.tile.overrides";

let cache: Record<string, TileOverride> | null = null;

function load(): Record<string, TileOverride> {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(LS_KEY);
    cache = raw ? JSON.parse(raw) : {};
  } catch {
    cache = {};
  }
  return cache!;
}

function persist(): void {
  if (!cache) return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn("[overrides] localStorage write failed:", e);
  }
}

export function key(tileset: string, tileId: number): string {
  return `${tileset}:${tileId}`;
}

export function getOverride(tileset: string, tileId: number): TileOverride | undefined {
  return load()[key(tileset, tileId)];
}

export function setOverride(tileset: string, tileId: number, ov: TileOverride): void {
  const map = load();
  // Drop empty overrides entirely so the export stays clean.
  if (Object.keys(ov).length === 0) {
    delete map[key(tileset, tileId)];
  } else {
    map[key(tileset, tileId)] = ov;
  }
  persist();
}

export function clearOverride(tileset: string, tileId: number): void {
  const map = load();
  delete map[key(tileset, tileId)];
  persist();
}

export function allOverrides(): Record<string, TileOverride> {
  return { ...load() };
}

export function exportJson(): string {
  return JSON.stringify(load(), null, 2);
}

/** Returns true if any override exists. */
export function hasAny(): boolean {
  return Object.keys(load()).length > 0;
}
