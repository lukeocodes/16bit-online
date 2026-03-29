import { Application, Graphics, RenderTexture, Container, Texture } from "pixi.js";
import type { Direction, ModelPalette, CompositeConfig } from "./types";
import { DIRECTION_COUNT } from "./types";
import { renderComposite, renderModel } from "./composite";
import { computePalette } from "./palette";
import { registry } from "./registry";

/**
 * WorkbenchSpriteSheet — drop-in replacement for the game client's EntitySpriteSheet.
 *
 * Implements the same API as EntitySpriteSheet:
 *   - getFrame(entityType: string, direction: number): Texture
 *   - has(entityType: string): boolean
 *   - dispose(): void
 *
 * Quality tiers (renderScale):
 *   Low    = 2  →  96×128px  — minimal memory, low-DPI or low-zoom use
 *   Medium = 3  → 144×192px  — balanced
 *   High   = 4  → 192×256px  — crisp at 2× zoom / Retina  (auto-detected default)
 *   Ultra  = 6  → 288×384px  — crisp at 4× zoom / 4K displays
 *
 * Auto-detect default: based on devicePixelRatio so the effective texture coverage
 * stays roughly constant across displays.
 */

const WALK_PHASES = 8;
const NATIVE_FRAME_W = 48;
const NATIVE_FRAME_H = 64;

export type RenderQuality = "low" | "medium" | "high" | "ultra";

const QUALITY_SCALE: Record<RenderQuality, number> = {
  low:   2,
  medium: 3,
  high:  4,
  ultra: 6,
};

/**
 * Pick a sensible default quality based on devicePixelRatio.
 * Targets an effective coverage of ~8× the native workbench unit.
 */
