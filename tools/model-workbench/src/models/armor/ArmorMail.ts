import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, FitmentCorners } from "../types";
import { DEPTH_BODY } from "../types";
import { darken, lighten } from "../palette";
import { drawCornerQuad, quadPoint } from "../draw-helpers";

/**
 * Chain Mail — horizontal ring-pattern torso + mail skirt.
 * DEPTH: DEPTH_BODY + 3 (= 93). Uses fitment corners to stretch to any body.
 */
export class ArmorMail implements Model {
  readonly id = "armor-mail";
  readonly name = "Chain Mail";
  readonly category = "armor" as const;
  readonly slot = "torso" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, facingCamera, fitmentCorners } = ctx;
    const j  = skeleton.joints;
    const sz = ctx.slotParams.size;

    const fc: FitmentCorners = fitmentCorners ?? {
      tl: { x: j.shoulderL.x, y: j.neckBase.y },
      tr: { x: j.shoulderR.x, y: j.neckBase.y },
      bl: { x: j.hipL.x,      y: j.hipL.y },
      br: { x: j.hipR.x,      y: j.hipR.y },
    };

    return [{
      depth: DEPTH_BODY + 3,
      draw: (g: Graphics, s: number) => {
        // Inset corners slightly
        const c: FitmentCorners = {
          tl: { x: fc.tl.x + 1 * sz, y: fc.tl.y + 0.5 * sz },
          tr: { x: fc.tr.x - 1 * sz, y: fc.tr.y + 0.5 * sz },
          bl: { x: fc.bl.x,          y: fc.bl.y },
          br: { x: fc.br.x,          y: fc.br.y },
        };

        // Mail is symmetric front/back — base fill same both sides
        const fillColor = facingCamera ? palette.body : darken(palette.body, 0.08);
        drawCornerQuad(g, c, 0, fillColor, palette.outline, 0.4, s);

        // Horizontal ring rows (5 rows across the torso)
        for (let i = 0; i < 6; i++) {
          const t   = 0.05 + i * 0.16;
          const rowL = quadPoint(c, 0.04, t);
          const rowR = quadPoint(c, 0.96, t);
          g.moveTo(rowL.x * s, rowL.y * s); g.lineTo(rowR.x * s, rowR.y * s);
        }
        g.stroke({ width: s * 0.4, color: palette.bodyLt, alpha: facingCamera ? 0.32 : 0.2 });

        // Mail skirt (extends below hip level)
        const skirtTL = quadPoint(c, 0.0, 1.0);
        const skirtTR = quadPoint(c, 1.0, 1.0);
        const hemL = { x: skirtTL.x - 1.5 * sz, y: skirtTL.y + 3 * sz };
        const hemR = { x: skirtTR.x + 1.5 * sz, y: skirtTR.y + 3 * sz };

        g.moveTo(skirtTL.x * s, skirtTL.y * s);
        g.lineTo(hemL.x * s, hemL.y * s);
        g.lineTo(hemR.x * s, hemR.y * s);
        g.lineTo(skirtTR.x * s, skirtTR.y * s);
        g.closePath();
        g.fill(facingCamera ? palette.body : darken(palette.body, 0.08));
        g.moveTo(skirtTL.x * s, skirtTL.y * s);
        g.lineTo(hemL.x * s, hemL.y * s);
        g.lineTo(hemR.x * s, hemR.y * s);
        g.lineTo(skirtTR.x * s, skirtTR.y * s);
        g.closePath();
        g.stroke({ width: s * 0.5, color: palette.outline, alpha: 0.4 });

        // Hem rivets
        for (let i = 0; i < 7; i++) {
          const t  = i / 6;
          const hx = hemL.x + (hemR.x - hemL.x) * t;
          const hy = hemL.y + (hemR.y - hemL.y) * t + (i % 2) * sz;
          g.circle(hx * s, hy * s, 0.6 * sz * s);
        }
        g.fill(palette.bodyDk);
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
