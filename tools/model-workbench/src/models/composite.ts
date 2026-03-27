import type { Graphics } from "pixi.js";
import type {
  CompositeConfig,
  Direction,
  DrawCall,
  ModelPalette,
  RenderContext,
} from "./types";
import { ISO_OFFSETS } from "./types";
import { computeHumanoidSkeleton } from "./skeleton";
import { registry } from "./registry";

/**
 * Build a render context from a skeleton and palette.
 */
function buildRenderContext(
  skeleton: ReturnType<typeof computeHumanoidSkeleton>,
  palette: ModelPalette
): RenderContext {
  const iso = skeleton.iso;
  const leftIsFar = iso.x >= 0;
  return {
    skeleton,
    palette,
    farSide: leftIsFar ? "L" : "R",
    nearSide: leftIsFar ? "R" : "L",
    facingCamera: iso.y > 0,
  };
}

/**
 * Render a composite entity — a base model with attached child models.
 * This is the main entry point that replaces the old renderCharacter().
 */
export function renderComposite(
  g: Graphics,
  config: CompositeConfig,
  dir: Direction | number,
  walkPhase: number,
  scale: number
): void {
  const skeleton = computeHumanoidSkeleton(dir as Direction, walkPhase);
  const ctx = buildRenderContext(skeleton, config.palette);

  const calls: DrawCall[] = [];

  // Base model draw calls
  const baseModel = registry.get(config.baseModelId);
  if (baseModel) {
    calls.push(...baseModel.getDrawCalls(ctx));
  }

  // Attached model draw calls
  for (const att of config.attachments) {
    const childModel = registry.get(att.modelId);
    if (childModel) {
      calls.push(...childModel.getDrawCalls(ctx));
    }
  }

  // Sort by depth and execute
  calls.sort((a, b) => a.depth - b.depth);
  for (const call of calls) {
    call.draw(g, scale);
  }
}

/**
 * Render a single model in isolation (for the individual model view).
 * For non-root models, optionally renders on a ghost body for context.
 */
export function renderModel(
  g: Graphics,
  modelId: string,
  palette: ModelPalette,
  dir: Direction | number,
  walkPhase: number,
  scale: number,
  showGhostBody: boolean = false
): void {
  const skeleton = computeHumanoidSkeleton(dir as Direction, walkPhase);
  const ctx = buildRenderContext(skeleton, palette);

  const calls: DrawCall[] = [];

  // Ghost body (faint silhouette for context)
  if (showGhostBody) {
    const bodyModel = registry.get("human-body");
    if (bodyModel) {
      // We'll draw the body calls but they'll appear as-is
      // A proper ghost effect would need alpha, but for now it provides context
      calls.push(...bodyModel.getDrawCalls(ctx));
    }
  }

  // The actual model
  const model = registry.get(modelId);
  if (model) {
    calls.push(...model.getDrawCalls(ctx));
  }

  calls.sort((a, b) => a.depth - b.depth);
  for (const call of calls) {
    call.draw(g, scale);
  }
}
