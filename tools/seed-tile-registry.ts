/**
 * Phase-1 seed script — migrates client-side registry data into the DB.
 *
 * Reads:
 *   - packages/client/src/builder/registry/categories.ts → CATEGORIES[]
 *   - packages/client/src/builder/registry/layers.ts     → LAYERS[]
 *   - packages/client/src/builder/registry/tilesets.ts   → TILESETS[]
 *   - packages/client/src/builder/registry/empty-tiles.json
 *
 * Writes:
 *   - tile_categories, map_layers, tilesets, tileset_sub_regions,
 *     tile_empty_flags, tile_animations
 *
 * Parses each TSX file on disk to populate structural columns (tilewidth,
 * tileheight, columns, tilecount, image_*) and animations.
 *
 * Idempotent — safe to re-run. Uses `INSERT … ON CONFLICT DO UPDATE`.
 *
 * Uses raw `postgres` client (same pattern as tools/freeze-map.ts) to
 * avoid cross-package drizzle-orm resolution from the repo-root tools/.
 *
 * Run from repo root:
 *   bun tools/seed-tile-registry.ts
 *
 * This is a one-time migration. Once the client fetches from the DB, the
 * source registry files get deleted and new metadata is authored
 * exclusively in the builder UI (persists to DB via HTTP/WebRTC).
 * See AGENTS.md "Data in the Database".
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import postgres from "postgres";

// Source registry — imports resolve via Bun's TS/monorepo resolution.
import { CATEGORIES } from "../packages/client/src/builder/registry/categories.ts";
import { LAYERS }     from "../packages/client/src/builder/registry/layers.ts";
import { TILESETS }   from "../packages/client/src/builder/registry/tilesets.ts";
import emptyTilesManifest from "../packages/client/src/builder/registry/empty-tiles.json" with { type: "json" };

const REPO_ROOT = resolve(import.meta.dirname, "..");
const MAPS_DIR  = resolve(REPO_ROOT, "packages/client/public/maps");
const DATABASE_URL = process.env.DATABASE_URL
  ?? "postgresql://game:game_dev_password@localhost:5433/game";

const sql = postgres(DATABASE_URL);

// ---------------------------------------------------------------------------
// TSX XML parser (same regex approach as TilesetIndex.ts)
// ---------------------------------------------------------------------------

interface ParsedTsx {
  name:        string;
  tilewidth:   number;
  tileheight:  number;
  columns:     number;
  tilecount:   number;
  imageUrl:    string;      // /maps/... URL the client fetches
  imageWidth:  number;
  imageHeight: number;
  animations:  Array<{ headTileId: number; frames: Array<{ tileId: number; duration: number }> }>;
}

function attr(src: string, key: string): string | undefined {
  return src.match(new RegExp(`\\b${key}="([^"]*)"`))?.[1];
}
function requireAttr(src: string, key: string, where: string): string {
  const v = attr(src, key);
  if (v === undefined) throw new Error(`${where}: missing attribute '${key}'`);
  return v;
}

function parseTsx(xml: string, tsxFile: string): ParsedTsx {
  const tsHead = xml.match(/<tileset\b([^>]*)>/);
  if (!tsHead) throw new Error(`${tsxFile}: no <tileset>`);
  const imgMatch = xml.match(/<image\b([^>]*?)\/>/);
  if (!imgMatch) throw new Error(`${tsxFile}: no <image>`);

  const imgSrcRaw = requireAttr(imgMatch[1], "source", `${tsxFile} <image>`);
  const tsxDir = dirname(`/maps/${tsxFile}`);
  const imageUrl = resolveRelUrl(tsxDir, imgSrcRaw);

  const animations: ParsedTsx["animations"] = [];
  const tileRe = /<tile\b([^>]*)>([\s\S]*?)<\/tile>/g;
  let m: RegExpExecArray | null;
  while ((m = tileRe.exec(xml)) !== null) {
    const headId = +requireAttr(m[1], "id", `${tsxFile} <tile>`);
    const body = m[2];
    const animMatch = body.match(/<animation>([\s\S]*?)<\/animation>/);
    if (!animMatch) continue;
    const frames: Array<{ tileId: number; duration: number }> = [];
    const frameRe = /<frame\b([^/]*)\/>/g;
    let fm: RegExpExecArray | null;
    while ((fm = frameRe.exec(animMatch[1])) !== null) {
      frames.push({
        tileId:   +requireAttr(fm[1], "tileid",  `${tsxFile} <frame>`),
        duration: +requireAttr(fm[1], "duration", `${tsxFile} <frame>`),
      });
    }
    if (frames.length > 0) animations.push({ headTileId: headId, frames });
  }

  return {
    name:        requireAttr(tsHead[1], "name",       `${tsxFile} <tileset>`),
    tilewidth:   +requireAttr(tsHead[1], "tilewidth",  `${tsxFile} <tileset>`),
    tileheight:  +requireAttr(tsHead[1], "tileheight", `${tsxFile} <tileset>`),
    columns:     +requireAttr(tsHead[1], "columns",    `${tsxFile} <tileset>`),
    tilecount:   +requireAttr(tsHead[1], "tilecount",  `${tsxFile} <tileset>`),
    imageUrl,
    imageWidth:  +requireAttr(imgMatch[1], "width",  `${tsxFile} <image>`),
    imageHeight: +requireAttr(imgMatch[1], "height", `${tsxFile} <image>`),
    animations,
  };
}

function resolveRelUrl(baseDir: string, relative: string): string {
  const parts = baseDir.split("/").filter(Boolean);
  for (const seg of relative.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg === ".") { /* skip */ }
    else parts.push(seg);
  }
  return "/" + parts.join("/");
}

