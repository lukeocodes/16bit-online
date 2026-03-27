/**
 * Model system barrel export — import this to register all models and get the public API.
 *
 * Usage:
 *   import { registry, WorkbenchSpriteSheet, GameBridge, generateManifest } from "./models";
 */

// Register all models (side-effect imports)
import "./bodies/index";
import "./weapons/index";
import "./offhand/index";
import "./armor/index";
import "./headgear/index";
import "./hair/index";
import "./structures/index";

// Re-export public API
export { registry } from "./registry";
export { WorkbenchSpriteSheet } from "./WorkbenchSpriteSheet";
export { GameBridge } from "./GameBridge";
export { generateManifest, generateManifestJSON } from "./manifest";
export { computePalette } from "./palette";
export { computeHumanoidSkeleton } from "./skeleton";
export { renderComposite, renderModel } from "./composite";

// Re-export types
export type {
  Model,
  ModelCategory,
  AttachmentSlot,
  CompositeConfig,
  CompositeSlot,
  ModelPalette,
  Direction,
  Skeleton,
  DrawCall,
  RenderContext,
} from "./types";