export function autoDetectQuality(): RenderQuality {
  const dpr = (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1;
  if (dpr >= 2.5) return "ultra";
  if (dpr >= 1.5) return "high";
  if (dpr >= 1.2) return "medium";
  return "low";
}

/**
 * Maps game entity names (substring) to workbench model IDs.
 * Order matters — first match wins.
 */
const NAME_TO_MODEL: [string, string][] = [
  ["king rabbit", "king-rabbit"],
  ["skeleton lord", "skeleton-lord"],
  ["alpha wolf", "alpha-wolf"],
  ["goblin chieftain", "goblin-chieftain"],
  ["imp overlord", "imp-overlord"],
  ["elder bear", "elder-bear"],
  ["rabbit", "rabbit-body"],
  ["skeleton", "skeleton-body"],
  ["goblin", "goblin-body"],
  ["imp", "imp-body"],
  ["wolf", "wolf-body"],
  ["ogre", "ogre-body"],
  ["wraith", "wraith-body"],
  ["bear", "bear-body"],
];

const NPC_PALETTES: Record<string, ModelPalette> = {};

function getNpcPalette(modelId: string): ModelPalette {
  if (!NPC_PALETTES[modelId]) {
    NPC_PALETTES[modelId] = computePalette(0xf0c8a0, 0x5c3a1e, 0x334455, 0x4466aa, 0x886633, "none");
  }
  return NPC_PALETTES[modelId];
}

function resolveModelId(entityName: string): string {
  const lower = entityName.toLowerCase();
  for (const [pattern, modelId] of NAME_TO_MODEL) {
    if (lower.includes(pattern)) return modelId;
  }
  return "human-body";
}

type EntityFrames = Texture[];

export class WorkbenchSpriteSheet {
  private app: Application;
  private cache = new Map<string, EntityFrames>();
  private renderScale: number;

  get displayScale(): number {
    return (1 / this.renderScale) * 1.5;
  }

  get displayedFrameHeight(): number {
    return NATIVE_FRAME_H * this.renderScale * this.displayScale;
  }

  readonly walkPhases = WALK_PHASES;

  constructor(app: Application, quality: RenderQuality = autoDetectQuality()) {
    this.app = app;
    this.renderScale = QUALITY_SCALE[quality];
  }

  /**
   * Change render quality at runtime. Flushes the texture cache so all
   * subsequent getFrame / getCompositeFrame calls regenerate at the new scale.
   */
  setQuality(quality: RenderQuality): void {
    const newScale = QUALITY_SCALE[quality];
    if (newScale === this.renderScale) return;
    this.dispose();
    this.renderScale = newScale;
  }

  getQuality(): RenderQuality {
    for (const [q, s] of Object.entries(QUALITY_SCALE) as [RenderQuality, number][]) {
      if (s === this.renderScale) return q;
    }
    return "high";
  }

  getFrame(entityType: string, direction: number, walkPhaseIndex = 0): Texture {
    if (!this.cache.has(entityType)) {
      this.cache.set(entityType, this.generateFrames(entityType));
    }
    const frames = this.cache.get(entityType)!;
    const dir = direction % DIRECTION_COUNT;
    const phase = walkPhaseIndex % WALK_PHASES;
    return frames[dir * WALK_PHASES + phase] ?? frames[0];
  }

  has(entityType: string): boolean {
    const modelId = resolveModelId(entityType);
    return registry.has(modelId);
  }

  getCompositeFrame(config: CompositeConfig, direction: number, walkPhaseIndex = 0): Texture {
    const key = this.compositeKey(config);
    if (!this.cache.has(key)) {
      this.cache.set(key, this.generateCompositeFrames(config));
    }
    const frames = this.cache.get(key)!;
    const dir = direction % DIRECTION_COUNT;
    const phase = walkPhaseIndex % WALK_PHASES;
    return frames[dir * WALK_PHASES + phase] ?? frames[0];
  }

  invalidateComposite(config: CompositeConfig): void {
    const key = this.compositeKey(config);
    const frames = this.cache.get(key);
    if (frames) {
      for (const f of frames) {
        if (f instanceof RenderTexture) f.destroy();
      }
      this.cache.delete(key);
    }
  }

  warmup(entityTypes: string[]): void {
    for (const type of entityTypes) {
      if (!this.cache.has(type)) {
        this.cache.set(type, this.generateFrames(type));
      }
    }
  }

  dispose(): void {
    for (const frames of this.cache.values()) {
      for (const f of frames) {
        if (f instanceof RenderTexture) f.destroy();
      }
    }
    this.cache.clear();
  }

  // ─── Private ─────────────────────────────────────────────────────

  private get frameW(): number { return NATIVE_FRAME_W * this.renderScale; }
  private get frameH(): number { return NATIVE_FRAME_H * this.renderScale; }

  private generateFrames(entityType: string): EntityFrames {
    const modelId = resolveModelId(entityType);
    const palette = getNpcPalette(modelId);
    const frames: Texture[] = [];
    const s = this.renderScale;
    const fw = this.frameW;
    const fh = this.frameH;

    for (let dir = 0; dir < DIRECTION_COUNT; dir++) {
      for (let p = 0; p < WALK_PHASES; p++) {
        const walkPhase = (p / WALK_PHASES) * Math.PI * 2;
        const container = new Container();
        const g = new Graphics();
        container.addChild(g);
        g.position.set(fw / 2, fh - 4 * s);
        renderModel(g, modelId, palette, dir, walkPhase, s, false);
        const rt = RenderTexture.create({ width: fw, height: fh });
        this.app.renderer.render({ container, target: rt });
        frames.push(rt);
        container.destroy();
      }
    }
    return frames;
  }

  private generateCompositeFrames(config: CompositeConfig): EntityFrames {
    const frames: Texture[] = [];
    const s = this.renderScale;
    const fw = this.frameW;
    const fh = this.frameH;

    for (let dir = 0; dir < DIRECTION_COUNT; dir++) {
      for (let p = 0; p < WALK_PHASES; p++) {
        const walkPhase = (p / WALK_PHASES) * Math.PI * 2;
        const container = new Container();
        const g = new Graphics();
        container.addChild(g);
        g.position.set(fw / 2, fh - 4 * s);
        renderComposite(g, config, dir, walkPhase, s);
        const rt = RenderTexture.create({ width: fw, height: fh });
        this.app.renderer.render({ container, target: rt });
        frames.push(rt);
        container.destroy();
      }
    }
    return frames;
  }

  private compositeKey(config: CompositeConfig): string {
    const parts = [
      config.baseModelId,
      `b${config.build ?? 1}h${config.height ?? 1}`,
      ...config.attachments.map((a) => `${a.slot}:${a.modelId}`).sort(),
    ];
    return `composite:${parts.join("|")}`;
  }
}
