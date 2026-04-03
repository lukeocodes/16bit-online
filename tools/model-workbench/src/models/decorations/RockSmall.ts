import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_E } from "../types";

/** Small rock cluster — 2–3 low pebble shapes. */
export class RockSmall implements Model {
  readonly id = "rock-small";
  readonly name = "Small Rock";
  readonly category = "construction" as const;
  readonly slot = "root" as const;
  readonly isAnimated = false;

  getDrawCalls(_ctx: RenderContext): DrawCall[] {
    return [{
      depth: DEPTH_E + 3,
      draw: (g: Graphics, s: number) => {
        const rocks = [
          { x: -5, y: 1, rx: 4, ry: 2.5 },
          { x: 2, y: 0, rx: 3, ry: 2 },
          { x: 6, y: 2, rx: 2.5, ry: 1.8 },
        ];
        for (const r of rocks) {
          // Shadow
          g.ellipse(r.x * s, (r.y + 1.5) * s, (r.rx + 1) * s, (r.ry * 0.6) * s);
          g.fill({ color: 0x000000, alpha: 0.15 });
          // Body
          g.ellipse(r.x * s, r.y * s, r.rx * s, r.ry * s);
          g.fill(0x888888);
          // Highlight
          g.ellipse((r.x - r.rx * 0.3) * s, (r.y - r.ry * 0.3) * s, (r.rx * 0.4) * s, (r.ry * 0.35) * s);
          g.fill({ color: 0xaaaaaa, alpha: 0.6 });
          // Shadow side
          g.ellipse((r.x + r.rx * 0.3) * s, (r.y + r.ry * 0.3) * s, (r.rx * 0.4) * s, (r.ry * 0.35) * s);
          g.fill({ color: 0x555555, alpha: 0.5 });
        }
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
