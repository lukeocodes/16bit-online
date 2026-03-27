import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { darken } from "../palette";

/**
 * Cloth Hood — covers the head and drapes over shoulders.
 * Rogue/ranger style, shadowed face opening.
 */
export class HoodCloth implements Model {
  readonly id = "hood-cloth";
  readonly name = "Cloth Hood";
  readonly category = "headgear" as const;
  readonly slot = "head-top" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, facingCamera } = ctx;
    const head = skeleton.joints.head;
    const wf = skeleton.wf;
    const iso = skeleton.iso;
    const r = 7 * (ctx.slotParams.size);

    return [
      {
        // Back drape (behind body)
        depth: 22,
        draw: (g: Graphics, s: number) => {
          if (!facingCamera) {
            const neckBase = skeleton.joints.neckBase;
            g.moveTo((head.x - (r + 1) * wf) * s, (head.y + 2) * s);
            g.quadraticCurveTo(
              (head.x - (r + 2) * wf) * s, (neckBase.y + 3) * s,
              (head.x - 3 * wf) * s, (neckBase.y + 8) * s
            );
            g.lineTo((head.x + 3 * wf) * s, (neckBase.y + 8) * s);
            g.quadraticCurveTo(
              (head.x + (r + 2) * wf) * s, (neckBase.y + 3) * s,
              (head.x + (r + 1) * wf) * s, (head.y + 2) * s
            );
            g.closePath();
            g.fill(palette.body);
          }
        },
      },
      {
        depth: 52,
        draw: (g: Graphics, s: number) => {
          // Hood dome
          g.ellipse(
            head.x * s,
            (head.y - 1) * s,
            (r + 2) * wf * s,
            (r + 1) * s
          );
          g.fill(palette.body);
          g.ellipse(
            head.x * s,
            (head.y - 1) * s,
            (r + 2) * wf * s,
            (r + 1) * s
          );
          g.stroke({ width: s * 0.5, color: palette.outline, alpha: 0.35 });

          // Point at top
          g.poly([
            (head.x - 1.5 * wf) * s, (head.y - r - 0.5) * s,
            head.x * s, (head.y - r - 3) * s,
            (head.x + 1.5 * wf) * s, (head.y - r - 0.5) * s,
          ]);
          g.fill(palette.body);

          // Face opening (dark shadow)
          if (facingCamera || Math.abs(iso.x) > 0.3) {
            const openX = head.x + iso.x * 1;
            g.ellipse(
              openX * s,
              (head.y + 1) * s,
              (r - 1.5) * wf * s,
              (r - 2) * s
            );
            g.fill({ color: 0x111122, alpha: 0.5 });
          }

          // Fold line
          g.moveTo((head.x - (r + 1) * wf) * s, (head.y + 2) * s);
          g.quadraticCurveTo(
            head.x * s, (head.y + 4) * s,
            (head.x + (r + 1) * wf) * s, (head.y + 2) * s
          );
          g.stroke({ width: s * 0.6, color: palette.bodyDk, alpha: 0.3 });
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
