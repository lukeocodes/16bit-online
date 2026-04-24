/**
 * TMX → tile-row parser. Reads a Tiled `.tmx` XML document and extracts
 * enough info to materialise the map as `stamp_tiles` rows.
 *
 * Counterpart to `tmx-render.ts` (which goes the other direction — DB to
 * TMX). Shares the same Tiled flip-flag encoding on gids.
 *
 * Tileset reference resolution is best-effort: the TMX stores paths like
 * `<tileset firstgid="1" source="path/to/foo.tsx"/>`, and those paths are
 * relative to wherever the TMX was authored (usually nowhere useful from
 * the server's POV). We strip to basename, slugify, and match against the
 * canonical `tilesets.file` column. Callers supply the resolver since the
 * DB layer isn't this module's concern.
 *
 * Layer resolution: TMX layer names are matched against our 4 wire-format
 * layers (`ground | decor | walls | canopy`) by keyword heuristic; anything
 * that doesn't match falls back to `decor` (which doesn't block movement
 * and renders above terrain, the safest default for misc overlay tiles).
 */

// Tiled flip flags on top of the base gid. Matches tmx-render.ts.
const FLIP_H = 0x80000000;
const FLIP_V = 0x40000000;
const FLIP_D = 0x20000000;
const GID_MASK = ~(FLIP_H | FLIP_V | FLIP_D) >>> 0;

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface ParsedTile {
  layer:    string;   // wire layer id
  x:        number;
  y:        number;
  tileset:  string;   // canonical `tilesets.file` (e.g. "summer-forest/summer-forest-wang-tiles.tsx")
  tileId:   number;   // local id inside the tileset
  rotation: number;   // 0 | 90 | 180 | 270
  flipH:    boolean;
  flipV:    boolean;
}

export interface ParsedTmx {
  width:  number;
  height: number;
  tiles:  ParsedTile[];
  /** Unresolved tileset references (TMX path → basename). Present for
   *  diagnostic purposes; tiles that reference unresolved tilesets are
   *  DROPPED from `tiles`. */
  unresolvedTilesets: Array<{ tmxSource: string; basename: string }>;
  warnings: string[];
}

export type TilesetResolver = (basename: string) => string | null;

// ---------------------------------------------------------------------------
// Regex-based XML scraping (Tiled TMX is simple and very regular).
// ---------------------------------------------------------------------------

function attr(src: string, key: string): string | undefined {
  return src.match(new RegExp(`\\b${key}="([^"]*)"`))?.[1];
}

/** Derive the canonical basename (without extension) from any TMX tileset
 *  `source` path: `../../foo/bar/summer forest wang tiles.tsx` →
 *  `summer forest wang tiles`. */
