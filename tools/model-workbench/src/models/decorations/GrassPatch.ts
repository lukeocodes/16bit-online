import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_E } from "../types";

/** Small grass patch — cluster of short blade groups, flat ground decoration. */
export class GrassPatch implements Model {
  readonly id = "grass-patch-small";
  readonly name = "Grass Patch";
  readonly category = "construction" as const;
  readonly slot = "root" as const;
  readonly isAnimated = false;

  getDrawCalls(_ctx: RenderContext): DrawCall[] {
    return [{
      depth: DEPTH_E + 2,
      draw: (g: Graphics, s: number) => {
        const bladeGroups = [
          { x: -8, y: 2 }, { x: -4, y: -2 }, { x: 0, y: 3 },
          { x: 4, y: -1 }, { x: 8, y: 2 }, { x: -6, y: 4 }, { x: 6, y: -3 },
        ];
        for (const bp of bladeGroups) {
          for (let b = -1; b <= 1; b++) {
            const lean = b * 1.8;
            const h = 4 + Math.abs(b) * 0.5;
            g.moveTo(bp.x * s, bp.y * s);
            g.lineTo((bp.x + lean) * s, (bp.y - h) * s);
            g.stroke({ width: s * 0.9, color: 0x4a8a2a });
            // lighter tip
            g.moveTo((bp.x + lean) * s, (bp.y - h) * s);
            g.lineTo((bp.x + lean * 1.2) * s, (bp.y - h - 1.5) * s);
            g.stroke({ width: s * 0.6, color: 0x7acc4a });
          }
        }
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
