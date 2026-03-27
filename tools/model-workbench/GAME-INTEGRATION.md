# Workbench → Game Client Integration

Replace the placeholder procedural shapes in the game client with the workbench's full procedural character model system.

---

## Context

`tools/model-workbench/src/models/` contains a complete PixiJS character model system (72 models, 8 directions, walk cycle, combat animation). The game client at `packages/client/src/renderer/EntityRenderer.ts` currently draws placeholder shapes (rounded rects, circles). `GameBridge` was built exactly for this integration and has never been wired up.

---

## Step 1 — Add workbench as a workspace dependency

In `tools/model-workbench/package.json`, ensure there is a `name` field:
```json
"name": "model-workbench"
```

In `packages/client/package.json`, add:
```json
"dependencies": {
  "model-workbench": "workspace:*"
}
```

Run `bun install` from the repo root.

---

## Step 2 — Register all models (side-effect imports)

Create `packages/client/src/renderer/models.ts`:

```typescript
// Side-effect imports — registers all 72 models in the workbench registry
import "model-workbench/src/models/bodies/index";
import "model-workbench/src/models/weapons/index";
import "model-workbench/src/models/offhand/index";
import "model-workbench/src/models/armor/index";
import "model-workbench/src/models/headgear/index";
import "model-workbench/src/models/hair/index";

export { GameBridge } from "model-workbench/src/models/GameBridge";
export { computePalette } from "model-workbench/src/models/palette";
export type { CompositeConfig } from "model-workbench/src/models/types";
```

---

## Step 3 — Map entity types to model IDs

The game's `RenderableComponent` has `meshType` (e.g. `"skeleton"`, `"goblin"`, `"rabbit"`) and color strings (`bodyColor`, `skinColor`, `hairColor`). Create `packages/client/src/renderer/buildCompositeConfig.ts`:

```typescript
import type { CompositeConfig } from "model-workbench/src/models/types";
import { computePalette } from "model-workbench/src/models/palette";

export function buildCompositeConfig(
  meshType: string,
  bodyColor: string,
  skinColor: string,
  hairColor: string
): CompositeConfig {
  const skin    = parseInt(skinColor.replace("#", ""), 16);
  const hair    = parseInt(hairColor.replace("#", ""), 16);
  const primary = parseInt(bodyColor.replace("#", ""), 16);
  const palette = computePalette(skin, hair, 0x334455, primary, 0x886633, "leather");

  const npcBodies: Record<string, string> = {
    "skeleton":          "skeleton-body",
    "skeleton-lord":     "skeleton-lord",
    "goblin":            "goblin-body",
    "goblin-chieftain":  "goblin-chieftain",
    "rabbit":            "rabbit-body",
    "king-rabbit":       "king-rabbit",
    "wolf":              "wolf-body",
    "alpha-wolf":        "alpha-wolf",
    "bear":              "bear-body",
    "elder-bear":        "elder-bear",
    "imp":               "imp-body",
    "imp-overlord":      "imp-overlord",
    "ogre":              "ogre-body",
    "wraith":            "wraith-body",
    "witch":             "witch-body",
  };

  const npcId = npcBodies[meshType];
  if (npcId) {
    return { baseModelId: npcId, attachments: [], palette, build: 1, height: 1 };
  }

  // Player / humanoid fallback
  return {
    baseModelId: "human-body",
    attachments: [
      { slot: "head-top", modelId: "hair-short" },
      { slot: "torso",    modelId: "armor-leather" },
    ],
    palette,
    build: 1,
    height: 1,
  };
}
```

---

## Step 4 — Replace placeholder drawing in EntityRenderer

`EntityRenderer.ts` calls `drawHumanoidSprite`, `drawSkeletonSprite`, `drawGoblinSprite`, `drawRabbitSprite`, `drawImpSprite` on a PixiJS `Graphics` object. Replace those with `GameBridge`-generated textures.

```typescript
import { Sprite, Texture } from "pixi.js";
import { GameBridge } from "./models";
import { buildCompositeConfig } from "./buildCompositeConfig";

// Create once, pass the existing PixiJS Application instance
const bridge = new GameBridge(pixiApp);

// When creating an entity's display object:
function buildEntitySprite(entity: Entity): { sprite: Sprite; textures: Texture[] } {
  const r = entity.renderable!;
  const config = buildCompositeConfig(r.meshType, r.bodyColor, r.skinColor, r.hairColor);
  const textures = bridge.generateCompositeSpriteSheet(config);
  const sprite = new Sprite(textures[entity.direction ?? 0]);
  sprite.anchor.set(0.5, 1); // bottom-center, matches current BODY_HEIGHT alignment
  return { sprite, textures };
}

// Each tick — swap texture for current facing direction:
sprite.texture = textures[entity.direction ?? 0];
```

Store the `textures[]` array per entity (alongside the `Sprite`) so it is only regenerated when colours change, not every frame.

---

## Step 5 — Walk cycle (do after static sprites work)

`bridge.generateWalkCycle(modelId, palette, 8)` returns `walkFrames[direction][phase]`.
Feed the game's existing walk phase counter into texture selection:

```typescript
sprite.texture = walkFrames[direction][Math.floor(walkPhase) % 8];
```

---

## What NOT to touch

- `EntityRenderer`'s overlay layer: HP bars, damage numbers, target ring, chat bubbles, shadow ellipse — these sit above the sprite in the container and stay as-is.
- Server-side entity data and `RenderableComponent` field names.
- `meshType` string values sent from the server.

---

## Frame size

Workbench default is `FRAME_W=48, FRAME_H=64`. Client currently uses `FRAME_W=40, FRAME_H=72`.
Either align the client constants to `48×64`, or pass `frameW` / `frameH` overrides to `generateCompositeSpriteSheet`.

---

## Reference

| What | Where |
|---|---|
| Placeholder methods to delete | `EntityRenderer.ts` — `drawHumanoidSprite`, `drawSkeletonSprite`, `drawGoblinSprite`, `drawRabbitSprite`, `drawImpSprite` |
| GameBridge source | `tools/model-workbench/src/models/GameBridge.ts` |
| Full model list | `tools/model-workbench/src/models/manifest.ts` → `generateManifest()` |
| Palette helper | `tools/model-workbench/src/models/palette.ts` → `computePalette(skin, hair, eyes, primary, secondary, armorType)` |
| Direction order | `tools/model-workbench/src/models/types.ts` → `DIRECTION_NAMES = ["S","SW","W","NW","N","NE","E","SE"]` |
| All body model IDs | `tools/model-workbench/src/models/bodies/index.ts` |
