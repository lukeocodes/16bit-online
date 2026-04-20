/**
 * Tileset index — loads every registered TSX file (see ./registry/tilesets)
 * and exposes a flat list of "tile entries" for the picker, the brush
 * ghost, and on-map rendering.
 *
 * Categorisation, layer defaults, and collision flags come from the
 * registry; this file is now purely about IO + indexing. To add a new
 * tileset, append to `registry/tilesets.ts` — no changes here.
 *
 * Every tileset is loaded as BOTH a raw HTMLImageElement (for the HTML tile
 * picker previews) AND an Excalibur ImageSource (for in-game rendering).
 * Both reuse the same decoded bitmap via `ImageSource.fromHtmlImageElement`.
 */
import { ImageSource, Sprite, Animation, AnimationStrategy, SpriteSheet } from "excalibur";
import { listTilesets, matchSubRegion, type TilesetDef } from "./registry/tilesets.js";
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
  /** Resolved category after applying subRegions (may differ from the
   *  tileset's default category). */
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
}

export interface TilesetMeta {
  file:        string;          // path relative to /maps/
  name:        string;          // display name from TSX
  tilewidth:   number;
  tileheight:  number;
  columns:     number;
  tilecount:   number;
  imageUrl:    string;          // resolved absolute URL to the PNG
  imageWidth:  number;
  imageHeight: number;
  /** Loaded image bitmap. Null until loadImage() resolves. */
  image:       HTMLImageElement | null;
  /** Excalibur ImageSource wrapping the same image; null until loaded. */
  exImage:     ImageSource | null;
  /** Excalibur spritesheet over the whole tileset. */
  exSheet:     SpriteSheet | null;
  /** Per-tileId animation frames, if any. */
  animations:  Map<number, AnimationFrame[]>;
  /** Registry entry this tileset was loaded from. */
  def:         TilesetDef;
  /** Generated entries, one per tile. */
  entries:     TileEntry[];
}

// ---------------------------------------------------------------------------
// TSX parser (regex, zero deps)
// ---------------------------------------------------------------------------

function attr(src: string, key: string): string | undefined {
  const re = new RegExp(`\\b${key}="([^"]*)"`);
  return src.match(re)?.[1];
}

function requireAttr(src: string, key: string): string {
  const v = attr(src, key);
  if (v === undefined) throw new Error(`Missing attribute '${key}'`);
  return v;
}

/** Encode spaces/special chars per path segment but leave the `.tsx`
 *  extension unencoded. Vite's dev server treats encoded `.tsx` requests as
 *  React component files and serves index.html instead of the tileset, so we
 *  have to be careful with the encoding. Browsers do URL-encode spaces
 *  during fetch automatically, so only commas/parentheses need attention. */
