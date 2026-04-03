import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, FitmentCorners } from "../types";
import { DEPTH_BODY, DEPTH_COLLAR } from "../types";
import { darken } from "../palette";
import { quadPoint } from "../draw-helpers";

/**
 * Cloth Armor — flowing hem, sash at waist, collar.
 * DEPTH: DEPTH_BODY + 3 (= 93).
 */
export class ArmorCloth implements Model {
  readonly id = "armor-cloth";
  readonly name = "Cloth Armor";
  readonly category = "armor" as const;
  readonly slot = "torso" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, facingCamera, fitmentCorners } = ctx;
    const j  = skeleton.joints;
    const sz = ctx.slotParams.size;
    const wf = skeleton.wf;

    const fc: FitmentCorners = fitmentCorners ?? {
      tl: { x: j.shoulderL.x, y: j.neckBase.y },
      tr: { x: j.shoulderR.x, y: j.neckBase.y },
      bl: { x: j.hipL.x,      y: j.hipL.y },
      br: { x: j.hipR.x,      y: j.hipR.y },
    };

    return [
      {
        depth: DEPTH_BODY + 3,
        draw: (g: Graphics, s: number) => {
          const hemExt = 6 * sz; // hem extends below hips
          const hemWExt = 3 * sz; // hem wider than hips

          const blExt = { x: fc.bl.x - hemWExt, y: fc.bl.y + hemExt };
          const brExt = { x: fc.br.x + hemWExt, y: fc.br.y + hemExt };

          // Flowing hem
          g.moveTo(fc.bl.x * s, fc.bl.y * s);
          g.quadraticCurveTo(blExt.x * s, (blExt.y - hemExt * 0.4) * s, blExt.x * s, blExt.y * s);
          g.lineTo(brExt.x * s, brExt.y * s);
          g.quadraticCurveTo(brExt.x * s, (brExt.y - hemExt * 0.4) * s, fc.br.x * s, fc.br.y * s);
          g.closePath();
          g.fill(facingCamera ? palette.body : darken(palette.body, 0.07));

          // Hem trim
          g.moveTo(blExt.x * s, blExt.y * s); g.lineTo(brExt.x * s, brExt.y * s);
          g.stroke({ width: s * 0.8, color: palette.accent, alpha: 0.6 });

          // Sash (at 65% from top)
          const sashL = quadPoint(fc, 0.0, 0.65);
          const sashR = quadPoint(fc, 1.0, 0.65);
          g.moveTo(sashL.x * s, sashL.y * s); g.lineTo(sashR.x * s, sashR.y * s);
          g.stroke({ width: s * 1.5, color: palette.accent, alpha: facingCamera ? 0.7 : 0.55 });
        },
      },
      {
        depth: DEPTH_COLLAR,
        draw: (g: Graphics, s: number) => {
          const nB = j.neckBase;
          if (facingCamera) {
            g.ellipse(nB.x * s, (nB.y + 1 * sz) * s, 3.5 * wf * sz * s, 2.5 * sz * s);
            g.fill(palette.accent);
            g.ellipse(nB.x * s, (nB.y + 1 * sz) * s, 3.5 * wf * sz * s, 2.5 * sz * s);
            g.stroke({ width: s * 0.5, color: palette.accentDk, alpha: 0.5 });
          } else {
            g.ellipse(nB.x * s, (nB.y + 1 * sz) * s, 3.8 * wf * sz * s, 2.2 * sz * s);
            g.fill(darken(palette.accent, 0.08));
            g.ellipse(nB.x * s, (nB.y + 1 * sz) * s, 3.8 * wf * sz * s, 2.2 * sz * s);
            g.stroke({ width: s * 0.4, color: palette.accentDk, alpha: 0.4 });
          }
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
