/**
 * User-built maps (world builder).
 *
 * In-memory cache of user-authored maps + their tile placements. Backed by the
 * `user_maps` + `user_map_tiles` Postgres tables.
 *
 * Each user map registers as a zone via the zone registry so normal movement,
 * entity tracking, and zone-change opcodes all work transparently.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "../db/postgres.js";
import { userMaps, userMapTiles, userMapBlocks } from "../db/schema.js";
import { registerZone, type ZoneDefinition } from "./zone-registry.js";

/** Zone numericId for the builder's starting hub ("heaven"). */
export const HEAVEN_NUMERIC_ID = 500;
export const HEAVEN_ZONE_ID = "heaven";

/** Lowest numericId allocated to user-authored maps. */
const USER_MAP_NUMERIC_BASE = 1000;

export interface UserTile {
  layer:    string;   // "ground" | "walls" | "decor" | "canopy"
  x:        number;
  y:        number;
  tileset:  string;   // TSX filename, e.g. "summer forest.tsx"
  tileId:   number;
  rotation: number;   // 0 | 90 | 180 | 270
  flipH:    boolean;
  flipV:    boolean;
}

/** A collision "block" — a 1-cell no-walk marker. Invisible in play mode,
 *  rendered as a blue outline in builder mode. Decoupled from tile
 *  placements so the author can describe per-cell collision independently
 *  of tile sprite footprints. */
export interface UserBlock {
  x: number;
  y: number;
}

export interface UserMap {
  id:          string;        // uuid
  numericId:   number;
  zoneId:      string;        // "user:<uuid>" or "heaven"
  name:        string;
  width:       number;
  height:      number;
  /** keyed by `${layer}:${x},${y}` */
  tiles:       Map<string, UserTile>;
  /** keyed by `${x},${y}` */
  blocks:      Map<string, UserBlock>;
  createdBy:   string | null;
}

// -----------------------------------------------------------------------------
// In-memory cache
// -----------------------------------------------------------------------------

const byId        = new Map<string, UserMap>();
const byZoneId    = new Map<string, UserMap>();
const byNumericId = new Map<number, UserMap>();

function tileKey(t: { layer: string; x: number; y: number }): string {
  return `${t.layer}:${t.x},${t.y}`;
}

function blockKey(b: { x: number; y: number }): string {
  return `${b.x},${b.y}`;
}

/** Register the map as a zone so the rest of the engine treats it normally. */
function registerAsZone(m: UserMap): void {
  const def: ZoneDefinition = {
    id:         m.zoneId,
    numericId:  m.numericId,
    name:       m.name,
    // Heaven has a static JSON (hand-authored grass canvas). Other user maps
    // have no backing file — their overlay is streamed tile-by-tile via
    // BUILDER_MAP_SNAPSHOT and they reuse heaven.tmx as the visual backdrop.
    mapFile:    m.zoneId === HEAVEN_ZONE_ID
                  ? "heaven.json"
                  : `user-maps/${m.id}.json`,
    levelRange: [1, 99],
    musicTag:   "peaceful",
    exits:      {},
  };
  registerZone(def);
}

/** Ensure the "heaven" user map row exists in the database. Heaven is
 *  special in that its numericId is the fixed HEAVEN_NUMERIC_ID and its
 *  zoneId is HEAVEN_ZONE_ID — this makes the row findable across server
 *  restarts and lets tile placements persist like any other user map. */
async function ensureHeavenRow(): Promise<void> {
  const existing = await db
    .select()
    .from(userMaps)
    .where(eq(userMaps.zoneId, HEAVEN_ZONE_ID));
  if (existing.length > 0) return;
  await db.insert(userMaps).values({
    numericId: HEAVEN_NUMERIC_ID,
    zoneId:    HEAVEN_ZONE_ID,
    name:      "Heaven",
    width:     32,
    height:    32,
    createdBy: null,
  });
  console.log(`[UserMaps] Seeded heaven row (numericId=${HEAVEN_NUMERIC_ID})`);
}

