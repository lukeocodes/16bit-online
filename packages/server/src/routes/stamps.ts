/**
 * Stamps — reusable multi-tile compositions.
 *
 *   GET    /api/stamps                     — list all stamps (+ their tiles)
 *   POST   /api/stamps                     — upload a TMX body, parse, insert
 *   DELETE /api/stamps/:slug               — delete a stamp
 *   POST   /api/stamps/:slug/place         — materialise stamp onto user_map
 *
 * Creation flow: the client sends the raw TMX as `text/xml` with `X-Stamp-Slug`
 * + `X-Stamp-Name` headers (so the body stays pure XML). The server parses
 * with `tmx-parse.ts`, resolves tileset references to canonical
 * `tilesets.file` via filename-stem matching, and writes the `stamps` +
 * `stamp_tiles` rows atomically.
 *
 * Placement flow: client POSTs `{ mapId, originX, originY }`. Server reads
 * all `stamp_tiles`, offsets each by (originX, originY), and upserts into
 * `user_map_tiles` so existing (layer, x, y) cells get overwritten. The
 * response contains the list of materialised tiles for the client to
 * integrate into its local state (the broadcast happens over WebRTC
 * separately; this endpoint is the source of truth).
 */
import type { FastifyInstance } from "fastify";
import { db } from "../db/postgres.js";
import { stamps, stampTiles, tilesets, userMaps, userMapTiles } from "../db/schema.js";
import { eq, sql as dsql } from "drizzle-orm";
import { parseTmx, type TilesetResolver } from "../game/tmx-parse.js";

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Decode the handful of XML entities we care about. TMX source paths
 *  commonly contain `&amp;` (e.g. `collision &amp; alpha.tsx`) which must
 *  turn back into `&` before slugifying. */
