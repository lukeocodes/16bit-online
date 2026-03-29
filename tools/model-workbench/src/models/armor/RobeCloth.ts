import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_BODY } from "../types";

/**
 * Cloth Robe — full-length garment.
 * Sits above the body layer. Hem stops at ankle so feet peek out.
 * Skirt swings with the walk cycle using skeleton.walkPhase.
 */
export class RobeCloth implements Model {
  readonly id = "robe-cloth";
  readonly name = "Cloth Robe (Full)";
  readonly category = "armor" as const;
  readonly slot = "torso" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette } = ctx;
    const { neckBase, shoulderL, shoulderR, chestL, chestR, waistL, waistR, hipL, hipR, ankleL, ankleR } = skeleton.joints;
    const wf = skeleton.wf;
    const sz = ctx.slotParams.size;

    // Hem stops just below ankles so feet peek out
    const hemY = ((ankleL.y + ankleR.y) / 2) + 1;
    const hemCx = (hipL.x + hipR.x) / 2;
    const hipHalfW = (Math.abs(hipR.x - hipL.x) / 2 + 3) * sz;
    const hemHalfW = (hipHalfW + 4 * sz);

    // Skirt swings with walk cycle
    const swing = Math.sin(skeleton.walkPhase * Math.PI * 2) * 0.6 * sz;

    return [
      {
        // Skirt — above body/legs so the robe covers them
        depth: DEPTH_BODY + 4,
        draw: (g: Graphics, s: number) => {
          // Main skirt silhouette — top matches hip joints so it joins the torso panel
          g.moveTo(hipL.x * s, hipL.y * s);
          g.quadraticCurveTo(
            (hemCx - hemHalfW - 1 + swing * 0.3) * s, ((hipL.y + hemY) / 2) * s,
            (hemCx - hemHalfW + swing) * s, hemY * s
          );
          g.lineTo((hemCx + hemHalfW + swing) * s, hemY * s);
          g.quadraticCurveTo(
            (hemCx + hemHalfW + 1 + swing * 0.3) * s, ((hipR.y + hemY) / 2) * s,
            hipR.x * s, hipR.y * s
          );
          g.closePath();
          g.fill(palette.body);

          // Hem edge
          g.moveTo((hemCx - hemHalfW + swing) * s, hemY * s);
          g.lineTo((hemCx + hemHalfW + swing) * s, hemY * s);
          g.stroke({ width: s * 1.0, color: palette.accent, alpha: 0.65 });

          // Drape fold lines — follow the swing
          for (const t of [0.25, 0.5, 0.75]) {
            const topX = hipL.x + (hipR.x - hipL.x) * t;
            const botX = hemCx - hemHalfW + hemHalfW * 2 * t + swing;
            g.moveTo(topX * s, hipL.y * s);
            g.quadraticCurveTo(
              ((topX + botX) / 2 + (t - 0.5) * 1.5) * s,
              ((hipL.y + hemY) / 2) * s,
              botX * s, hemY * s
            );
            g.stroke({ width: s * 0.4, color: palette.bodyDk, alpha: 0.2 });
          }
        },
      },
      {
        // Chest panel + collar + sash — above body
        depth: DEPTH_BODY + 5,
        draw: (g: Graphics, s: number) => {
          // Chest panel: from shoulders (curved neckline) down to hips
          g.moveTo((shoulderL.x - 0.5 * sz) * s, shoulderL.y * s);
          g.quadraticCurveTo(
            neckBase.x * s, (neckBase.y + 0.5) * s,
            (shoulderR.x + 0.5 * sz) * s, shoulderR.y * s
          );
          g.lineTo(hipR.x * s, hipR.y * s);
          g.lineTo(hipL.x * s, hipL.y * s);
          g.closePath();
          g.fill(palette.body);

          // Vertical centre seam
          const cx = neckBase.x;
          g.moveTo(cx * s, (neckBase.y + 1) * s);
          g.lineTo(cx * s, ((neckBase.y + hipL.y) / 2) * s);
          g.stroke({ width: s * 0.6, color: palette.bodyDk, alpha: 0.25 });

          // Collar
          g.ellipse(
            neckBase.x * s,
            (neckBase.y + 1) * s,
            3.5 * wf * sz * s,
            2.5 * sz * s
          );
          g.fill(palette.accent);
          g.ellipse(
            neckBase.x * s,
            (neckBase.y + 1) * s,
            3.5 * wf * sz * s,
            2.5 * sz * s
          );
          g.stroke({ width: s * 0.5, color: palette.accentDk, alpha: 0.5 });

          // Sash at waist
          g.moveTo(waistL.x * s, waistL.y * s);
          g.lineTo(waistR.x * s, waistR.y * s);
          g.stroke({ width: s * 2.0, color: palette.accent, alpha: 0.8 });

          // Belt knot
          const kx = (waistL.x + waistR.x) / 2;
          g.circle(kx * s, waistL.y * s, 1.5 * sz * s);
          g.fill(palette.accentDk);
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }
}