/** Allocate the next numericId above all currently-registered user maps. */
async function nextNumericId(): Promise<number> {
  const row = await db
    .select({ maxId: sql<number>`coalesce(max(${userMaps.numericId}), ${USER_MAP_NUMERIC_BASE - 1})` })
    .from(userMaps);
  return Math.max(USER_MAP_NUMERIC_BASE, (row[0]?.maxId ?? 0) + 1);
}

// -----------------------------------------------------------------------------
// Loading / bootstrapping
// -----------------------------------------------------------------------------

/**
 * Load every user map from the database into memory and register each as a
 * zone. Seeds the heaven row first so it's always present.
 * Call once at server boot.
 */
export async function loadAllUserMaps(): Promise<void> {
  await ensureHeavenRow();
  const rows = await db.select().from(userMaps);
  for (const row of rows) {
    const tileRows = await db
      .select()
      .from(userMapTiles)
      .where(eq(userMapTiles.mapId, row.id));
    const blockRows = await db
      .select()
      .from(userMapBlocks)
      .where(eq(userMapBlocks.mapId, row.id));

    const tiles = new Map<string, UserTile>();
    for (const t of tileRows) {
      tiles.set(tileKey(t), {
        layer:    t.layer,
        x:        t.x,
        y:        t.y,
        tileset:  t.tileset,
        tileId:   t.tileId,
        rotation: t.rotation,
        flipH:    t.flipH,
        flipV:    t.flipV,
      });
    }
    const blocks = new Map<string, UserBlock>();
    for (const b of blockRows) {
      blocks.set(blockKey(b), { x: b.x, y: b.y });
    }

    const m: UserMap = {
      id:        row.id,
      numericId: row.numericId,
      zoneId:    row.zoneId,
      name:      row.name,
      width:     row.width,
      height:    row.height,
      tiles,
      blocks,
      createdBy: row.createdBy,
    };
    byId.set(m.id, m);
    byZoneId.set(m.zoneId, m);
    byNumericId.set(m.numericId, m);
    registerAsZone(m);
  }
  console.log(`[UserMaps] Loaded ${rows.length} user map(s) (incl. heaven)`);
}

// -----------------------------------------------------------------------------
// Queries
// -----------------------------------------------------------------------------

export function getUserMapByNumericId(numericId: number): UserMap | undefined {
  return byNumericId.get(numericId);
}

export function getUserMapByZoneId(zoneId: string): UserMap | undefined {
  return byZoneId.get(zoneId);
}

export function listUserMaps(): UserMap[] {
  return Array.from(byId.values()).sort((a, b) => a.numericId - b.numericId);
}

export function getTilesFor(map: UserMap): UserTile[] {
  return Array.from(map.tiles.values());
}

export function getBlocksFor(map: UserMap): UserBlock[] {
  return Array.from(map.blocks.values());
}

/** True if a zone numericId belongs to a user-editable map (heaven + user maps).
 *  Heaven is registered at boot via ensureHeavenRow so it's just another row. */
export function isBuilderZone(numericId: number): boolean {
  return byNumericId.has(numericId);
}

// -----------------------------------------------------------------------------
// Mutations
// -----------------------------------------------------------------------------

export interface CreateMapArgs {
  name:      string;
  width:     number;
  height:    number;
  createdBy: string | null;
}

export async function createUserMap(args: CreateMapArgs): Promise<UserMap> {
  const numericId = await nextNumericId();
  const zoneId    = `user:${cryptoId()}`;

  const [row] = await db
    .insert(userMaps)
    .values({
      numericId,
      zoneId,
      name:      args.name.slice(0, 100),
      width:     Math.max(1, Math.min(256, Math.floor(args.width))),
      height:    Math.max(1, Math.min(256, Math.floor(args.height))),
      createdBy: args.createdBy,
    })
    .returning();

  const m: UserMap = {
    id:        row.id,
    numericId: row.numericId,
    zoneId:    row.zoneId,
    name:      row.name,
    width:     row.width,
    height:    row.height,
    tiles:     new Map(),
    blocks:    new Map(),
    createdBy: row.createdBy,
  };
  byId.set(m.id, m);
  byZoneId.set(m.zoneId, m);
  byNumericId.set(m.numericId, m);
  registerAsZone(m);
  console.log(`[UserMaps] Created ${m.name} (${m.width}x${m.height}) zoneId=${m.zoneId} numericId=${m.numericId}`);
  return m;
}

