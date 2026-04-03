import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_E } from "../types";

/** Mushroom cluster — 2–3 mushrooms with spotted caps. */
export class MushroomCluster implements Model {
  readonly id = "mushroom-cluster";
  readonly name = "Mushroom Cluster";
  readonly category = "construction" as const;
  readonly slot = "root" as const;
  readonly isAnimated = false;

  getDrawCalls(_ctx: RenderContext): DrawCall[] {
    return [{
      depth: DEPTH_E + 4,
      draw: (g: Graphics, s: number) => {
        const mushrooms = [
          { x: -5, y: 2, stemH: 5, capRx: 5, capRy: 2.5, capColor: 0xcc4422 },
          { x: 1, y: 0, stemH: 7, capRx: 4, capRy: 2, capColor: 0x7a4a2a },
          { x: 6, y: 3, stemH: 4, capRx: 3.5, capRy: 1.8, capColor: 0xcc4422 },
        ];
        for (const m of mushrooms) {
          // Stem
          g.rect((m.x - 0.8) * s, (m.y - m.stemH) * s, 1.6 * s, m.stemH * s);
          g.fill(0xe0d8c0);
          // Cap
          g.ellipse(m.x * s, (m.y - m.stemH) * s, m.capRx * s, m.capRy * s);
          g.fill(m.capColor);
          // White spots
          const spots = [[-1.2, -0.4], [0.5, -0.5], [1.5, 0], [-0.3, 0.2]];
          for (const [sx, sy] of spots) {
            g.circle((m.x + sx * m.capRx * 0.5) * s, (m.y - m.stemH + sy * m.capRy * 0.6) * s, 0.7 * s);
            g.fill(0xffffff);
          }
          // Cap underside edge
          g.moveTo((m.x - m.capRx) * s, (m.y - m.stemH) * s);
          g.lineTo((m.x - m.capRx * 0.6) * s, (m.y - m.stemH + m.capRy * 0.7) * s);
          g.lineTo((m.x + m.capRx * 0.6) * s, (m.y - m.stemH + m.capRy * 0.7) * s);
          g.lineTo((m.x + m.capRx) * s, (m.y - m.stemH) * s);
          g.stroke({ width: s * 0.5, color: 0xd8d0b0 });
        }
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
