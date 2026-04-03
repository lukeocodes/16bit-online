import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, FitmentCorners } from "../types";
import { DEPTH_BODY } from "../types";
import { darken } from "../palette";
import { quadPoint } from "../draw-helpers";

/**
 * Cloth Robe — full-length flowing robe, sash, animated hem sway.
 * DEPTH: DEPTH_BODY + 4 (= 94) — slightly above standard torso armor so
 *        robe drapes over chest panel.
 */
export class RobeCloth implements Model {
  readonly id = "robe-cloth";
  readonly name = "Cloth Robe";
  readonly category = "armor" as const;
  readonly slot = "torso" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, facingCamera, fitmentCorners } = ctx;
    const j         = skeleton.joints;
    const sz        = ctx.slotParams.size;
    const walkPhase = skeleton.walkPhase;
    const sway      = walkPhase !== 0 ? Math.sin(walkPhase * 0.8) : 0;

    const fc: FitmentCorners = fitmentCorners ?? {
      tl: { x: j.shoulderL.x, y: j.neckBase.y },
      tr: { x: j.shoulderR.x, y: j.neckBase.y },
      bl: { x: j.hipL.x,      y: j.hipL.y },
      br: { x: j.hipR.x,      y: j.hipR.y },
    };

    return [
      {
        // Robe skirt — below hips, animated sway
        depth: DEPTH_BODY + 4,
        draw: (g: Graphics, s: number) => {
          const hemY   = j.ankleL.y + 3 * sz;
          const hemW   = Math.abs(fc.tr.x - fc.tl.x) + 5 * sz;
          const hemCX  = (fc.bl.x + fc.br.x) / 2;

          g.moveTo(fc.bl.x * s, fc.bl.y * s);
          g.quadraticCurveTo(
            (hemCX - hemW / 2 - sz + sway) * s, (fc.bl.y + (hemY - fc.bl.y) * 0.5) * s,
            (hemCX - hemW * 0.3 + sway * 1.5) * s, hemY * s,
          );
          // Tattered hem
          for (let i = 0; i < 5; i++) {
            const t  = i / 4;
            const px = (hemCX - hemW * 0.3) + (hemW * 0.6) * t + sway * (1 - t);
            const py = hemY + Math.sin(t * 7 + (walkPhase || 0)) * 1.5;
            g.lineTo(px * s, py * s);
          }
          g.quadraticCurveTo(
            (hemCX + hemW / 2 + sz + sway) * s, (fc.br.y + (hemY - fc.br.y) * 0.5) * s,
            fc.br.x * s, fc.br.y * s,
          );
          g.closePath();
          g.fill(facingCamera ? palette.body : darken(palette.body, 0.07));

          // Center fold line
          g.moveTo((hemCX + sway * 0.3) * s, (fc.bl.y + 1) * s);
          g.lineTo((hemCX + sway * 0.5) * s, (hemY - 2) * s);
          g.stroke({ width: s * 0.5, color: palette.bodyDk, alpha: 0.25 });
        },
      },
      {
        // Chest panel + sash
        depth: DEPTH_BODY + 5,
        draw: (g: Graphics, s: number) => {
          const topL = quadPoint(fc, 0.08, 0.04);
          const topR = quadPoint(fc, 0.92, 0.04);
          const midL = quadPoint(fc, 0.06, 0.55);
          const midR = quadPoint(fc, 0.94, 0.55);

          // Front V or back straight neckline
          if (facingCamera) {
            // Chest panel
            g.moveTo(topL.x * s, topL.y * s);
            g.lineTo(midL.x * s, midL.y * s);
            g.lineTo(midR.x * s, midR.y * s);
            g.lineTo(topR.x * s, topR.y * s);
            g.closePath();
            g.fill({ color: palette.bodyLt, alpha: 0.08 });

            // V-neckline
            const vPt = quadPoint(fc, 0.5, 0.12);
            g.moveTo(topL.x * s, topL.y * s);
            g.lineTo(vPt.x * s, vPt.y * s);
            g.lineTo(topR.x * s, topR.y * s);
            g.stroke({ width: s * 0.7, color: palette.accent, alpha: 0.5 });
          } else {
            // Back yoke seam
            g.moveTo(topL.x * s, topL.y * s); g.lineTo(topR.x * s, topR.y * s);
            g.stroke({ width: s * 0.6, color: palette.bodyDk, alpha: 0.28 });
          }

          // Sash knot (front only)
          if (facingCamera) {
            const sash = quadPoint(fc, 0.5, 0.6);
            g.circle(sash.x * s, sash.y * s, 1.8 * sz * s);
            g.fill(palette.accent);
            g.circle(sash.x * s, sash.y * s, 1.8 * sz * s);
            g.stroke({ width: s * 0.4, color: palette.accentDk, alpha: 0.4 });
            // Sash ribbon left
            g.moveTo(sash.x * s, (sash.y + 1.8 * sz) * s);
            g.lineTo((sash.x - 2 * sz) * s, (sash.y + 4 * sz) * s);
            g.stroke({ width: s * 1.4, color: palette.accent, alpha: 0.5 });
            g.moveTo(sash.x * s, (sash.y + 1.8 * sz) * s);
            g.lineTo((sash.x + 2 * sz) * s, (sash.y + 4 * sz) * s);
            g.stroke({ width: s * 1.4, color: darken(palette.accent, 0.06), alpha: 0.5 });
          }
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
