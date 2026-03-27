import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { darken } from "../palette";

/**
 * Leather Cap — simple adventurer's cap with earflaps.
 */
export class CapLeather implements Model {
  readonly id = "cap-leather";
  readonly name = "Leather Cap";
  readonly category = "headgear" as const;
  readonly slot = "head-top" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, facingCamera } = ctx;
    const head = skeleton.joints.head;
    const wf = skeleton.wf;
    const iso = skeleton.iso;
    const sideView = Math.abs(iso.x) > 0.3;
    const r = 7;

    return [
      {
        depth: 52,
        draw: (g: Graphics, s: number) => {
          // Cap dome (rounded top)
          g.ellipse(
            head.x * s,
            (head.y - 2) * s,
            (r + 0.5) * wf * s,
            (r - 1.5) * s
          );
          g.fill(palette.body);
          g.ellipse(
            head.x * s,
            (head.y - 2) * s,
            (r + 0.5) * wf * s,
            (r - 1.5) * s
          );
          g.stroke({ width: s * 0.5, color: palette.outline, alpha: 0.4 });

          // Brim band
          g.moveTo((head.x - (r + 0.5) * wf) * s, (head.y - 1) * s);
          g.lineTo((head.x + (r + 0.5) * wf) * s, (head.y - 1) * s);
          g.stroke({ width: s * 1.5, color: palette.accent });

          // Earflaps (visible from side)
          if (sideView) {
            const flapSide = iso.x > 0 ? 1 : -1;
            const flapX = head.x + flapSide * (r - 0.5) * wf;
            g.roundRect(
              (flapX - 2) * s,
              (head.y - 0.5) * s,
              4 * s,
              5 * s,
              1 * s
            );
            g.fill(palette.body);
            g.roundRect(
              (flapX - 2) * s,
              (head.y - 0.5) * s,
              4 * s,
              5 * s,
              1 * s
            );
            g.stroke({ width: s * 0.4, color: palette.outline, alpha: 0.3 });
          } else if (facingCamera) {
            // Both flaps visible from front
            for (const side of [-1, 1]) {
              const flapX = head.x + side * (r - 1) * wf;
              g.roundRect(
                (flapX - 1.5) * s,
                (head.y + 0.5) * s,
                3 * s,
                4 * s,
                1 * s
              );
              g.fill(palette.body);
              g.roundRect(
                (flapX - 1.5) * s,
                (head.y + 0.5) * s,
                3 * s,
                4 * s,
                1 * s
              );
              g.stroke({ width: s * 0.3, color: palette.outline, alpha: 0.25 });
            }
          }

          // Button on top
          g.circle(head.x * s, (head.y - r + 1) * s, 1 * s);
          g.fill(palette.accent);
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
