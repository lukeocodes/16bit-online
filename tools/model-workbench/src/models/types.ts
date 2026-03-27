import type { Graphics } from "pixi.js";

// ─── Primitives ─────────────────────────────────────────────────────

export interface V {
  x: number;
  y: number;
}

export type Direction = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DIRECTION_COUNT = 8;
export const DIRECTION_NAMES = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"];
export const FRAME_W = 48;
export const FRAME_H = 64;

export const ISO_OFFSETS: V[] = [
  { x: 0, y: 0.5 },
  { x: -0.4, y: 0.3 },
  { x: -0.5, y: 0 },
  { x: -0.4, y: -0.3 },
  { x: 0, y: -0.5 },
  { x: 0.4, y: -0.3 },
  { x: 0.5, y: 0 },
  { x: 0.4, y: 0.3 },
];

// ─── Skeleton ───────────────────────────────────────────────────────

export interface AttachmentPoint {
  position: V;
  /** Angle in radians for attached model orientation */
  angle: number;
  /** Perspective width factor at this point */
  wf: number;
}

export interface Skeleton {
  joints: Record<string, V>;
  attachments: Record<string, AttachmentPoint>;
  bob: number;
  /** Perspective width factor (1 = front, ~0.65 = side) */
  wf: number;
  iso: V;
  direction: Direction;
  walkPhase: number;
}

// ─── Palette ────────────────────────────────────────────────────────

export interface ModelPalette {
  skin: number;
  hair: number;
  eyes: number;
  primary: number;
  secondary: number;
  body: number;
  bodyDk: number;
  bodyLt: number;
  accent: number;
  accentDk: number;
  outline: number;
}

// ─── Draw call ──────────────────────────────────────────────────────

export interface DrawCall {
  depth: number;
  draw: (g: Graphics, scale: number) => void;
}

// ─── Render context ─────────────────────────────────────────────────

export interface RenderContext {
  skeleton: Skeleton;
  palette: ModelPalette;
  farSide: "L" | "R";
  nearSide: "L" | "R";
  facingCamera: boolean;
}

// ─── Model ──────────────────────────────────────────────────────────

export type ModelCategory =
  | "body"
  | "hair"
  | "armor"
  | "weapon"
  | "offhand"
  | "headgear"
  | "legs"
  | "feet"
  | "npc";

export type AttachmentSlot =
  | "root"
  | "hand-R"
  | "hand-L"
  | "head-top"
  | "torso"
  | "torso-back"
  | "legs"
  | "feet-L"
  | "feet-R";

export interface Model {
  readonly id: string;
  readonly name: string;
  readonly category: ModelCategory;
  readonly slot: AttachmentSlot;
  getDrawCalls(ctx: RenderContext): DrawCall[];
  getAttachmentPoints(skeleton: Skeleton): Record<string, AttachmentPoint>;
}

// ─── Composite config ───────────────────────────────────────────────

export interface CompositeSlot {
  slot: AttachmentSlot;
  modelId: string;
}

export interface CompositeConfig {
  baseModelId: string;
  attachments: CompositeSlot[];
  palette: ModelPalette;
}
