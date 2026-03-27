/**
 * Item Registry — static item template definitions.
 *
 * Equipment slots: weapon, head, chest, legs, feet, ring, trinket
 * Item types: weapon, armor, consumable, material
 */

export type ItemSlot = "weapon" | "head" | "chest" | "legs" | "feet" | "ring" | "trinket";
export type ItemType = "weapon" | "armor" | "consumable" | "material";
export type WeaponSubtype = "sword" | "axe" | "bow" | "staff" | "dagger";
export type ArmorWeight = "light" | "medium" | "heavy";

export interface ItemTemplate {
  id: string;
  name: string;
  type: ItemType;
  slot?: ItemSlot;
  weaponSubtype?: WeaponSubtype;
  armorWeight?: ArmorWeight;
  icon: string;           // emoji for now, sprite key later
  description: string;
  level: number;          // minimum level to equip
  // Stat bonuses when equipped
  bonusStr?: number;
  bonusDex?: number;
  bonusInt?: number;
  bonusHp?: number;
  bonusDamage?: number;
  bonusArmor?: number;
  // For consumables
  healAmount?: number;
  // Stack limit (1 = non-stackable equipment)
  stackLimit: number;
  // Gold value
  value: number;
}

export interface LootEntry {
  itemId: string;
  chance: number;     // 0.0 - 1.0
  minQty: number;
  maxQty: number;
}

export type LootTable = LootEntry[];

// ============================================
// Item Template Registry
// ============================================

export const ITEMS: Record<string, ItemTemplate> = {
  // --- Consumables ---
  "health-potion-small": {
    id: "health-potion-small", name: "Small Health Potion", type: "consumable",
    icon: "🧪", description: "Restores 25 HP", level: 1,
    healAmount: 25, stackLimit: 20, value: 5,
  },
  "health-potion-medium": {
    id: "health-potion-medium", name: "Health Potion", type: "consumable",
    icon: "🧪", description: "Restores 50 HP", level: 5,
    healAmount: 50, stackLimit: 20, value: 15,
  },

  // --- Materials ---
  "rabbit-hide": {
    id: "rabbit-hide", name: "Rabbit Hide", type: "material",
    icon: "🐾", description: "Soft fur from a rabbit", level: 1,
    stackLimit: 50, value: 2,
  },
  "bone-fragment": {
    id: "bone-fragment", name: "Bone Fragment", type: "material",
    icon: "🦴", description: "A shard of bleached bone", level: 1,
    stackLimit: 50, value: 3,
  },
  "goblin-ear": {
    id: "goblin-ear", name: "Goblin Ear", type: "material",
    icon: "👂", description: "Proof of a goblin kill", level: 1,
    stackLimit: 50, value: 4,
  },
  "imp-horn": {
    id: "imp-horn", name: "Imp Horn", type: "material",
    icon: "🔺", description: "A small curved horn", level: 1,
    stackLimit: 50, value: 5,
  },

  // --- Weapons (Lv1-3) ---
  "rusty-sword": {
    id: "rusty-sword", name: "Rusty Sword", type: "weapon", slot: "weapon",
    weaponSubtype: "sword", icon: "🗡️", description: "A dull, rusty blade",
    level: 1, bonusDamage: 2, stackLimit: 1, value: 10,
  },
  "wooden-bow": {
    id: "wooden-bow", name: "Wooden Bow", type: "weapon", slot: "weapon",
    weaponSubtype: "bow", icon: "🏹", description: "A simple shortbow",
    level: 1, bonusDamage: 2, bonusDex: 1, stackLimit: 1, value: 12,
  },
  "gnarled-staff": {
    id: "gnarled-staff", name: "Gnarled Staff", type: "weapon", slot: "weapon",
    weaponSubtype: "staff", icon: "🪄", description: "A twisted branch with faint magical energy",
    level: 2, bonusDamage: 3, bonusInt: 2, stackLimit: 1, value: 18,
  },
  "goblin-dagger": {
    id: "goblin-dagger", name: "Goblin Dagger", type: "weapon", slot: "weapon",
    weaponSubtype: "dagger", icon: "🔪", description: "Crude but sharp",
    level: 2, bonusDamage: 3, bonusDex: 1, stackLimit: 1, value: 15,
  },
  "bone-axe": {
    id: "bone-axe", name: "Bone Axe", type: "weapon", slot: "weapon",
    weaponSubtype: "axe", icon: "🪓", description: "An axe crafted from skeletal remains",
    level: 3, bonusDamage: 4, bonusStr: 2, stackLimit: 1, value: 25,
  },

  // --- Armor (Lv1-3) ---
  "leather-cap": {
    id: "leather-cap", name: "Leather Cap", type: "armor", slot: "head",
    armorWeight: "light", icon: "🎩", description: "Basic head protection",
    level: 1, bonusArmor: 1, stackLimit: 1, value: 8,
  },
  "hide-vest": {
    id: "hide-vest", name: "Hide Vest", type: "armor", slot: "chest",
    armorWeight: "light", icon: "🦺", description: "A vest made from animal hides",
    level: 1, bonusArmor: 2, bonusHp: 5, stackLimit: 1, value: 12,
  },
  "bone-helm": {
    id: "bone-helm", name: "Bone Helm", type: "armor", slot: "head",
    armorWeight: "medium", icon: "💀", description: "A helmet fashioned from skull fragments",
    level: 2, bonusArmor: 2, bonusStr: 1, stackLimit: 1, value: 16,
  },
  "chainmail-vest": {
    id: "chainmail-vest", name: "Chainmail Vest", type: "armor", slot: "chest",
    armorWeight: "heavy", icon: "🛡️", description: "Interlocking metal rings",
    level: 3, bonusArmor: 4, bonusHp: 10, stackLimit: 1, value: 30,
  },
  "leather-boots": {
    id: "leather-boots", name: "Leather Boots", type: "armor", slot: "feet",
    armorWeight: "light", icon: "👢", description: "Sturdy walking boots",
    level: 1, bonusArmor: 1, bonusDex: 1, stackLimit: 1, value: 8,
  },

  // --- Trinkets ---
  "rabbit-foot": {
    id: "rabbit-foot", name: "Lucky Rabbit Foot", type: "armor", slot: "trinket",
    icon: "🐇", description: "Grants a small luck bonus",
    level: 1, bonusDex: 2, stackLimit: 1, value: 20,
  },
};