// ---------------------------------------------------------------------------
// Seed steps — all use raw SQL via `postgres` (postgres.js tagged template).
// ---------------------------------------------------------------------------

async function seedCategories() {
  console.log(`\n[seed] tile_categories — ${CATEGORIES.length} rows`);
  for (const c of CATEGORIES) {
    await sql`
      INSERT INTO tile_categories
        (id, name, description, display_order, preview_tileset, preview_tile_id, related, updated_at)
      VALUES
        (${c.id}, ${c.name}, ${c.description ?? ""}, ${c.order},
         ${c.preview?.tileset ?? null}, ${c.preview?.tileId ?? null},
         ${sql.json(c.related ?? [])}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        name             = EXCLUDED.name,
        description      = EXCLUDED.description,
        display_order    = EXCLUDED.display_order,
        preview_tileset  = EXCLUDED.preview_tileset,
        preview_tile_id  = EXCLUDED.preview_tile_id,
        related          = EXCLUDED.related,
        updated_at       = NOW()
    `;
  }
}

async function seedLayers() {
  console.log(`[seed] map_layers — ${LAYERS.length} rows`);
  for (const l of LAYERS) {
    await sql`
      INSERT INTO map_layers
        (id, name, description, z, collides, above_character, display_order, updated_at)
      VALUES
        (${l.id}, ${l.name}, ${l.description}, ${l.z},
         ${l.collides}, ${l.aboveCharacter}, ${l.order}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        name             = EXCLUDED.name,
        description      = EXCLUDED.description,
        z                = EXCLUDED.z,
        collides         = EXCLUDED.collides,
        above_character  = EXCLUDED.above_character,
        display_order    = EXCLUDED.display_order,
        updated_at       = NOW()
    `;
  }
}

