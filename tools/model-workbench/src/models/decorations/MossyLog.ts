import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_N } from "../types";

/** Fallen mossy log — horizontal cylinder with wood grain and moss on top. */
export class MossyLog implements Model {
  readonly id = "mossy-log";
  readonly name = "Mossy Log";
  readonly category = "construction" as const;
  readonly slot = "root" as const;
  readonly isAnimated = false;

  getDrawCalls(_ctx: RenderContext): DrawCall[] {
    return [{
      depth: DEPTH_N + 2,
      draw: (g: Graphics, s: number) => {
        // Shadow
        g.ellipse(0, 4 * s, 13 * s, 3 * s);
        g.fill({ color: 0x000000, alpha: 0.15 });

        // Back face ellipse
        g.ellipse(-10 * s, 0, 2.5 * s, 3.5 * s);
        g.fill(0x4a2a10);

        // Log body rectangle
        g.rect(-10 * s, -3.5 * s, 20 * s, 7 * s);
        g.fill(0x6a4020);

        // Wood grain lines
        g.moveTo(-8 * s, -2 * s); g.lineTo(8 * s, -2 * s);
        g.stroke({ width: s * 0.6, color: 0x4a2a10, alpha: 0.7 });
        g.moveTo(-8 * s, 0); g.lineTo(8 * s, 0);
        g.stroke({ width: s * 0.5, color: 0x4a2a10, alpha: 0.5 });
        g.moveTo(-8 * s, 2 * s); g.lineTo(8 * s, 2 * s);
        g.stroke({ width: s * 0.4, color: 0x8a5a30, alpha: 0.4 });

        // Front face ellipse
        g.ellipse(10 * s, 0, 2.5 * s, 3.5 * s);
        g.fill(0x7a4a28);
        g.ellipse(10 * s, 0, 2.5 * s, 3.5 * s);
        g.stroke({ width: s * 0.5, color: 0x4a2a10 });

        // Moss on top
        g.moveTo(-8 * s, -3.5 * s);
        g.quadraticCurveTo(-2 * s, -6.5 * s, 4 * s, -4 * s);
        g.quadraticCurveTo(7 * s, -3 * s, 8 * s, -3.5 * s);
        g.lineTo(-8 * s, -3.5 * s);
        g.closePath();
        g.fill({ color: 0x3a7020, alpha: 0.85 });
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