function xmlUnescape(s: string): string {
  return s
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;",  "<")
    .replaceAll("&gt;",  ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'");
}

/** Strip Mana Seed version + size suffixes from a slug. Handles:
 *    -NxM, -NxMxK                       (e.g. "-16x16", "-32x96")
 *    -<letter>-NxM                      (e.g. "-b-16x16" from "summer waterfall B 16x16.png")
 *    -v01 / -v1                         (palette version markers)
 *  Our ingest builds the canonical slug from the PNG filename which often
 *  carries these decorations; the TMX reference to the same TSX usually
 *  doesn't. Match against both full + bare forms to paper over the gap. */
function stripSizeSuffix(slug: string): string {
  return slug
    .replace(/(-\d+x\d+)+$/i, "")        // trailing -NxM
    .replace(/-[a-z]$/i, "")             // trailing -<single letter> (version marker like "-b")
    .replace(/(-\d+x\d+)+$/i, "")        // second pass after letter strip
    .replace(/-v\d+$/i, "");             // palette version "-v01"
}

/** Build a TilesetResolver from the tilesets table. Two-phase match:
 *  1. Exact slug on the canonical file stem.
 *  2. Secondary: slug with size-suffix stripped from BOTH sides.
 *  Also unescapes XML entities in the basename (`&amp;` → `&`) before
 *  slugifying. */
async function buildTilesetResolver(): Promise<TilesetResolver> {
  const rows = await db.select({ file: tilesets.file }).from(tilesets);
  const exact   = new Map<string, string>();
  const stripped = new Map<string, string>();
  for (const { file } of rows) {
    const stem = (file.split("/").pop() ?? file).replace(/\.tsx$/i, "");
    const slug = slugify(stem);
    exact.set(slug, file);
    const bare = stripSizeSuffix(slug);
    if (bare !== slug && !stripped.has(bare)) stripped.set(bare, file);
  }
  return (basename: string) => {
    const slug = slugify(xmlUnescape(basename));
    return exact.get(slug)
      ?? exact.get(stripSizeSuffix(slug))
      ?? stripped.get(slug)
      ?? stripped.get(stripSizeSuffix(slug))
      ?? null;
  };
}

export async function stampsRoutes(app: FastifyInstance) {
  // -------------------------------------------------------------------------
  // GET /api/stamps — list + tiles (for preview rendering)
  // -------------------------------------------------------------------------
  app.get("/", async () => {
    const stampRows = await db.select().from(stamps).orderBy(stamps.name);
    const tileRows  = await db.select().from(stampTiles);
    const tilesByStamp = new Map<string, typeof tileRows>();
    for (const t of tileRows) {
      const arr = tilesByStamp.get(t.stampId) ?? [];
      arr.push(t);
      tilesByStamp.set(t.stampId, arr);
    }
    return {
      stamps: stampRows.map(s => ({
        id:             s.id,
        slug:           s.slug,
        name:           s.name,
        description:    s.description,
        width:          s.width,
        height:         s.height,
        previewTileset: s.previewTileset,
        previewTileId:  s.previewTileId,
        tags:           s.tags,
        category:       s.category,
        createdAt:      s.createdAt,
        tiles: (tilesByStamp.get(s.id) ?? []).map(t => ({
          layer:    t.layer,
          x:        t.x,
          y:        t.y,
          tileset:  t.tileset,
          tileId:   t.tileId,
          rotation: t.rotation,
          flipH:    t.flipH,
          flipV:    t.flipV,
        })),
      })),
    };
  });

  // -------------------------------------------------------------------------
  // POST /api/stamps — upload TMX + create stamp
  //
  //   headers:
  //     content-type: application/xml | text/xml
  //     x-stamp-name: "Thatch Cottage"
  //     x-stamp-slug: "thatch-cottage"          (optional, derived from name)
  //     x-stamp-description: "..."             (optional)
  //     x-stamp-category: "buildings"           (optional; defaults to null)
  //   body: raw TMX XML
  // -------------------------------------------------------------------------
  app.post<{ Body: string }>(
    "/",
    {
      bodyLimit: 4 * 1024 * 1024,   // 4MB — TMX with large maps is still small
    },
    async (req, reply) => {
      const xml = typeof req.body === "string" ? req.body : String(req.body ?? "");
      if (!xml.trim().startsWith("<?xml") && !xml.trim().startsWith("<map")) {
        return reply.status(400).send({ detail: "Body must be a TMX XML document" });
      }
      const name = String(req.headers["x-stamp-name"] ?? "").trim();
      if (!name) return reply.status(400).send({ detail: "Missing X-Stamp-Name header" });

      const explicitSlug = String(req.headers["x-stamp-slug"] ?? "").trim();
      const slug = (explicitSlug ? slugify(explicitSlug) : slugify(name)).slice(0, 64);
      if (!slug) return reply.status(400).send({ detail: "Slug derived from name is empty" });

      const description = String(req.headers["x-stamp-description"] ?? "").trim() || null;
      const categoryRaw = String(req.headers["x-stamp-category"] ?? "").trim();
      const category = categoryRaw || null;

      // Parse TMX.
      const resolve = await buildTilesetResolver();
      let parsed;
      try {
        parsed = parseTmx(xml, resolve);
      } catch (err) {
        return reply.status(400).send({ detail: `TMX parse failed: ${(err as Error).message}` });
      }
      if (parsed.tiles.length === 0) {
        return reply.status(400).send({
          detail: "TMX parsed but contains no resolvable tiles",
          unresolvedTilesets: parsed.unresolvedTilesets,
          warnings: parsed.warnings,
        });
      }

      // Compute a cheap preview: first non-transparent ground tile, else
      // first tile of any kind.
      const previewCandidate =
        parsed.tiles.find(t => t.layer === "ground") ?? parsed.tiles[0];

      // Insert stamp + tiles atomically. Fails on slug collision.
      const existing = await db.select().from(stamps).where(eq(stamps.slug, slug));
      if (existing.length > 0) {
        return reply.status(409).send({ detail: `Stamp '${slug}' already exists` });
      }

      const [row] = await db.insert(stamps).values({
        slug,
        name,
        description,
        width:          parsed.width,
        height:         parsed.height,
        previewTileset: previewCandidate.tileset,
        previewTileId:  previewCandidate.tileId,
        tags:           [],
        category,
      }).returning();

      await db.insert(stampTiles).values(
        parsed.tiles.map(t => ({
          stampId:  row.id,
          layer:    t.layer,
          x:        t.x,
          y:        t.y,
          tileset:  t.tileset,
          tileId:   t.tileId,
          rotation: t.rotation,
          flipH:    t.flipH,
          flipV:    t.flipV,
        })),
      );

      return reply.status(201).send({
        stamp: {
          id:             row.id,
          slug:           row.slug,
          name:           row.name,
          width:          row.width,
          height:         row.height,
          previewTileset: row.previewTileset,
          previewTileId:  row.previewTileId,
          category:       row.category,
          tileCount:      parsed.tiles.length,
        },
        warnings: parsed.warnings,
        unresolvedTilesets: parsed.unresolvedTilesets,
      });
    },
  );

  // -------------------------------------------------------------------------
  // DELETE /api/stamps/:slug
  // -------------------------------------------------------------------------
  app.delete<{ Params: { slug: string } }>(
    "/:slug",
    async (req, reply) => {
      const res = await db.delete(stamps).where(eq(stamps.slug, req.params.slug)).returning();
      if (res.length === 0) return reply.status(404).send({ detail: `Stamp '${req.params.slug}' not found` });
      return { ok: true };
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/stamps/:slug/place
  //   body: { mapId: uuid, originX: int, originY: int }
  //
  // Materialises the stamp at (originX, originY) on the given map. Each
  // cell is upserted into `user_map_tiles` — existing tiles at the same
  // (layer, x, y) get overwritten. Response has the final materialised
  // tile rows for the client's local state. Out-of-bounds cells are
  // silently dropped.
  // -------------------------------------------------------------------------
  app.post<{
    Params: { slug: string };
    Body:   { mapId: string; originX: number; originY: number };
  }>(
    "/:slug/place",
    async (req, reply) => {
      const { slug } = req.params;
      const { mapId, originX, originY } = req.body ?? {};
      if (typeof mapId !== "string" || typeof originX !== "number" || typeof originY !== "number") {
        return reply.status(400).send({ detail: "Body needs { mapId, originX, originY }" });
      }

      const [stamp] = await db.select().from(stamps).where(eq(stamps.slug, slug));
      if (!stamp) return reply.status(404).send({ detail: `Stamp '${slug}' not found` });

      const [map] = await db.select().from(userMaps).where(eq(userMaps.id, mapId));
      if (!map) return reply.status(404).send({ detail: `Map '${mapId}' not found` });

      const tilesIn = await db.select().from(stampTiles).where(eq(stampTiles.stampId, stamp.id));
      const tilesOut = tilesIn
        .map(t => ({
          layer:    t.layer,
          x:        t.x + originX,
          y:        t.y + originY,
          tileset:  t.tileset,
          tileId:   t.tileId,
          rotation: t.rotation,
          flipH:    t.flipH,
          flipV:    t.flipV,
        }))
        .filter(t => t.x >= 0 && t.y >= 0 && t.x < map.width && t.y < map.height);

      if (tilesOut.length === 0) {
        return reply.status(400).send({ detail: "Stamp origin places entirely off-map" });
      }

      // Upsert each tile via onConflict. Drizzle's postgres driver supports
      // `onConflictDoUpdate` but the composite unique is (map_id, layer, x, y),
      // which doesn't map cleanly without a target. Use raw SQL in a loop —
      // still atomic-enough for stamp placement (typically <500 tiles).
      await db.transaction(async (tx) => {
        for (const t of tilesOut) {
          await tx.execute(dsql`
            INSERT INTO user_map_tiles (map_id, layer, x, y, tileset, tile_id, rotation, flip_h, flip_v)
            VALUES (${mapId}, ${t.layer}, ${t.x}, ${t.y}, ${t.tileset}, ${t.tileId}, ${t.rotation}, ${t.flipH}, ${t.flipV})
            ON CONFLICT (map_id, layer, x, y) DO UPDATE SET
              tileset   = EXCLUDED.tileset,
              tile_id   = EXCLUDED.tile_id,
              rotation  = EXCLUDED.rotation,
              flip_h    = EXCLUDED.flip_h,
              flip_v    = EXCLUDED.flip_v,
              placed_by = NULL
          `);
        }
      });

      return { placed: tilesOut.length, tiles: tilesOut };
    },
  );
}