/** Upsert a tile placement. Returns the new tile record. */
export async function placeTile(
  map: UserMap,
  t: UserTile,
  placedBy: string | null,
): Promise<UserTile> {
  // Clamp + sanitise.
  const clean: UserTile = {
    layer:    String(t.layer || "ground").slice(0, 32),
    x:        Math.floor(t.x),
    y:        Math.floor(t.y),
    tileset:  String(t.tileset || "").slice(0, 128),
    tileId:   Math.max(0, Math.floor(t.tileId)),
    rotation: ((Math.floor(t.rotation || 0) % 360) + 360) % 360,
    flipH:    !!t.flipH,
    flipV:    !!t.flipV,
  };
  if (!clean.tileset) throw new Error("tileset required");
  if (clean.x < 0 || clean.x >= map.width) throw new Error("x out of bounds");
  if (clean.y < 0 || clean.y >= map.height) throw new Error("y out of bounds");

  await db
    .insert(userMapTiles)
    .values({ mapId: map.id, ...clean, placedBy })
    .onConflictDoUpdate({
      target: [userMapTiles.mapId, userMapTiles.layer, userMapTiles.x, userMapTiles.y],
      set: {
        tileset:  clean.tileset,
        tileId:   clean.tileId,
        rotation: clean.rotation,
        flipH:    clean.flipH,
        flipV:    clean.flipV,
        placedBy,
      },
    });

  map.tiles.set(tileKey(clean), clean);
  return clean;
}

export async function removeTile(
  map: UserMap,
  layer: string,
  x: number,
  y: number,
): Promise<boolean> {
  const key = tileKey({ layer, x, y });
  if (!map.tiles.has(key)) return false;
  await db
    .delete(userMapTiles)
    .where(
      sql`${userMapTiles.mapId} = ${map.id}
      AND ${userMapTiles.layer} = ${layer}
      AND ${userMapTiles.x} = ${x}
      AND ${userMapTiles.y} = ${y}`,
    );
  map.tiles.delete(key);
  return true;
}

// ---------------------------------------------------------------------------
// Block mutations
// ---------------------------------------------------------------------------

/** Add a collision block at (x, y). No-op if one is already there. */
export async function placeBlock(
  map: UserMap,
  x: number, y: number,
  placedBy: string | null,
): Promise<UserBlock> {
  const xi = Math.floor(x), yi = Math.floor(y);
  if (xi < 0 || xi >= map.width)  throw new Error("x out of bounds");
  if (yi < 0 || yi >= map.height) throw new Error("y out of bounds");

  const key = blockKey({ x: xi, y: yi });
  if (map.blocks.has(key)) return map.blocks.get(key)!;

  await db
    .insert(userMapBlocks)
    .values({ mapId: map.id, x: xi, y: yi, placedBy })
    .onConflictDoNothing({ target: [userMapBlocks.mapId, userMapBlocks.x, userMapBlocks.y] });

  const b: UserBlock = { x: xi, y: yi };
  map.blocks.set(key, b);
  return b;
}

export async function removeBlock(
  map: UserMap,
  x: number, y: number,
): Promise<boolean> {
  const xi = Math.floor(x), yi = Math.floor(y);
  const key = blockKey({ x: xi, y: yi });
  if (!map.blocks.has(key)) return false;
  await db
    .delete(userMapBlocks)
    .where(
      sql`${userMapBlocks.mapId} = ${map.id}
      AND ${userMapBlocks.x} = ${xi}
      AND ${userMapBlocks.y} = ${yi}`,
    );
  map.blocks.delete(key);
  return true;
}

/** Look up a mutable user map by numericId. Heaven is just a regular user
 *  map with the reserved HEAVEN_NUMERIC_ID, so a single lookup covers it. */
export function getBuilderMapByNumericId(numericId: number): UserMap | undefined {
  return byNumericId.get(numericId);
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function cryptoId(): string {
  // Short 8-char id (collision-resistant enough for handle; the DB has a real uuid too)
  const bytes = new Uint8Array(6);
  (globalThis.crypto ?? require("node:crypto").webcrypto).getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
