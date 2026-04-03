import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_W, FRAME_H } from "../types";

/** Large tree — massive trunk filling full frame height, canopy above view. */
export class TreeLarge implements Model {
  readonly id = "tree-large";
  readonly name = "Large Tree";
  readonly category = "construction" as const;
  readonly slot = "root" as const;
  readonly isAnimated = false;

  getDrawCalls(_ctx: RenderContext): DrawCall[] {
    return [{
      depth: DEPTH_W + 2,
      draw: (g: Graphics, s: number) => {
        const fh = FRAME_H;
        // Shadow
        g.ellipse(0, 5 * s, 14 * s, 5 * s);
        g.fill({ color: 0x000000, alpha: 0.25 });

        // Trunk base fill (tapered — wider at bottom)
        g.moveTo(-4 * s, (-fh + 8) * s);
        g.lineTo(-6 * s, (-fh + 28) * s);
        g.lineTo(-7 * s, (-fh / 2) * s);
        g.lineTo(-8 * s, 4 * s);
        g.lineTo(8 * s, 4 * s);
        g.lineTo(7 * s, (-fh / 2) * s);
        g.lineTo(6 * s, (-fh + 28) * s);
        g.lineTo(4 * s, (-fh + 8) * s);
        g.closePath();
        g.fill(0x5a3a1a);

        // Shadow band (right/far side)
        g.moveTo(4 * s, (-fh + 8) * s);
        g.lineTo(6 * s, (-fh + 28) * s);
        g.lineTo(7 * s, (-fh / 2) * s);
        g.lineTo(8 * s, 4 * s);
        g.lineTo(5 * s, 4 * s);
        g.lineTo(4.5 * s, (-fh / 2) * s);
        g.lineTo(3.5 * s, (-fh + 28) * s);
        g.lineTo(2 * s, (-fh + 8) * s);
        g.closePath();
        g.fill(0x3a2010);

        // Light band (left/near side)
        g.moveTo(-4 * s, (-fh + 8) * s);
        g.lineTo(-6 * s, (-fh + 28) * s);
        g.lineTo(-7 * s, (-fh / 2) * s);
        g.lineTo(-8 * s, 4 * s);
        g.lineTo(-5.5 * s, 4 * s);
        g.lineTo(-4.5 * s, (-fh / 2) * s);
        g.lineTo(-3.5 * s, (-fh + 28) * s);
        g.lineTo(-2 * s, (-fh + 8) * s);
        g.closePath();
        g.fill({ color: 0x7a5030, alpha: 0.5 });

        // Root flares
        const rootFlares = [[-8, 3, -14, 6], [8, 3, 14, 6], [-6, 4, -10, 8], [6, 4, 10, 8]];
        for (const [x1, y1, x2, y2] of rootFlares) {
          g.moveTo(x1 * s, y1 * s);
          g.quadraticCurveTo((x1 * 1.2) * s, (y2 - 1) * s, x2 * s, y2 * s);
          g.stroke({ width: s * 2.5, color: 0x4a2a10 });
        }

        // Moss patches
        const mossSpots = [[-3, -12], [2, -20], [-5, -30], [4, -38], [-2, -45]];
        for (const [mx, my] of mossSpots) {
          g.ellipse(mx * s, my * s, 2.5 * s, 1.5 * s);
          g.fill({ color: 0x2a5a18, alpha: 0.7 });
        }

        // Green hint at very top
        g.ellipse(0, (-fh + 4) * s, 6 * s, 3 * s);
        g.fill({ color: 0x3a7a20, alpha: 0.4 });
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