function tsxBasename(sourcePath: string): string {
  const last = sourcePath.split(/[\\/]/).pop() ?? sourcePath;
  return last.replace(/\.tsx$/i, "");
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Keyword match from Tiled layer name to our 4 wire layers. Match order
 *  matters — check more-specific names first. */
function mapLayerName(rawName: string): string {
  const n = rawName.toLowerCase();
  if (/\bcanopy|canopies?|\boverhead|above|over\d*\b/.test(n)) return "canopy";
  if (/\bwall|walls|collid|solid|build/.test(n))              return "walls";
  if (/\bground|floor|terrain|grass|base|under\d*\b/.test(n)) return "ground";
  return "decor";
}

// ---------------------------------------------------------------------------
// Main parse
// ---------------------------------------------------------------------------

export function parseTmx(xml: string, resolve: TilesetResolver): ParsedTmx {
  const warnings: string[] = [];
  const mapMatch = xml.match(/<map\b([^>]*)>/);
  if (!mapMatch) throw new Error("TMX: no <map> element");
  const width  = +(attr(mapMatch[1], "width")  ?? NaN);
  const height = +(attr(mapMatch[1], "height") ?? NaN);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error("TMX: <map> missing width/height");
  }

  // --- Tileset table: firstgid → resolved canonical file (+ basename for diagnostics).
  interface TsRef { firstgid: number; tmxSource: string; basename: string; resolved: string | null }
  const refs: TsRef[] = [];
  // Match self-closing `<tileset … />` — slashes are legal inside attribute
  // values (source paths!), so we can't use `[^/>]`. Match any content that
  // doesn't close the tag, ending at `/>` or `>`.
  const tsRe = /<tileset\b([^>]*?)\/?>/g;
  let tm: RegExpExecArray | null;
  while ((tm = tsRe.exec(xml)) !== null) {
    const firstgid = +(attr(tm[1], "firstgid") ?? NaN);
    const source   = attr(tm[1], "source");
    if (!Number.isFinite(firstgid) || !source) continue;
    const basename = tsxBasename(source);
    const resolved = resolve(basename) ?? resolve(slugify(basename));
    refs.push({ firstgid, tmxSource: source, basename, resolved });
    if (!resolved) {
      warnings.push(`Tileset '${basename}' not found in DB — tiles referencing it will be dropped`);
    }
  }
  refs.sort((a, b) => a.firstgid - b.firstgid);

  const unresolvedTilesets = refs
    .filter(r => !r.resolved)
    .map(({ tmxSource, basename }) => ({ tmxSource, basename }));

  /** Find the tileset reference containing the given gid (largest firstgid
   *  that's still ≤ gid). */
  function findRef(gid: number): TsRef | null {
    let hit: TsRef | null = null;
    for (const r of refs) {
      if (r.firstgid <= gid) hit = r; else break;
    }
    return hit;
  }

  // --- Layer tables.
  const tiles: ParsedTile[] = [];
  const layerRe = /<layer\b([^>]*)>([\s\S]*?)<\/layer>/g;
  let lm: RegExpExecArray | null;
  while ((lm = layerRe.exec(xml)) !== null) {
    const rawName = attr(lm[1], "name") ?? "decor";
    const lw      = +(attr(lm[1], "width")  ?? width);
    const lh      = +(attr(lm[1], "height") ?? height);
    const wireLayer = mapLayerName(rawName);

    // Data can be inside one bare <data encoding="csv"> or chunked. Handle
    // both by concatenating all CSV chunks and re-indexing by position
    // using `<chunk x= y= width= height=>` deltas.
    const dataMatch = lm[2].match(/<data\b([^>]*)>([\s\S]*?)<\/data>/);
    if (!dataMatch) continue;
    const encoding = attr(dataMatch[1], "encoding");
    if (encoding && encoding !== "csv") {
      warnings.push(`Layer '${rawName}': only 'csv' encoding supported (got '${encoding}') — skipped`);
      continue;
    }

    const chunks: Array<{ x: number; y: number; w: number; h: number; csv: string }> = [];
    const chunkRe = /<chunk\b([^>]*)>([\s\S]*?)<\/chunk>/g;
    let cm: RegExpExecArray | null;
    while ((cm = chunkRe.exec(dataMatch[2])) !== null) {
      chunks.push({
        x: +(attr(cm[1], "x") ?? 0),
        y: +(attr(cm[1], "y") ?? 0),
        w: +(attr(cm[1], "width")  ?? lw),
        h: +(attr(cm[1], "height") ?? lh),
        csv: cm[2],
      });
    }
    // Bare (non-chunked) infinite-off layer: treat the whole CSV as a chunk at (0,0).
    if (chunks.length === 0) {
      chunks.push({ x: 0, y: 0, w: lw, h: lh, csv: dataMatch[2] });
    }

    for (const ch of chunks) {
      const values = ch.csv
        .split(",")
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map(s => Number(s) >>> 0);  // unsigned 32-bit (preserve flip flags)
      for (let i = 0; i < values.length; i++) {
        const raw = values[i];
        if (raw === 0) continue;  // empty cell
        const flipH = !!(raw & FLIP_H);
        const flipV = !!(raw & FLIP_V);
        const flipD = !!(raw & FLIP_D);
        const gid   = raw & GID_MASK;

        const ref = findRef(gid);
        if (!ref) continue;            // gid without a tileset table — skip
        if (!ref.resolved) continue;   // tileset unresolved — drop tile
        const tileId = gid - ref.firstgid;

        // Decode rotation from flip flags (inverse of applyRotation()).
        //   0°:   no flags
        //   90°:  FLIP_D | FLIP_H   → flipD=true, flipH=true
        //   180°: FLIP_H | FLIP_V   → flipH=true, flipV=true
        //   270°: FLIP_D | FLIP_V   → flipD=true, flipV=true
        let rotation = 0;
        let residualH = flipH, residualV = flipV;
        if (flipD) {
          if (flipH && !flipV) { rotation = 90;  residualH = false; residualV = false; }
          else if (flipV && !flipH) { rotation = 270; residualH = false; residualV = false; }
          else if (flipH && flipV) { rotation = 90; residualH = false; residualV = true; }
          else                     { rotation = 90; residualH = true;  residualV = false; }
        } else if (flipH && flipV) {
          rotation = 180; residualH = false; residualV = false;
        }

        const x = ch.x + (i % ch.w);
        const y = ch.y + Math.floor(i / ch.w);

        tiles.push({
          layer:    wireLayer,
          x, y,
          tileset:  ref.resolved,
          tileId,
          rotation,
          flipH:    residualH,
          flipV:    residualV,
        });
      }
    }
  }

  // Dedupe on (wireLayer, x, y) — later TMX layers overwrite earlier ones
  // at the same cell. This handles the common Mana Seed pattern where a
  // TMX has "under1"/"under2"/"over1"/"over2" that all collapse to our 4
  // wire layers (ground/decor/walls/canopy). Without dedupe, the DB
  // uniqueIndex on (stamp_id, layer, x, y) would reject the insert.
  const dedupe = new Map<string, ParsedTile>();
  for (const t of tiles) dedupe.set(`${t.layer}|${t.x}|${t.y}`, t);
  const collapsed = tiles.length - dedupe.size;
  if (collapsed > 0) {
    warnings.push(`Collapsed ${collapsed} overlapping TMX-layer cell(s) to top-most wire layer`);
  }
  return {
    width,
    height,
    tiles: [...dedupe.values()],
    unresolvedTilesets,
    warnings,
  };
}
