import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_S, DEPTH_W } from "../types";

/** Medium tree — wider trunk with root flares, layered canopy. */
export class TreeMedium implements Model {
  readonly id = "tree-medium";
  readonly name = "Medium Tree";
  readonly category = "construction" as const;
  readonly slot = "root" as const;
  readonly isAnimated = false;

  getDrawCalls(_ctx: RenderContext): DrawCall[] {
    return [
      {
        depth: DEPTH_S + 2,
        draw: (g: Graphics, s: number) => {
          // Shadow
          g.ellipse(0, 5 * s, 10 * s, 4 * s);
          g.fill({ color: 0x000000, alpha: 0.2 });
          // Root flares
          const flares = [[-3, 2], [3, 2], [-2.5, 3]];
          for (const [fx, fy] of flares) {
            g.moveTo(fx * s, fy * s);
            g.quadraticCurveTo((fx * 1.8) * s, (fy + 3) * s, (fx * 2.5) * s, (fy + 4) * s);
            g.stroke({ width: s * 1.8, color: 0x4a2a10 });
          }
          // Trunk
          g.rect(-2 * s, -15 * s, 4 * s, 19 * s);
          g.fill(0x5a3a1a);
          // Shading bands
          g.moveTo(-1 * s, -15 * s); g.lineTo(-1.5 * s, 4 * s);
          g.stroke({ width: s * 0.7, color: 0x3a2010 });
          g.moveTo(1.5 * s, -15 * s); g.lineTo(1 * s, 4 * s);
          g.stroke({ width: s * 0.5, color: 0x7a5030, alpha: 0.5 });
        },
      },
      {
        depth: DEPTH_W + 2,
        draw: (g: Graphics, s: number) => {
          // 4 overlapping canopy ellipses, dark to light
          g.ellipse(-4 * s, -22 * s, 12 * s, 8 * s); g.fill(0x245a14);
          g.ellipse(4 * s, -24 * s, 11 * s, 7 * s);  g.fill(0x2a6a1a);
          g.ellipse(-2 * s, -27 * s, 10 * s, 7 * s); g.fill(0x3a8a2a);
          g.ellipse(1 * s, -29 * s, 8 * s, 5 * s);   g.fill(0x4a9a30);
        },
      },
      {
        depth: DEPTH_W + 3,
        draw: (g: Graphics, s: number) => {
          // Top highlight ellipse
          g.ellipse(0, -31 * s, 5 * s, 3.5 * s); g.fill(0x5aaa38);
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
