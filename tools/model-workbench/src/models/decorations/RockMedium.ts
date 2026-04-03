import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_S } from "../types";

/** Medium boulder — irregular polygon with directional shading and crack. */
export class RockMedium implements Model {
  readonly id = "rock-medium";
  readonly name = "Medium Boulder";
  readonly category = "construction" as const;
  readonly slot = "root" as const;
  readonly isAnimated = false;

  getDrawCalls(_ctx: RenderContext): DrawCall[] {
    return [{
      depth: DEPTH_S + 3,
      draw: (g: Graphics, s: number) => {
        // Shadow
        g.ellipse(0, 5 * s, 10 * s, 4 * s);
        g.fill({ color: 0x000000, alpha: 0.2 });

        // Organic boulder polygon using sin offsets
        const pts: [number, number][] = [
          [-8 + Math.sin(0) * 1.5,    -2 + Math.sin(0.3) * 1],
          [-5 + Math.sin(1.2) * 1.5,  -8 + Math.sin(1.5) * 1],
          [ 0 + Math.sin(2.1) * 1.5,  -10 + Math.sin(0.8) * 1],
          [ 6 + Math.sin(0.5) * 1.5,  -7 + Math.sin(1.8) * 1],
          [ 9 + Math.sin(1.0) * 1.5,  -1 + Math.sin(0.2) * 1],
          [ 7 + Math.sin(0.7) * 1.5,   4 + Math.sin(1.4) * 1],
          [-2 + Math.sin(1.9) * 1.5,   5 + Math.sin(0.6) * 1],
          [-7 + Math.sin(0.4) * 1.5,   2 + Math.sin(1.1) * 1],
        ];
        g.moveTo(pts[0][0] * s, pts[0][1] * s);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] * s, pts[i][1] * s);
        g.closePath(); g.fill(0x888888);
        g.moveTo(pts[0][0] * s, pts[0][1] * s);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] * s, pts[i][1] * s);
        g.closePath(); g.stroke({ width: s * 0.6, color: 0x555555 });

        // Lit face (upper-left)
        g.moveTo(-5 * s, -8 * s); g.lineTo(0, -10 * s); g.lineTo(-8 * s, -2 * s); g.closePath();
        g.fill({ color: 0xb0b0b0, alpha: 0.5 });

        // Shadow face (lower-right)
        g.moveTo(6 * s, -7 * s); g.lineTo(9 * s, -1 * s); g.lineTo(7 * s, 4 * s); g.closePath();
        g.fill({ color: 0x444444, alpha: 0.45 });

        // Crack lines
        g.moveTo(-1 * s, -9 * s); g.lineTo(2 * s, -3 * s); g.lineTo(1 * s, 3 * s);
        g.stroke({ width: s * 0.5, color: 0x444444, alpha: 0.7 });
        g.moveTo(3 * s, -6 * s); g.lineTo(5 * s, -2 * s);
        g.stroke({ width: s * 0.4, color: 0x444444, alpha: 0.5 });
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
