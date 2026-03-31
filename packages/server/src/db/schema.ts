import { pgTable, uuid, varchar, boolean, timestamp, integer, real, jsonb, primaryKey, customType, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  oauthSub: varchar("oauth_sub", { length: 255 }).notNull().unique(),
  oauthIssuer: varchar("oauth_issuer", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  isOnboarded: boolean("is_onboarded").default(false).notNull(),
  preferences: jsonb("preferences").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const characters = pgTable("characters", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  name: varchar("name", { length: 20 }).notNull().unique(),
  race: varchar("race", { length: 20 }).notNull(),
  gender: varchar("gender", { length: 10 }).notNull(),
  bodyType: varchar("body_type", { length: 20 }).notNull().default("default"),
  hairStyle: integer("hair_style").default(0).notNull(),
  hairColor: integer("hair_color").default(0).notNull(),
  skinTone: integer("skin_tone").default(0).notNull(),
  outfit: integer("outfit").default(0).notNull(),
  str: integer("str").notNull(),
  dex: integer("dex").notNull(),
  intStat: integer("int_stat").notNull(),
  skills: jsonb("skills").notNull().default([]),
  hp: integer("hp").default(50).notNull(),
  mana: integer("mana").default(50).notNull(),
  stamina: integer("stamina").default(50).notNull(),
  posX: real("pos_x").default(0).notNull(),
  posY: real("pos_y").default(0).notNull(),
  posZ: real("pos_z").default(0).notNull(),
  mapId: integer("map_id").default(1).notNull(),
  level: integer("level").default(1).notNull(),
  xp: integer("xp").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastPlayed: timestamp("last_played", { withTimezone: true }),
});

export const worldMaps = pgTable("world_maps", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  widthChunks: integer("width_chunks").notNull(),
  heightChunks: integer("height_chunks").notNull(),
  zLevels: integer("z_levels").default(1).notNull(),
});

export const chunkData = pgTable("chunk_data", {
  mapId: integer("map_id").notNull(),
  chunkX: integer("chunk_x").notNull(),
  chunkY: integer("chunk_y").notNull(),
  chunkZ: integer("chunk_z").notNull().default(0),
  tileData: jsonb("tile_data").notNull(), // tile IDs as array
  heightData: jsonb("height_data"),
  staticEntities: jsonb("static_entities"),
}, (table) => [
  primaryKey({ columns: [table.mapId, table.chunkX, table.chunkY, table.chunkZ] }),
]);

// World items — items sitting on the ground in a zone
export const worldItems = pgTable("world_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  zoneId: varchar("zone_id", { length: 50 }).notNull(),
  tileX: integer("tile_x").notNull(),
  tileZ: integer("tile_z").notNull(),
  itemId: varchar("item_id", { length: 50 }).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  source: varchar("source", { length: 10 }).notNull().default("drop"), // "map" | "drop"
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }), // null = permanent
});

// Saved model configs — composite character/NPC models saved from the workbench
export const savedModels = pgTable("saved_models", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  baseModelId: varchar("base_model_id", { length: 64 }).notNull(),
  compositeConfig: jsonb("composite_config").notNull(),
  tags: jsonb("tags").$type<string[]>().default([]),
  isNpc: boolean("is_npc").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Character inventory — items owned by a character
export const characterInventory = pgTable("character_inventory", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id").notNull().references(() => characters.id),
  itemId: varchar("item_id", { length: 50 }).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  equipped: boolean("equipped").default(false).notNull(),
  slot: varchar("slot", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
