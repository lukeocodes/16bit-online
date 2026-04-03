import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_E } from "../types";

/** Tall grass patch — 8–10 blade groups with natural sway. */
export class GrassPatchLarge implements Model {
  readonly id = "grass-patch-large";
  readonly name = "Tall Grass";
  readonly category = "construction" as const;
  readonly slot = "root" as const;
  readonly isAnimated = false;

  getDrawCalls(_ctx: RenderContext): DrawCall[] {
    return [{
      depth: DEPTH_E + 2,
      draw: (g: Graphics, s: number) => {
        const bladeGroups = [
          { x: -10, y: 3 }, { x: -7, y: -1 }, { x: -4, y: 4 }, { x: -1, y: -3 },
          { x: 2, y: 2 }, { x: 5, y: -2 }, { x: 8, y: 3 }, { x: 11, y: 0 },
          { x: -9, y: 5 }, { x: 6, y: -4 },
        ];
        for (let i = 0; i < bladeGroups.length; i++) {
          const bp = bladeGroups[i];
          const sway = Math.sin(i * 2.1) * 1.5;
          for (let b = -1; b <= 1; b++) {
            const lean = sway + b * 2;
            const h = 7 + Math.abs(b) * 1.5;
            g.moveTo(bp.x * s, bp.y * s);
            g.lineTo((bp.x + lean) * s, (bp.y - h) * s);
            g.stroke({ width: s * 0.9, color: 0x4a8a2a });
            g.moveTo((bp.x + lean) * s, (bp.y - h) * s);
            g.lineTo((bp.x + lean * 1.3) * s, (bp.y - h - 2) * s);
            g.stroke({ width: s * 0.6, color: 0x7acc4a });
          }
        }
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
