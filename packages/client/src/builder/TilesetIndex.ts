/**
 * Tileset index — loads the server-side registry (categories + layers +
 * tilesets + sub-regions + empty flags + animations + overrides), then
 * fetches each tileset's PNG to build Excalibur SpriteSheets + render
 * previews in the picker.
 *
 * The server is the source-of-truth for ALL metadata (see AGENTS.md
 * "Data in the Database"). This file does NOT parse TSX or scan PNGs —
 * the server's ingestion pass did that once and persisted the results.
 *
 * Overrides now live in `tile_overrides` and are mutated via the store's
 * async `setOverride` / `clearOverride`. See `./registry/store.ts`.
 */
import { ImageSource, Sprite, Animation, AnimationStrategy, SpriteSheet } from "excalibur";
import {
  loadRegistry,
  listTilesets,
  matchSubRegion,
  getOverride,
  type RemoteTilesetDef,
} from "./registry/store.js";
import type { CategoryId } from "./registry/categories.js";
import type { LayerId }    from "./registry/layers.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AnimationFrame {
  tileId:   number;
  duration: number;  // ms
}

export interface TileEntry {
  /** TSX filename (path relative to /maps/). Unique key for lookups. */
  tileset:   string;
  /** Local tile id inside the TSX (row-major, 0-based). */
  tileId:    number;
  /** Pixel source rect inside the tileset image. */
  sx:        number;
  sy:        number;
  sw:        number;
  sh:        number;
  /** When present, this tile is animated. Frame 0 is the base sprite. */
  animation?: AnimationFrame[];
  /** Resolved category after applying subRegions/overrides. */
  category:  CategoryId;
  /** Whether this specific tile blocks player movement. */
  blocks:    boolean;
  /** Preferred placement layer for this tile. */
  defaultLayer: LayerId;
  /** Searchable label (human-readable). */
  label:     string;
  /** Grid position inside the tileset. */
  col:       number;
  row:       number;
  /** When true, this tile is excluded from the picker. Empty tiles are
   *  NOT represented in `meta.entries` at all (the array has a hole at
   *  that tileId); `hidden: true` only comes from an override or
   *  sub-region explicitly marking a real tile as hidden. */
  hidden:    boolean;
}

export interface TilesetMeta {
  file:        string;
  name:        string;
  tilewidth:   number;
  tileheight:  number;
  columns:     number;
  tilecount:   number;
  imageUrl:    string;
  imageWidth:  number;
  imageHeight: number;
  image:       HTMLImageElement | null;
  exImage:     ImageSource | null;
  exSheet:     SpriteSheet | null;
  /** Per-tileId animation frames (head tile → frame list). */
  animations:  Map<number, AnimationFrame[]>;
  /** Tile IDs flagged empty in the DB — skipped entirely in entries. */
  emptyTiles:  Set<number>;
  /** Registry entry this tileset was loaded from (server-shaped). */
  def:         RemoteTilesetDef;
  /** Sparse array indexed by tileId; empty tiles leave holes. */
  entries:     (TileEntry | undefined)[];
}

// ---------------------------------------------------------------------------
// Entry generation — applies subRegion overrides + author overrides
// ---------------------------------------------------------------------------

/** Build entries from definition + sub-regions + author overrides.
 *  Order of precedence: TilesetDef → SubRegion → Override (last wins).
 *
 *  Empty tiles are skipped entirely — `meta.entries[i]` stays undefined
 *  for those IDs. They never become TileEntry objects, save picker memory,
 *  and can't be revealed (not real tiles, just unused cells). */
export function buildEntries(meta: TilesetMeta): void {
  meta.entries.length = 0;
  meta.entries.length = meta.tilecount;

  const def = meta.def;
  const baseCategory     = def.category;
  const baseBlocks       = def.blocks ?? false;
  const baseDefaultLayer = (def.defaultLayer ?? "ground") as LayerId;

  for (let i = 0; i < meta.tilecount; i++) {
    if (meta.emptyTiles.has(i)) continue;

    const col = i % meta.columns;
    const row = Math.floor(i / meta.columns);
    const sr  = matchSubRegion(def, i);
    const ov  = getOverride(meta.file, i);

    const category     = (ov?.category     ?? sr?.category     ?? baseCategory) as CategoryId;
    const blocks       = ov?.blocks       ?? sr?.blocks       ?? baseBlocks;
    const defaultLayer = (ov?.defaultLayer ?? sr?.defaultLayer ?? baseDefaultLayer) as LayerId;
    const animation    = meta.animations.get(i);
    const animSuffix   = animation && animation.length > 1 ? "⟳" : "";
    const baseLabel    = sr?.label
      ? `${sr.label} — ${meta.name} #${i}${animSuffix}`
      : `${meta.name} #${i}${animSuffix}`;
    const label        = ov?.name ? `${ov.name} (${meta.name} #${i})${animSuffix}` : baseLabel;
    const hidden       = (ov?.hide ?? sr?.hide ?? false) === true;

    meta.entries[i] = {
      tileset:      meta.file,
      tileId:       i,
      sx:           col * meta.tilewidth,
      sy:           row * meta.tileheight,
      sw:           meta.tilewidth,
      sh:           meta.tileheight,
      animation,
      category,
      blocks: blocks === true,
      defaultLayer,
      label,
      col, row,
      hidden,
    };
  }
}

// ---------------------------------------------------------------------------
// Public TilesetIndex
// ---------------------------------------------------------------------------

