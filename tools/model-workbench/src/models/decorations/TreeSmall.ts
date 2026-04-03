import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_S, DEPTH_W } from "../types";

/** Small tree — trunk + 2–3 canopy ellipses, fits 1 tile. */
export class TreeSmall implements Model {
  readonly id = "tree-small";
  readonly name = "Small Tree";
  readonly category = "construction" as const;
  readonly slot = "root" as const;
  readonly isAnimated = false;

  getDrawCalls(_ctx: RenderContext): DrawCall[] {
    return [
      {
        depth: DEPTH_S + 2,
        draw: (g: Graphics, s: number) => {
          // Shadow
          g.ellipse(0, 4 * s, 7 * s, 3 * s);
          g.fill({ color: 0x000000, alpha: 0.18 });
          // Trunk
          g.rect(-1 * s, -8 * s, 2 * s, 12 * s);
          g.fill(0x5a3a1a);
        },
      },
      {
        depth: DEPTH_W + 2,
        draw: (g: Graphics, s: number) => {
          // Canopy back (darker)
          g.ellipse(-3 * s, -14 * s, 10 * s, 7 * s);
          g.fill(0x2a6a1a);
          // Canopy mid
          g.ellipse(2 * s, -16 * s, 9 * s, 6 * s);
          g.fill(0x3a8a2a);
          // Canopy top (lighter)
          g.ellipse(0, -18 * s, 7 * s, 5 * s);
          g.fill(0x4a9a30);
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