function encodePath(path: string): string {
  return path.split("/").map((seg) => {
    // Encode characters that break the URL parser but leave reserved chars
    // like `.`, `(`, `)`, `,` alone. Space will be auto-encoded by fetch.
    return seg.replace(/[#?&=]/g, encodeURIComponent);
  }).join("/");
}

function parseTsxXml(xml: string, def: TilesetDef): TilesetMeta {
  const tsHead = xml.match(/<tileset\b([^>]*)>/);
  if (!tsHead) throw new Error(`No <tileset> in ${def.file}`);
  const tsAttrs = tsHead[1];

  const imgMatch = xml.match(/<image\b([^>]*?)\/>/);
  if (!imgMatch) throw new Error(`No <image> in ${def.file}`);
  const imgAttrs = imgMatch[1];

  const imgSrc = requireAttr(imgAttrs, "source");
  const imageUrl = resolveRelative(`/maps/${def.file}`, imgSrc);

  const meta: TilesetMeta = {
    file:        def.file,
    name:        requireAttr(tsAttrs, "name"),
    tilewidth:   +requireAttr(tsAttrs, "tilewidth"),
    tileheight:  +requireAttr(tsAttrs, "tileheight"),
    tilecount:   +requireAttr(tsAttrs, "tilecount"),
    columns:     +requireAttr(tsAttrs, "columns"),
    imageUrl,
    imageWidth:  +requireAttr(imgAttrs, "width"),
    imageHeight: +requireAttr(imgAttrs, "height"),
    image:       null,
    exImage:     null,
    exSheet:     null,
    animations:  new Map(),
    def,
    entries:     [],
  };

  // Parse animations.
  //   <tile id="N"><animation><frame tileid="M" duration="D"/>...</animation></tile>
  const tileRe = /<tile\b([^>]*)>([\s\S]*?)<\/tile>/g;
  let m: RegExpExecArray | null;
  while ((m = tileRe.exec(xml)) !== null) {
    const id = +requireAttr(m[1], "id");
    const body = m[2];
    const animMatch = body.match(/<animation>([\s\S]*?)<\/animation>/);
    if (!animMatch) continue;
    const frames: AnimationFrame[] = [];
    const frameRe = /<frame\b([^/]*)\/>/g;
    let fm: RegExpExecArray | null;
    while ((fm = frameRe.exec(animMatch[1])) !== null) {
      frames.push({
        tileId:   +requireAttr(fm[1], "tileid"),
        duration: +requireAttr(fm[1], "duration"),
      });
    }
    if (frames.length > 0) meta.animations.set(id, frames);
  }

  return meta;
}

/** Resolve a relative image source against the TSX's URL. */
function resolveRelative(baseUrl: string, relative: string): string {
  const parts = baseUrl.split("/").slice(0, -1); // drop filename
  for (const seg of relative.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg === ".") { /* skip */ }
    else parts.push(seg);
  }
  return parts.join("/");
}

// ---------------------------------------------------------------------------
// Entry generation — applies subRegion overrides on top of tileset defaults
// ---------------------------------------------------------------------------

function buildEntries(meta: TilesetMeta): void {
  meta.entries.length = 0;
  const def = meta.def;
  const baseCategory     = def.category;
  const baseBlocks       = def.blocks ?? false;
  const baseDefaultLayer = def.defaultLayer ?? "ground";

  for (let i = 0; i < meta.tilecount; i++) {
    const col = i % meta.columns;
    const row = Math.floor(i / meta.columns);
    const sr  = matchSubRegion(def, i);

    const category     = sr?.category     ?? baseCategory;
    const blocks       = sr?.blocks       ?? baseBlocks;
    const defaultLayer = sr?.defaultLayer ?? baseDefaultLayer;
    const animation    = meta.animations.get(i);
    const animSuffix   = animation && animation.length > 1 ? "⟳" : "";
    const label        = sr?.label
      ? `${sr.label} — ${meta.name} #${i}${animSuffix}`
      : `${meta.name} #${i}${animSuffix}`;

    meta.entries.push({
      tileset:      meta.file,
      tileId:       i,
      sx:           col * meta.tilewidth,
      sy:           row * meta.tileheight,
      sw:           meta.tilewidth,
      sh:           meta.tileheight,
      animation,
      category,
      blocks,
      defaultLayer,
      label,
      col, row,
    });
  }
}

// ---------------------------------------------------------------------------
// Public TilesetIndex
// ---------------------------------------------------------------------------

export class TilesetIndex {
  readonly tilesets = new Map<string, TilesetMeta>();
  private ready: Promise<void> | null = null;

  /** Load every registered TSX + its image. Idempotent. */
  load(): Promise<void> {
    if (!this.ready) this.ready = this.doLoad();
    return this.ready;
  }

  private async doLoad(): Promise<void> {
    await Promise.all(listTilesets().map(async (def) => {
      try {
        const res = await fetch(`/maps/${encodePath(def.file)}`);
        if (!res.ok) { console.warn(`[Tiles] Missing ${def.file} (${res.status})`); return; }
        const xml = await res.text();
        const meta = parseTsxXml(xml, def);
        meta.image = await loadImage(meta.imageUrl);

        // Wrap the same decoded image in an Excalibur ImageSource (no second
        // network fetch). Build a spritesheet spanning the whole tileset.
        meta.exImage = ImageSource.fromHtmlImageElement(meta.image);
        await meta.exImage.load();
        meta.exSheet = SpriteSheet.fromImageSource({
          image: meta.exImage,
          grid:  {
            rows:         Math.ceil(meta.tilecount / meta.columns),
            columns:      meta.columns,
            spriteWidth:  meta.tilewidth,
            spriteHeight: meta.tileheight,
          },
        });

        buildEntries(meta);
        this.tilesets.set(def.file, meta);
      } catch (err) {
        console.warn(`[Tiles] Failed to load ${def.file}:`, err);
      }
    }));
    console.log(`[Tiles] Indexed ${this.tilesets.size} tileset(s), ${this.allEntries().length} tile(s) total`);
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
      out.push(...t.entries);
    }
    return out;
  }

  /** Unique categories that currently have at least one tile, sorted. */
  categoriesWithTiles(): CategoryId[] {
    const s = new Set<CategoryId>();
    for (const t of this.tilesets.values()) {
      if (t.def.hidden) continue;
      for (const e of t.entries) s.add(e.category);
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
