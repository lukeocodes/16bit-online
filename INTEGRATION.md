# Integrating Workbench Models into the Game Client

## Quick Start

The workbench model system can replace the game's `EntitySpriteSheet` with zero changes to `EntityRenderer` or any other game code.

### Step 1: Import model barrels

In your game client's entry point (or a new module), import the workbench model registration barrels:

```typescript
// Register all workbench models
import "../../tools/model-workbench/src/models/bodies/index";
import "../../tools/model-workbench/src/models/weapons/index";
import "../../tools/model-workbench/src/models/offhand/index";
import "../../tools/model-workbench/src/models/armor/index";
import "../../tools/model-workbench/src/models/headgear/index";
import "../../tools/model-workbench/src/models/hair/index";
```

### Step 2: Create the adapter

```typescript
import { WorkbenchSpriteSheet } from "../../tools/model-workbench/src/models/WorkbenchSpriteSheet";

// In your game initialization:
const spriteSheet = new WorkbenchSpriteSheet(app);
entityRenderer.setSpriteSheet(spriteSheet);
```

### Step 3: Done

The `WorkbenchSpriteSheet` automatically maps game entity names to workbench models:
- "Rabbit Burrow" → `rabbit-body`
- "Skeleton Warrior" → `skeleton-body`
- "Goblin Grunt" → `goblin-body`
- "King Rabbit" → `king-rabbit` (boss variant)
- Players → `human-body` (fallback)

## Composite Characters (Players with Equipment)

For player characters with equipment, use `getCompositeFrame()`:

```typescript
import type { CompositeConfig } from "../../tools/model-workbench/src/models/types";
import { computePalette } from "../../tools/model-workbench/src/models/palette";

const playerConfig: CompositeConfig = {
  baseModelId: "human-body",
  build: 1.0,
  height: 1.0,
  attachments: [
    { slot: "head-top", modelId: "hair-short" },
    { slot: "torso", modelId: "armor-leather" },
    { slot: "hand-R", modelId: "weapon-sword" },
    { slot: "hand-L", modelId: "shield-kite" },
    { slot: "legs", modelId: "legs-leather" },
    { slot: "feet-L", modelId: "boots-leather" },
  ],
  palette: computePalette(0xf0c8a0, 0x5c3a1e, 0x334455, 0x4466aa, 0x886633, "leather"),
};

const texture = spriteSheet.getCompositeFrame(playerConfig, directionIndex);
```

## GameBridge (Advanced)

For more control, use `GameBridge` directly:

```typescript
import { GameBridge } from "../../tools/model-workbench/src/models/GameBridge";

const bridge = new GameBridge(app);

// Generate walk cycle (8 directions × 8 phases = 64 textures)
const walkCycle = bridge.generateWalkCycle("skeleton-body");
const frame = walkCycle[direction][walkPhaseIndex];

// Generate sprite sheet for a composite character
const textures = bridge.generateCompositeSpriteSheet(playerConfig);
```

## Model Manifest

Export the full model list as JSON for server-side validation or UI:

```typescript
import { generateManifest } from "../../tools/model-workbench/src/models/manifest";

const models = generateManifest();
// Array of { id, name, category, slot, canHoldWeapons, isQuadruped, isBoss, baseVariantOf }
```

## Available Models (74 total)

| Category | Count | Examples |
|----------|-------|---------|
| Bodies | 3 | Human, Elf, Dwarf |
| NPCs | 8 | Skeleton, Goblin, Rabbit, Imp, Wolf, Ogre, Wraith, Bear |
| Bosses | 6 | King Rabbit, Skeleton Lord, Alpha Wolf, Goblin Chieftain, Imp Overlord, Elder Bear |
| Hair | 6 | Short, Long, Ponytail, Mohawk, Braided, Bald |
| Headgear | 6 | Plate Helmet, Mail Coif, Cloth Hood, Leather Cap, Crown, Horned Helm |
| Shoulders | 4 | Cloth/Leather/Mail/Plate |
| Torso Armor | 8 | Cloth/Leather/Mail/Plate + Dragon/Elven/Bone/Ogreskin |
| Gauntlets | 4 | Cloth/Leather/Mail/Plate |
| Leg Armor | 4 | Cloth/Leather/Mail/Plate |
| Boots | 4 | Cloth/Leather/Mail/Plate |
| Weapons | 12 | Sword, Axe, Mace, Spear, Bow, Staff, Wand, Dagger, Crossbow, Flail, Halberd, Throwing Knife |
| Off-hand | 5 | Kite Shield, Tower Shield, Buckler, Spell Tome, Torch |