async function seedTilesets() {
  console.log(`[seed] tilesets — ${TILESETS.length} rows`);
  let upserted = 0;
  let missing = 0;
  let skipped = 0;
  let subRegionCount = 0;
  let animationRowCount = 0;

  for (const def of TILESETS) {
    const tsxPath = resolve(MAPS_DIR, def.file);
    if (!existsSync(tsxPath)) {
      console.warn(`  [miss] ${def.file}`);
      missing++;
      continue;
    }

    let parsed: ParsedTsx;
    try {
      parsed = parseTsx(readFileSync(tsxPath, "utf8"), def.file);
    } catch (err) {
      console.warn(`  [parse] ${def.file}: ${(err as Error).message}`);
      skipped++;
      continue;
    }

    await sql`
      INSERT INTO tilesets (
        file, slug, name,
        tilewidth, tileheight, columns, tilecount,
        image_url, image_width, image_height,
        default_category_id, default_layer_id, default_blocks,
        tags, seasonal, hidden, auto_hide_labels, notes, updated_at
      ) VALUES (
        ${def.file}, ${def.id}, ${parsed.name},
        ${parsed.tilewidth}, ${parsed.tileheight}, ${parsed.columns}, ${parsed.tilecount},
        ${parsed.imageUrl}, ${parsed.imageWidth}, ${parsed.imageHeight},
        ${def.category}, ${def.defaultLayer ?? null}, ${def.blocks ?? false},
        ${sql.json(def.tags ?? [])}, ${def.seasonal ?? null},
        ${def.hidden ?? false}, ${def.autoHideLabels ?? false},
        ${def.notes ?? null}, NOW()
      )
      ON CONFLICT (file) DO UPDATE SET
        slug                = EXCLUDED.slug,
        name                = EXCLUDED.name,
        tilewidth           = EXCLUDED.tilewidth,
        tileheight          = EXCLUDED.tileheight,
        columns             = EXCLUDED.columns,
        tilecount           = EXCLUDED.tilecount,
        image_url           = EXCLUDED.image_url,
        image_width         = EXCLUDED.image_width,
        image_height        = EXCLUDED.image_height,
        default_category_id = EXCLUDED.default_category_id,
        default_layer_id    = EXCLUDED.default_layer_id,
        default_blocks      = EXCLUDED.default_blocks,
        tags                = EXCLUDED.tags,
        seasonal            = EXCLUDED.seasonal,
        hidden              = EXCLUDED.hidden,
        auto_hide_labels    = EXCLUDED.auto_hide_labels,
        notes               = EXCLUDED.notes,
        updated_at          = NOW()
    `;
    upserted++;

    // Replace sub-regions (easier than diff-upsert, table is small).
    await sql`DELETE FROM tileset_sub_regions WHERE tileset_file = ${def.file}`;
    if (def.subRegions && def.subRegions.length > 0) {
      for (let idx = 0; idx < def.subRegions.length; idx++) {
        const sr = def.subRegions[idx];
        await sql`
          INSERT INTO tileset_sub_regions (
            tileset_file, from_tile_id, to_tile_id,
            category_id, layer_id, blocks, tags, label, hide,
            display_order, notes, updated_at
          ) VALUES (
            ${def.file}, ${sr.from}, ${sr.to},
            ${sr.category ?? null}, ${sr.defaultLayer ?? null}, ${sr.blocks ?? null},
            ${null}, ${sr.label ?? null}, ${sr.hide ?? null},
            ${idx}, ${null}, NOW()
          )
        `;
        subRegionCount++;
      }
    }

    // Replace animations.
    await sql`DELETE FROM tile_animations WHERE tileset_file = ${def.file}`;
    for (const a of parsed.animations) {
      for (let idx = 0; idx < a.frames.length; idx++) {
        const f = a.frames[idx];
        await sql`
          INSERT INTO tile_animations
            (tileset_file, head_tile_id, frame_idx, frame_tile_id, duration_ms)
          VALUES
            (${def.file}, ${a.headTileId}, ${idx}, ${f.tileId}, ${f.duration})
        `;
        animationRowCount++;
      }
    }
  }

  console.log(
    `  → ${upserted} upserted, ${missing} missing on disk, ${skipped} parse errors, ` +
    `${subRegionCount} sub-regions, ${animationRowCount} animation frames`,
  );
}

async function seedEmptyTiles() {
  const manifest = emptyTilesManifest as Record<string, number[]>;
  const files = Object.keys(manifest);
  const total = Object.values(manifest).reduce((n, a) => n + a.length, 0);
  console.log(`[seed] tile_empty_flags — ${total} rows across ${files.length} sheets`);

  for (const file of files) {
    const ids = manifest[file];
    await sql`DELETE FROM tile_empty_flags WHERE tileset_file = ${file}`;
    if (ids.length === 0) continue;
    // Bulk-insert via postgres.js multi-value syntax.
    const rows = ids.map((id) => ({ tileset_file: file, tile_id: id }));
    // postgres.js can take an array of objects with `sql(rows, ...cols)`.
    await sql`INSERT INTO tile_empty_flags ${sql(rows, "tileset_file", "tile_id")}`;
  }
}

async function main() {
  console.log("[seed] connecting to DB:", DATABASE_URL.replace(/:[^:@]+@/, ":***@"));
  const t0 = Date.now();

  try {
    // Order matters: categories + layers first (FK targets), then tilesets
    // (FK target for sub-regions / empty / animations), then tile-level data.
    await seedCategories();
    await seedLayers();
    await seedTilesets();
    await seedEmptyTiles();
  } finally {
    await sql.end();
  }

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n[seed] done in ${dt}s`);
}

main().catch((err) => {
  console.error("[seed] FAILED:", err);
  process.exit(1);
});