// ============================================
// Loot Tables by NPC template ID
// ============================================

export const LOOT_TABLES: Record<string, LootTable> = {
  "rabbit": [
    { itemId: "rabbit-hide", chance: 0.6, minQty: 1, maxQty: 2 },
    { itemId: "health-potion-small", chance: 0.15, minQty: 1, maxQty: 1 },
    { itemId: "rabbit-foot", chance: 0.03, minQty: 1, maxQty: 1 },
  ],
  "skeleton-warrior": [
    { itemId: "bone-fragment", chance: 0.5, minQty: 1, maxQty: 3 },
    { itemId: "rusty-sword", chance: 0.08, minQty: 1, maxQty: 1 },
    { itemId: "bone-helm", chance: 0.05, minQty: 1, maxQty: 1 },
    { itemId: "health-potion-small", chance: 0.2, minQty: 1, maxQty: 1 },
  ],
  "skeleton-archer": [
    { itemId: "bone-fragment", chance: 0.5, minQty: 1, maxQty: 2 },
    { itemId: "wooden-bow", chance: 0.08, minQty: 1, maxQty: 1 },
    { itemId: "leather-cap", chance: 0.06, minQty: 1, maxQty: 1 },
    { itemId: "health-potion-small", chance: 0.2, minQty: 1, maxQty: 1 },
  ],
  "skeleton-mage": [
    { itemId: "bone-fragment", chance: 0.4, minQty: 1, maxQty: 2 },
    { itemId: "gnarled-staff", chance: 0.06, minQty: 1, maxQty: 1 },
    { itemId: "health-potion-medium", chance: 0.1, minQty: 1, maxQty: 1 },
  ],
  "goblin-grunt": [
    { itemId: "goblin-ear", chance: 0.5, minQty: 1, maxQty: 1 },
    { itemId: "goblin-dagger", chance: 0.07, minQty: 1, maxQty: 1 },
    { itemId: "hide-vest", chance: 0.05, minQty: 1, maxQty: 1 },
    { itemId: "health-potion-small", chance: 0.2, minQty: 1, maxQty: 1 },
    { itemId: "leather-boots", chance: 0.04, minQty: 1, maxQty: 1 },
  ],
  "goblin-shaman": [
    { itemId: "goblin-ear", chance: 0.5, minQty: 1, maxQty: 1 },
    { itemId: "gnarled-staff", chance: 0.08, minQty: 1, maxQty: 1 },
    { itemId: "health-potion-medium", chance: 0.12, minQty: 1, maxQty: 1 },
  ],
  "imp": [
    { itemId: "imp-horn", chance: 0.5, minQty: 1, maxQty: 1 },
    { itemId: "health-potion-small", chance: 0.15, minQty: 1, maxQty: 1 },
  ],
  "skeleton-lord": [
    { itemId: "bone-fragment", chance: 0.8, minQty: 2, maxQty: 5 },
    { itemId: "bone-axe", chance: 0.1, minQty: 1, maxQty: 1 },
    { itemId: "bone-helm", chance: 0.1, minQty: 1, maxQty: 1 },
    { itemId: "chainmail-vest", chance: 0.04, minQty: 1, maxQty: 1 },
    { itemId: "health-potion-medium", chance: 0.25, minQty: 1, maxQty: 1 },
  ],
};

/** Roll loot from a loot table. Returns array of {itemId, qty} drops. */
export function rollLoot(npcTemplateId: string): Array<{ itemId: string; qty: number }> {
  const table = LOOT_TABLES[npcTemplateId];
  if (!table) return [];

  const drops: Array<{ itemId: string; qty: number }> = [];
  for (const entry of table) {
    if (Math.random() < entry.chance) {
      const qty = entry.minQty + Math.floor(Math.random() * (entry.maxQty - entry.minQty + 1));
      drops.push({ itemId: entry.itemId, qty });
    }
  }
  return drops;
}

export function getItem(itemId: string): ItemTemplate | undefined {
  return ITEMS[itemId];
}
