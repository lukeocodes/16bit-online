import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, FitmentCorners } from "../types";
import { DEPTH_BODY } from "../types";
import { darken, lighten } from "../palette";
import { drawCornerQuad, quadPoint } from "../draw-helpers";

/**
 * Leather Armor — stitching, belt with buckle, shoulder straps.
 * DEPTH: DEPTH_BODY + 3 (= 93). Corner-based for all body types.
 */
export class ArmorLeather implements Model {
  readonly id = "armor-leather";
  readonly name = "Leather Armor";
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
        // Side stitching lines (both views)
        const stL_top = quadPoint(fc, 0.12, 0.05);
        const stL_bot = quadPoint(fc, 0.12, 0.92);
        const stR_top = quadPoint(fc, 0.88, 0.05);
        const stR_bot = quadPoint(fc, 0.88, 0.92);
        g.moveTo(stL_top.x * s, stL_top.y * s); g.lineTo(stL_bot.x * s, stL_bot.y * s);
        g.moveTo(stR_top.x * s, stR_top.y * s); g.lineTo(stR_bot.x * s, stR_bot.y * s);
        g.stroke({ width: s * 0.5, color: palette.accentDk, alpha: facingCamera ? 0.5 : 0.35 });

        if (facingCamera) {
          // ─── FRONT ──────────────────────────────────────────────────
          // Belt band (at 65% from top)
          const beltL = quadPoint(fc, 0.0, 0.65);
          const beltR = quadPoint(fc, 1.0, 0.65);
          g.moveTo(beltL.x * s, beltL.y * s); g.lineTo(beltR.x * s, beltR.y * s);
          g.stroke({ width: s * 2.8, color: palette.accent, alpha: 0.68 });

          // Belt outline
          g.moveTo(beltL.x * s, beltL.y * s); g.lineTo(beltR.x * s, beltR.y * s);
          g.stroke({ width: s * 0.35, color: palette.accentDk, alpha: 0.45 });

          // Buckle (centre of belt)
          const buckle = quadPoint(fc, 0.5, 0.65);
          g.roundRect((buckle.x - 1.5 * sz) * s, (buckle.y - 0.9 * sz) * s, 3 * sz * s, 1.8 * sz * s, 0.5 * s);
          g.fill(0xccaa44);
          g.roundRect((buckle.x - 1.5 * sz) * s, (buckle.y - 0.9 * sz) * s, 3 * sz * s, 1.8 * sz * s, 0.5 * s);
          g.stroke({ width: s * 0.3, color: 0x886622 });
          g.moveTo((buckle.x) * s, (buckle.y - 0.5 * sz) * s);
          g.lineTo((buckle.x) * s, (buckle.y + 0.5 * sz) * s);
          g.stroke({ width: s * 0.4, color: 0x886622 });

          // Shoulder straps
          const strap1 = quadPoint(fc, 0.5, 0.0);
          g.moveTo(fc.tl.x * s, fc.tl.y * s);
          g.quadraticCurveTo(strap1.x * s, (strap1.y + 1) * s, fc.tr.x * s, fc.tr.y * s);
          g.stroke({ width: s * 1.4, color: palette.accent, alpha: 0.65 });

        } else {
          // ─── BACK ───────────────────────────────────────────────────
          // Spine stitching line
          const spTop = quadPoint(fc, 0.5, 0.04);
          const spBot = quadPoint(fc, 0.5, 0.9);
          g.moveTo(spTop.x * s, spTop.y * s); g.lineTo(spBot.x * s, spBot.y * s);
          g.stroke({ width: s * 0.6, color: palette.accentDk, alpha: 0.35 });

          // Belt visible from back
          const bBL = quadPoint(fc, 0.0, 0.65);
          const bBR = quadPoint(fc, 1.0, 0.65);
          g.moveTo(bBL.x * s, bBL.y * s); g.lineTo(bBR.x * s, bBR.y * s);
          g.stroke({ width: s * 2.5, color: darken(palette.accent, 0.08), alpha: 0.55 });

          // Back strap ends
          g.moveTo(fc.tl.x * s, fc.tl.y * s);
          g.lineTo((fc.tl.x + 1) * s, (fc.tl.y + 2) * s);
          g.moveTo(fc.tr.x * s, fc.tr.y * s);
          g.lineTo((fc.tr.x - 1) * s, (fc.tr.y + 2) * s);
          g.stroke({ width: s * 1.1, color: darken(palette.accent, 0.1), alpha: 0.5 });
        }
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
