// Mana Seed Sprite Catalog
// ========================
// Single source of truth for every sprite sheet in the game.
// All paths are relative to /public/assets/.
//
// Frame grid rules (from Mana Seed docs):
//   NPC pack characters  : 128×256, 32×32 frames, 4 cols × 8 rows
//   Farmer base (paperdoll): 1024×1024, 64×64 frames, 16 cols × 16 rows
//   Summer forest tileset: 512×336, 16×16 frames, 32 cols × 21 rows
//   Summer trees 80×112  : 240×112, 80×112 frames, 3 cols × 1 row
//
// NPC standard row layout (4 cols × 8 rows, 32×32):
//   row 0 = walk down   (4 frames, col 0 = idle facing down)
//   row 1 = walk left   (4 frames, col 0 = idle facing left)
//   row 2 = walk right  (4 frames, col 0 = idle facing right)
//   row 3 = walk up     (4 frames, col 0 = idle facing up)
//   rows 4-7 = NPC-specific extra animations (sit, wave, etc.)
//
// Livestock row layout varies per animal — see individual notes.

export type SpriteCategory =
  | "tileset"
  | "character-base"
  | "npc"
  | "livestock"
  | "decoration"
  | "effect"
  | "reference"
  | "palette";

export interface SpriteSheet {
  /** Path relative to /public/assets/ */
  path: string;
  category: SpriteCategory;
  /** Total sheet pixel width */
  width: number;
  /** Total sheet pixel height */
  height: number;
  /** Width of one animation frame in pixels */
  frameW: number;
  /** Height of one animation frame in pixels */
  frameH: number;
  /** Number of columns in the frame grid */
  cols: number;
  /** Number of rows in the frame grid */
  rows: number;
  /** Human-readable description, palette variant, animation notes */
  notes: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TILESETS
// ─────────────────────────────────────────────────────────────────────────────

export const TILESETS = {
  SUMMER_FOREST: {
    path: "tilesets/summer forest.png",
    category: "tileset",
    width: 512, height: 336,
    frameW: 16, frameH: 16,
    cols: 32, rows: 21,
    notes: "Primary summer forest ground/terrain tileset. 16×16 tiles. Col 4 row 0 = solid grass.",
  },
  SUMMER_16x32: {
    path: "tilesets/summer 16x32.png",
    category: "tileset",
    width: 96, height: 32,
    frameW: 16, frameH: 32,
    cols: 6, rows: 1,
    notes: "Tall thin objects: grass tufts, reeds. 16×32 frames.",
  },
  SUMMER_32x32: {
    path: "tilesets/summer 32x32.png",
    category: "tileset",
    width: 224, height: 32,
    frameW: 32, frameH: 32,
    cols: 7, rows: 1,
    notes: "Decorations: bushes, rocks, logs. 32×32 frames.",
  },
  SUMMER_48x32: {
    path: "tilesets/summer 48x32.png",
    category: "tileset",
    width: 144, height: 32,
    frameW: 48, frameH: 32,
    cols: 3, rows: 1,
    notes: "Wide objects. 48×32 frames.",
  },
  SUMMER_WANG: {
    path: "tilesets/summer forest wang tiles.png",
    category: "tileset",
    width: 1024, height: 512,
    frameW: 16, frameH: 16,
    cols: 64, rows: 32,
    notes: "Wang autotile set for ground/water/terrain transitions.",
  },
  SUMMER_TREES: {
    path: "tilesets/summer trees 80x112.png",
    category: "tileset",
    width: 240, height: 112,
    frameW: 80, frameH: 112,
    cols: 3, rows: 1,
    notes: "Large tree sprites: birch, chestnut, maple. Each 80×112px = 5×7 tiles.",
  },
  SUMMER_TREE_WALL: {
    path: "tilesets/summer forest tree wall 128x128.png",
    category: "tileset",
    width: 768, height: 512,
    frameW: 128, frameH: 128,
    cols: 6, rows: 4,
    notes: "Tree wall autotile with trunk and canopy. 128×128 per tile.",
  },
  SUMMER_TREE_WALL_CANOPY: {
    path: "tilesets/summer forest tree wall canopy 128x128.png",
    category: "tileset",
    width: 768, height: 512,
    frameW: 128, frameH: 128,
    cols: 6, rows: 4,
    notes: "Canopy-only layer of the tree wall. Render above characters.",
  },
  BRIDGE: {
    path: "tilesets/bonus bridge.png",
    category: "tileset",
    width: 64, height: 48,
    frameW: 16, frameH: 16,
    cols: 4, rows: 3,
    notes: "Wooden bridge tiles. 16×16 cells.",
  },
  SHADOWS: {
    path: "tilesets/bonus shadows.png",
    category: "tileset",
    width: 128, height: 128,
    frameW: 16, frameH: 16,
    cols: 8, rows: 8,
    notes: "Drop shadow sprites for trees/objects.",
  },
} as const satisfies Record<string, SpriteSheet>;

// ─────────────────────────────────────────────────────────────────────────────
// EFFECTS
// ─────────────────────────────────────────────────────────────────────────────

export const EFFECTS = {
  TALL_GRASS: {
    path: "effects/summer tall grass 32x32.png",
    category: "effect",
    width: 160, height: 32,
    frameW: 32, frameH: 32,
    cols: 5, rows: 1,
    notes: "Tall grass rustle animation. 5 frames, play on player walk-through.",
  },
  WATER_SPARKLE: {
    path: "effects/summer water sparkles 16x16.png",
    category: "effect",
    width: 64, height: 48,
    frameW: 16, frameH: 16,
    cols: 4, rows: 3,
    notes: "Water sparkle animation. 4 cols × 3 rows, multiple variants.",
  },
  WATERFALL: {
    path: "effects/summer waterfall 16x16.png",
    category: "effect",
    width: 128, height: 160,
    frameW: 16, frameH: 16,
    cols: 8, rows: 10,
    notes: "Waterfall cascade animation. Looping.",
  },
} as const satisfies Record<string, SpriteSheet>;

// ─────────────────────────────────────────────────────────────────────────────
// FARMER BASE (paper-doll system — 1024×1024, 64×64 cells, 16×16 grid)
// Layer order (bottom to top): 00undr → 01body → 02sock → 03fot1 → 04lwr1
//   → 05shrt → 06lwr2 → 07fot2 → 08lwr3 → 09hand → 10outr → 11neck
//   → 12face → 13hair → 14head → 15over
// Character figure is ~32px tall within each 64px cell. No scaling needed
// if rendered at native 64px (2× tile height at 32px tiles, 4× at 16px tiles).
// ─────────────────────────────────────────────────────────────────────────────

const FARMER_BASE_DEFAULTS = {
  category: "character-base" as const,
  width: 1024, height: 1024,
  frameW: 64, frameH: 64,
  cols: 16, rows: 16,
};

export const FARMER_BASE = {
  BLANK:        { ...FARMER_BASE_DEFAULTS, path: "characters/farmer/fbas_blank_sheet.png",              notes: "Empty paperdoll template. Use as layer base." },
  BODY:         { ...FARMER_BASE_DEFAULTS, path: "characters/farmer/01body/fbas_1body_human_00.png",    notes: "Layer 01 — base human body, universal skin." },
  SHOES:        { ...FARMER_BASE_DEFAULTS, path: "characters/farmer/03fot1/fbas_03fot1_shoes_00a.png",  notes: "Layer 03 — footwear under pants." },
  LONG_PANTS:   { ...FARMER_BASE_DEFAULTS, path: "characters/farmer/04lwr1/fbas_04lwr1_longpants_00a.png", notes: "Layer 04 — long pants." },
  SHORT_SHIRT:  { ...FARMER_BASE_DEFAULTS, path: "characters/farmer/05shrt/fbas_05shrt_shortshirt_00a.png", notes: "Layer 05 — short shirt." },
  SHORT_SHIRT_B:{ ...FARMER_BASE_DEFAULTS, path: "characters/farmer/05shrt/fbas_05shrt_shortshirtboobs_00a.png", notes: "Layer 05 — short shirt, chest-shape variant." },
  HAIR_BOB:     { ...FARMER_BASE_DEFAULTS, path: "characters/farmer/13hair/fbas_13hair_bob1_00a.png",   notes: "Layer 13 — bob hairstyle." },
  HAIR_DAPPER:  { ...FARMER_BASE_DEFAULTS, path: "characters/farmer/13hair/fbas_13hair_dapper_00a.png", notes: "Layer 13 — dapper hairstyle." },
  COWBOY_HAT:   { ...FARMER_BASE_DEFAULTS, path: "characters/farmer/14head/fbas_14head_cowboyhat_00d.png", notes: "Layer 14 — cowboy hat." },
} as const satisfies Record<string, SpriteSheet>;

// ─────────────────────────────────────────────────────────────────────────────
// NPC PACK (128×256, 32×32 frames, 4 cols × 8 rows)
// Standard row layout:
//   row 0 = walk down  | row 1 = walk left
//   row 2 = walk right | row 3 = walk up
//   rows 4-7 = NPC-specific extras (sit, wave, interact, etc.)
// Palettes: v00 (universal base), v01-v04 (colour variants)
// ─────────────────────────────────────────────────────────────────────────────

const NPC_DEFAULTS = {
  category: "npc" as const,
  width: 128, height: 256,
  frameW: 32, frameH: 32,
  cols: 4, rows: 8,
};

// Helper: generate v00–vNN entries for a named NPC
const npcVariants = (name: string, label: string, maxV: number, extraNotes = "") =>
  Object.fromEntries(
    Array.from({ length: maxV + 1 }, (_, i) => [
      `v${String(i).padStart(2, "0")}`,
      { ...NPC_DEFAULTS, path: `characters/npc/${name} v${String(i).padStart(2, "0")}.png`, notes: `${label}, palette v${String(i).padStart(2, "0")}.${extraNotes ? " " + extraNotes : ""}` },
    ])
  ) as Record<string, SpriteSheet>;

export const NPCS = {
  BABY_A:      npcVariants("npc baby A",      "Baby A",      4),
  BABY_B:      npcVariants("npc baby B",      "Baby B",      4),
  BARD_A:      npcVariants("npc bard A",      "Bard A",      4, "Holds instrument prop."),
  BARD_B:      npcVariants("npc bard B",      "Bard B",      4),
  DANCER_A:    npcVariants("npc dancer A",    "Dancer A",    4, "Includes dance rows 4-7."),
  DANCER_B:    npcVariants("npc dancer B",    "Dancer B",    4),
  KING_A:      npcVariants("npc king A",      "King A",      4, "Crown and robe."),
  MERCHANT_A:  npcVariants("npc merchant A",  "Merchant A",  3),
  MERCHANT_B:  npcVariants("npc merchant B",  "Merchant B",  3),
  MERCHANT_C:  npcVariants("npc merchant C",  "Merchant C",  3),
  MERCHANT_D:  npcVariants("npc merchant D",  "Merchant D",  3),
  MYSTIC_A:    npcVariants("npc mystic A",    "Mystic A",    3, "Fortune-teller archetype."),
  OLD_MAN_A:   npcVariants("npc old man A",   "Old Man A",   4),
  OLD_MAN_B:   npcVariants("npc old man B",   "Old Man B",   4),
  OLD_WOMAN_A: npcVariants("npc old woman A", "Old Woman A", 4),
  OLD_WOMAN_B: npcVariants("npc old woman B", "Old Woman B", 4),
  OLD_WOMAN_C: npcVariants("npc old woman C", "Old Woman C", 4),
  QUEEN_A:     npcVariants("npc queen A",     "Queen A",     4, "Crown, royal dress."),
  WOMAN_A:     npcVariants("npc woman A",     "Woman A",     4),
  WOMAN_B:     npcVariants("npc woman B",     "Woman B",     4),
} as const;

// Bonus NPC pack props
export const NPC_PROPS = {
  MERCHANT_GOODS: {
    path: "characters/npc/bonus merchant goods.png",
    category: "decoration" as const,
    width: 160, height: 80,
    frameW: 16, frameH: 16,
    cols: 10, rows: 5,
    notes: "Merchant wares prop sprites. 16×16 each.",
  },
  ROYAL_THRONE: {
    path: "characters/npc/bonus royal throne.png",
    category: "decoration" as const,
    width: 48, height: 64,
    frameW: 48, frameH: 64,
    cols: 1, rows: 1,
    notes: "Royal throne — single static sprite.",
  },
} as const satisfies Record<string, SpriteSheet>;

// ─────────────────────────────────────────────────────────────────────────────
// LIVESTOCK
// All livestock sheets use AAA/AAB/ABA etc. variant codes:
//   A = body colour A, B = body colour B, C = spot colour
// Frame layout varies per animal — see notes.
// ─────────────────────────────────────────────────────────────────────────────

export const LIVESTOCK = {
  // Chicken: 192×48, 48×48 frames, 4 cols × 1 row
  // Rows: idle, peck, walk, flap (one row each across multiple sheets)
  CHICKEN_AAA_v00: { path: "livestock/chicken/livestock_chicken_AAA_v00.png", category: "livestock" as const, width: 192, height: 48, frameW: 48, frameH: 48, cols: 4, rows: 1, notes: "Chicken body A, spot A, wattle A, palette v00. Row = one animation phase." },
  CHICKEN_AAA_v01: { path: "livestock/chicken/livestock_chicken_AAA_v01.png", category: "livestock" as const, width: 192, height: 48, frameW: 48, frameH: 48, cols: 4, rows: 1, notes: "Chicken AAA palette v01." },
  CHICKEN_AAA_v02: { path: "livestock/chicken/livestock_chicken_AAA_v02.png", category: "livestock" as const, width: 192, height: 48, frameW: 48, frameH: 48, cols: 4, rows: 1, notes: "Chicken AAA palette v02." },
  CHICKEN_AAB_v00: { path: "livestock/chicken/livestock_chicken_AAB_v00.png", category: "livestock" as const, width: 192, height: 48, frameW: 48, frameH: 48, cols: 4, rows: 1, notes: "Chicken body A, spot A, wattle B, palette v00." },
  CHICKEN_AAB_v01: { path: "livestock/chicken/livestock_chicken_AAB_v01.png", category: "livestock" as const, width: 192, height: 48, frameW: 48, frameH: 48, cols: 4, rows: 1, notes: "Chicken AAB palette v01." },
  CHICKEN_ABA_v00: { path: "livestock/chicken/livestock_chicken_ABA_v00.png", category: "livestock" as const, width: 192, height: 48, frameW: 48, frameH: 48, cols: 4, rows: 1, notes: "Chicken body A, spot B, wattle A, palette v00." },
  CHICKEN_ABB_v00: { path: "livestock/chicken/livestock_chicken_ABB_v00.png", category: "livestock" as const, width: 192, height: 48, frameW: 48, frameH: 48, cols: 4, rows: 1, notes: "Chicken body A, spot B, wattle B, palette v00." },
  CHICKEN_BAA_v00: { path: "livestock/chicken/livestock_chicken_BAA_v00.png", category: "livestock" as const, width: 192, height: 48, frameW: 48, frameH: 48, cols: 4, rows: 1, notes: "Chicken body B, spot A, wattle A, palette v00." },

  // Cow (cattle): larger sprite, 96×96 frames
  COW_AA_v00: { path: "livestock/cattle/livestock_cattle_AA_v00.png", category: "livestock" as const, width: 384, height: 96, frameW: 96, frameH: 96, cols: 4, rows: 1, notes: "Cow body A, spot A, palette v00. 96×96 frames." },
  COW_AA_v01: { path: "livestock/cattle/livestock_cattle_AA_v01.png", category: "livestock" as const, width: 384, height: 96, frameW: 96, frameH: 96, cols: 4, rows: 1, notes: "Cow AA palette v01." },
  COW_AB_v00: { path: "livestock/cattle/livestock_cattle_AB_v00.png", category: "livestock" as const, width: 384, height: 96, frameW: 96, frameH: 96, cols: 4, rows: 1, notes: "Cow body A, spot B, palette v00." },
  COW_BA_v00: { path: "livestock/cattle/livestock_cattle_BA_v00.png", category: "livestock" as const, width: 384, height: 96, frameW: 96, frameH: 96, cols: 4, rows: 1, notes: "Cow body B, spot A, palette v00." },
  COW_BB_v00: { path: "livestock/cattle/livestock_cattle_BB_v00.png", category: "livestock" as const, width: 384, height: 96, frameW: 96, frameH: 96, cols: 4, rows: 1, notes: "Cow body B, spot B, palette v00." },

  // Pig: 64×64 frames
  PIG_A_v00: { path: "livestock/pig/livestock_pig_A_v00.png", category: "livestock" as const, width: 256, height: 64, frameW: 64, frameH: 64, cols: 4, rows: 1, notes: "Pig, body A, palette v00. 64×64 frames." },
  PIG_A_v01: { path: "livestock/pig/livestock_pig_A_v01.png", category: "livestock" as const, width: 256, height: 64, frameW: 64, frameH: 64, cols: 4, rows: 1, notes: "Pig body A, palette v01." },
  PIG_B_v00: { path: "livestock/pig/livestock_pig_B_v00.png", category: "livestock" as const, width: 256, height: 64, frameW: 64, frameH: 64, cols: 4, rows: 1, notes: "Pig body B, palette v00." },

  // Duck: 48×48 frames
  DUCK_A_v00: { path: "livestock/duck/livestock_duck_A_v00.png", category: "livestock" as const, width: 192, height: 48, frameW: 48, frameH: 48, cols: 4, rows: 1, notes: "Duck, body A, palette v00. 48×48 frames." },
  DUCK_A_v01: { path: "livestock/duck/livestock_duck_A_v01.png", category: "livestock" as const, width: 192, height: 48, frameW: 48, frameH: 48, cols: 4, rows: 1, notes: "Duck body A, palette v01." },
  DUCK_B_v00: { path: "livestock/duck/livestock_duck_B_v00.png", category: "livestock" as const, width: 192, height: 48, frameW: 48, frameH: 48, cols: 4, rows: 1, notes: "Duck body B, palette v00." },

  // Chick: 32×32 frames
  CHICK_A_v00: { path: "livestock/chick/livestock_chick_A_v00.png", category: "livestock" as const, width: 128, height: 32, frameW: 32, frameH: 32, cols: 4, rows: 1, notes: "Baby chick, body A, palette v00. 32×32 frames." },
  CHICK_B_v00: { path: "livestock/chick/livestock_chick_B_v00.png", category: "livestock" as const, width: 128, height: 32, frameW: 32, frameH: 32, cols: 4, rows: 1, notes: "Baby chick, body B, palette v00." },
} as const satisfies Record<string, SpriteSheet>;

// ─────────────────────────────────────────────────────────────────────────────
// FLAT CATALOG — all sheets in one array for tooling / asset preloading
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_SHEETS: SpriteSheet[] = [
  ...Object.values(TILESETS),
  ...Object.values(EFFECTS),
  ...Object.values(FARMER_BASE),
  ...Object.values(NPC_PROPS),
  ...Object.values(LIVESTOCK),
  // NPC variants (nested objects)
  ...Object.values(NPCS).flatMap(variants => Object.values(variants) as SpriteSheet[]),
];
