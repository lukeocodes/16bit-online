/**
 * World Items — items that exist as pickupable objects in the game world.
 *
 * Two sources:
 *   "map"  — static items loaded from Tiled JSON on server boot; respawn on restart
 *   "drop" — dynamic items stored in the world_items DB table; persist until picked up
 */

import { db } from "../db/postgres.js";
import { worldItems as worldItemsTable } from "../db/schema.js";
import { eq, and, or, isNull, gt, sql } from "drizzle-orm";
import { getItem } from "./items.js";

export interface WorldItem {
  id: string;
  zoneId: string;
  tileX: number;
  tileZ: number;
  itemId: string;
  quantity: number;
  source: "map" | "drop";
  name: string;
  icon: string;
}

// In-memory store: id → WorldItem
const store = new Map<string, WorldItem>();

// ——— Tiled map item loading ———

export interface MapItemDef {
  tileX: number;
  tileZ: number;
  itemId: string;
  quantity: number;
}

/** Load static items from a Tiled map into memory. Call on server boot per zone. */
export function loadMapItems(zoneId: string, items: MapItemDef[]): void {
  // Clear existing map items for this zone (fresh load each boot)
  for (const [id, wi] of store) {
    if (wi.zoneId === zoneId && wi.source === "map") store.delete(id);
  }
  for (const def of items) {
    const template = getItem(def.itemId);
    if (!template) {
      console.warn(`[WorldItems] Unknown item "${def.itemId}" in map ${zoneId}`);
      continue;
    }
    const id = `map-${zoneId}-${def.tileX}-${def.tileZ}-${def.itemId}`;
    store.set(id, {
      id,
      zoneId,
      tileX: def.tileX,
      tileZ: def.tileZ,
      itemId: def.itemId,
      quantity: def.quantity,
      source: "map",
      name: template.name,
      icon: template.icon,
    });
  }
  if (items.length > 0) {
    console.log(`[WorldItems] Loaded ${items.length} static items for zone "${zoneId}"`);
  }
}

// ——— DB item loading ———

/** Load persisted drop items from DB into memory. Call on server boot per zone. */
export async function loadDbItems(zoneId: string): Promise<void> {
  const rows = await db
    .select()
    .from(worldItemsTable)
    .where(
      and(
        eq(worldItemsTable.zoneId, zoneId),
        or(isNull(worldItemsTable.expiresAt), gt(worldItemsTable.expiresAt, sql`NOW()`)),
      ),
    );

  for (const row of rows) {
    const template = getItem(row.itemId);
    if (!template) continue;
    store.set(row.id, {
      id: row.id,
      zoneId: row.zoneId,
      tileX: row.tileX,
      tileZ: row.tileZ,
      itemId: row.itemId,
      quantity: row.quantity,
      source: "drop",
      name: template.name,
      icon: template.icon,
    });
  }
  if (rows.length > 0) {
    console.log(`[WorldItems] Loaded ${rows.length} persisted drop items for zone "${zoneId}"`);
  }
}

// ——— Drop an item to the world ———

const DROP_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

/** Drop an item at a tile position. Writes to DB and adds to in-memory store. */
export async function dropItem(
  zoneId: string,
  tileX: number,
  tileZ: number,
  itemId: string,
  quantity: number,
): Promise<WorldItem | null> {
  const template = getItem(itemId);
  if (!template) return null;

  const expiresAt = new Date(Date.now() + DROP_EXPIRY_MS);
  const [row] = await db
    .insert(worldItemsTable)
    .values({ zoneId, tileX, tileZ, itemId, quantity, source: "drop", expiresAt })
    .returning({ id: worldItemsTable.id });

  const wi: WorldItem = {
    id: row.id,
    zoneId,
    tileX,
    tileZ,
    itemId,
    quantity,
    source: "drop",
    name: template.name,
    icon: template.icon,
  };
  store.set(wi.id, wi);
  return wi;
}

// ——— Pickup ———

/** Remove a world item. Returns the item if found, null otherwise. */
export async function pickupItem(itemId: string): Promise<WorldItem | null> {
  const wi = store.get(itemId);
  if (!wi) return null;

  store.delete(itemId);

  if (wi.source === "drop") {
    await db.delete(worldItemsTable).where(eq(worldItemsTable.id, itemId));
  }
  // Map items just vanish from memory; they come back on next server boot

  return wi;
}

// ——— Queries ———

export function getZoneItems(zoneId: string): WorldItem[] {
  const result: WorldItem[] = [];
  for (const wi of store.values()) {
    if (wi.zoneId === zoneId) result.push(wi);
  }
  return result;
}

export function getItem_WorldItem(id: string): WorldItem | undefined {
  return store.get(id);
}
