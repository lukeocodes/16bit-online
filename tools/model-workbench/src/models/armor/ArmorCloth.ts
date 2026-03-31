import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_BODY, DEPTH_COLLAR } from "../types";
import { darken } from "../palette";

/**
 * Cloth Armor — hem, sash, collar.
 * FACING AWARE: collar shows front when facing camera; fabric fold from back.
 */
export class ArmorCloth implements Model {
  readonly id = "armor-cloth";
  readonly name = "Cloth Armor";
  readonly category = "armor" as const;
  readonly slot = "torso" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, facingCamera } = ctx;
    const sz = ctx.slotParams.size;
    const { waistL, waistR, hipL, hipR, neckBase } = skeleton.joints;
    const wf = skeleton.wf;

    return [
      {
        depth: DEPTH_BODY + 3,
        draw: (g: Graphics, s: number) => {
          const hemW = Math.abs(hipR.x - hipL.x) + 5 * sz;
          const hemCx = (hipL.x + hipR.x) / 2;

          // Robe hem (same shape front/back — cloth is symmetric)
          g.moveTo(hipL.x * s, hipL.y * s);
          g.quadraticCurveTo((hemCx - hemW / 2 - sz) * s, (hipL.y + 5 * sz) * s, (hemCx - hemW * 0.3) * s, (hipL.y + 6 * sz) * s);
          g.lineTo((hemCx + hemW * 0.3) * s, (hipR.y + 6 * sz) * s);
          g.quadraticCurveTo((hemCx + hemW / 2 + sz) * s, (hipR.y + 5 * sz) * s, hipR.x * s, hipR.y * s);
          g.closePath();
          g.fill(facingCamera ? palette.body : darken(palette.body, 0.07));
          g.moveTo((hemCx - hemW * 0.3) * s, (hipL.y + 6 * sz) * s);
          g.lineTo((hemCx + hemW * 0.3) * s, (hipR.y + 6 * sz) * s);
          g.stroke({ width: s * 0.8, color: palette.accent, alpha: 0.6 });

          // Sash (visible both sides)
          g.moveTo(waistL.x * s, waistL.y * s); g.lineTo(waistR.x * s, waistR.y * s);
          g.stroke({ width: s * 1.5, color: palette.accent, alpha: facingCamera ? 0.7 : 0.55 });
        },
      },
      {
        depth: DEPTH_COLLAR,
        draw: (g: Graphics, s: number) => {
          if (facingCamera) {
            // Collar front
            g.ellipse(neckBase.x * s, (neckBase.y + 1 * sz) * s, 3.5 * wf * sz * s, 2.5 * sz * s);
            g.fill(palette.accent);
            g.ellipse(neckBase.x * s, (neckBase.y + 1 * sz) * s, 3.5 * wf * sz * s, 2.5 * sz * s);
            g.stroke({ width: s * 0.5, color: palette.accentDk, alpha: 0.5 });
          } else {
            // Back neckline fold — slightly smaller, seen from behind
            g.ellipse(neckBase.x * s, (neckBase.y + 1 * sz) * s, 3.8 * wf * sz * s, 2.2 * sz * s);
            g.fill(darken(palette.accent, 0.08));
            g.ellipse(neckBase.x * s, (neckBase.y + 1 * sz) * s, 3.8 * wf * sz * s, 2.2 * sz * s);
            g.stroke({ width: s * 0.4, color: palette.accentDk, alpha: 0.4 });
          }
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