export class TilesetIndex {
  readonly tilesets = new Map<string, TilesetMeta>();
  private ready: Promise<void> | null = null;

  /** Load registry + all tileset images. Idempotent. */
  load(): Promise<void> {
    if (!this.ready) this.ready = this.doLoad();
    return this.ready;
  }

  private async doLoad(): Promise<void> {
    // Phase 1: pull all DB-backed metadata in one request.
    await loadRegistry();

    // Phase 2: fetch each tileset's PNG + build Excalibur assets.
    const defs = listTilesets();
    let totalEmpty = 0;

    await Promise.all(defs.map(async (def) => {
      try {
        const image = await loadImage(def.imageUrl);

        const animations = new Map<number, AnimationFrame[]>();
        for (const [headIdStr, frames] of Object.entries(def.animations)) {
          animations.set(+headIdStr, frames.map((f) => ({ tileId: f.tileId, duration: f.duration })));
        }

        const emptyTiles = new Set(def.emptyTiles);
        totalEmpty += emptyTiles.size;

        const exImage = ImageSource.fromHtmlImageElement(image);
        await exImage.load();
        const exSheet = SpriteSheet.fromImageSource({
          image: exImage,
          grid:  {
            rows:         Math.ceil(def.tilecount / def.columns),
            columns:      def.columns,
            spriteWidth:  def.tilewidth,
            spriteHeight: def.tileheight,
          },
        });

        const meta: TilesetMeta = {
          file:        def.file,
          name:        def.name,
          tilewidth:   def.tilewidth,
          tileheight:  def.tileheight,
          columns:     def.columns,
          tilecount:   def.tilecount,
          imageUrl:    def.imageUrl,
          imageWidth:  def.imageWidth,
          imageHeight: def.imageHeight,
          image,
          exImage,
          exSheet,
          animations,
          emptyTiles,
          def,
          entries:     [],
        };
        buildEntries(meta);
        this.tilesets.set(def.file, meta);
      } catch (err) {
        console.warn(`[Tiles] Failed to load ${def.file}:`, err);
      }
    }));
    console.log(
      `[Tiles] Indexed ${this.tilesets.size} tileset(s), ` +
      `${this.allEntries().length} visible tile(s); ` +
      `${totalEmpty} empty tile(s) deleted (from DB)`,
    );
  }

  /** Static Sprite for a tile (or null if tileset not loaded). */
  makeSprite(tileset: string, tileId: number): Sprite | null {
    const meta = this.tilesets.get(tileset);
    if (!meta || !meta.exSheet) return null;
    const col = tileId % meta.columns;
    const row = Math.floor(tileId / meta.columns);
    return meta.exSheet.getSprite(col, row);
  }

  /** Animation for animated tiles, Sprite for static tiles, null on miss. */
  makeGraphic(tileset: string, tileId: number): Sprite | Animation | null {
    const meta = this.tilesets.get(tileset);
    if (!meta || !meta.exSheet) return null;
    const anim = meta.animations.get(tileId);
    if (!anim || anim.length <= 1) {
      return this.makeSprite(tileset, tileId);
    }
    const frames = anim.map((f) => {
      const col = f.tileId % meta.columns;
      const row = Math.floor(f.tileId / meta.columns);
      return { graphic: meta.exSheet!.getSprite(col, row), duration: f.duration };
    });
    return new Animation({ frames, strategy: AnimationStrategy.Loop });
  }

  getTileset(file: string): TilesetMeta | undefined {
    return this.tilesets.get(file);
  }

  allEntries(): TileEntry[] {
    const out: TileEntry[] = [];
    for (const t of this.tilesets.values()) {
      if (t.def.hidden) continue;
      for (const e of t.entries) {
        if (!e || e.hidden) continue;
        out.push(e);
      }
    }
    return out;
  }

  /** Unique categories that currently have at least one tile. */
  categoriesWithTiles(): CategoryId[] {
    const s = new Set<CategoryId>();
    for (const t of this.tilesets.values()) {
      if (t.def.hidden) continue;
      for (const e of t.entries) {
        if (!e) continue;
        s.add(e.category);
      }
    }
    return Array.from(s);
  }

  /** Filter entries by category (null = all) and optional text query. */
  filter(category: CategoryId | null, query: string): TileEntry[] {
    const q = query.trim().toLowerCase();
    const all = this.allEntries();
    return all.filter((e) => {
      if (category && e.category !== category) return false;
      if (!q) return true;
      const ts = this.tilesets.get(e.tileset);
      const tags = ts?.def.tags?.join(" ") ?? "";
      return e.label.toLowerCase().includes(q)
          || e.tileset.toLowerCase().includes(q)
          || e.category.toLowerCase().includes(q)
          || tags.toLowerCase().includes(q);
    });
  }

  /** Lookup a single tile entry by (tileset, tileId). */
  find(tileset: string, tileId: number): TileEntry | undefined {
    const ts = this.tilesets.get(tileset);
    return ts?.entries[tileId];
  }

  /** Re-build entries for one tileset after an override changes. */
  refreshEntries(tileset: string): void {
    const ts = this.tilesets.get(tileset);
    if (!ts) return;
    buildEntries(ts);
  }
}

// ---------------------------------------------------------------------------
// Image loader
// ---------------------------------------------------------------------------

const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(url: string): Promise<HTMLImageElement> {
  let p = imageCache.get(url);
  if (!p) {
    p = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload  = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
    imageCache.set(url, p);
  }
  return p;
}
