import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_W } from "../types";

/** Massive boulder — fills most of a tile, multiple shading layers and lichen. */
export class RockBoulder implements Model {
  readonly id = "rock-boulder";
  readonly name = "Rock Boulder";
  readonly category = "construction" as const;
  readonly slot = "root" as const;
  readonly isAnimated = false;

  getDrawCalls(_ctx: RenderContext): DrawCall[] {
    return [{
      depth: DEPTH_W + 3,
      draw: (g: Graphics, s: number) => {
        // Cast shadow
        g.ellipse(2 * s, 8 * s, 16 * s, 6 * s);
        g.fill({ color: 0x000000, alpha: 0.25 });

        // Base polygon (20+ point organic shape)
        const pts: [number, number][] = [];
        const cx = 0, cy = -4;
        const rx = 13, ry = 10;
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * Math.PI * 2;
          const jitter = Math.sin(i * 1.7) * 1.5;
          pts.push([
            cx + Math.cos(a) * (rx + jitter),
            cy + Math.sin(a) * (ry + jitter * 0.6),
          ]);
        }
        g.moveTo(pts[0][0] * s, pts[0][1] * s);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] * s, pts[i][1] * s);
        g.closePath(); g.fill(0x888888);
        g.moveTo(pts[0][0] * s, pts[0][1] * s);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] * s, pts[i][1] * s);
        g.closePath(); g.stroke({ width: s * 0.7, color: 0x555555 });

        // Shadow wedge (far/lower-right)
        g.moveTo(5 * s, -4 * s); g.lineTo(13 * s, -1 * s); g.lineTo(10 * s, 5 * s);
        g.lineTo(2 * s, 6 * s); g.closePath();
        g.fill({ color: 0x444444, alpha: 0.5 });

        // Lit wedge (near/upper-left)
        g.moveTo(-13 * s, -4 * s); g.lineTo(-6 * s, -14 * s); g.lineTo(2 * s, -13 * s);
        g.lineTo(-4 * s, -5 * s); g.closePath();
        g.fill({ color: 0xcccccc, alpha: 0.45 });

        // Lichen patches
        const lichenSpots = [[-4, -8, 3, 2], [5, -10, 2.5, 1.5], [-8, -2, 2, 1.5], [3, -2, 3.5, 2]];
        for (const [lx, ly, lrx, lry] of lichenSpots) {
          g.ellipse(lx * s, ly * s, lrx * s, lry * s);
          g.fill({ color: 0x7a8a60, alpha: 0.6 });
        }
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
