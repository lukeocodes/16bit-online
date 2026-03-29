import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_BODY, DEPTH_COLLAR } from "../types";

export class ArmorCloth implements Model {
  readonly id = "armor-cloth";
  readonly name = "Cloth Armor";
  readonly category = "armor" as const;
  readonly slot = "torso" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette } = ctx;
    const sz = ctx.slotParams.size;
    const { waistL, waistR, hipL, hipR, neckBase } = skeleton.joints;
    const wf = skeleton.wf;

    return [
      {
        depth: DEPTH_BODY + 3,
        draw: (g: Graphics, s: number) => {
          // Robe hem extension below hips
          const hemW = Math.abs(hipR.x - hipL.x) + 5 * sz;
          const hemCx = (hipL.x + hipR.x) / 2;
          g.moveTo(hipL.x * s, hipL.y * s);
          g.quadraticCurveTo(
            (hemCx - hemW / 2 - sz) * s, (hipL.y + 5 * sz) * s,
            (hemCx - hemW * 0.3) * s, (hipL.y + 6 * sz) * s
          );
          g.lineTo((hemCx + hemW * 0.3) * s, (hipR.y + 6 * sz) * s);
          g.quadraticCurveTo(
            (hemCx + hemW / 2 + sz) * s, (hipR.y + 5 * sz) * s,
            hipR.x * s, hipR.y * s
          );
          g.closePath();
          g.fill(palette.body);
          g.moveTo((hemCx - hemW * 0.3) * s, (hipL.y + 6 * sz) * s);
          g.lineTo((hemCx + hemW * 0.3) * s, (hipR.y + 6 * sz) * s);
          g.stroke({ width: s * 0.8, color: palette.accent, alpha: 0.6 });

          // Sash
          g.moveTo(waistL.x * s, waistL.y * s);
          g.lineTo(waistR.x * s, waistR.y * s);
          g.stroke({ width: s * 1.5, color: palette.accent, alpha: 0.7 });
        },
      },
      {
        // Collar — behind face
        depth: DEPTH_COLLAR,
        draw: (g: Graphics, s: number) => {
          g.ellipse(neckBase.x * s, (neckBase.y + 1 * sz) * s, 3.5 * wf * sz * s, 2.5 * sz * s);
          g.fill(palette.accent);
          g.ellipse(neckBase.x * s, (neckBase.y + 1 * sz) * s, 3.5 * wf * sz * s, 2.5 * sz * s);
          g.stroke({ width: s * 0.5, color: palette.accentDk, alpha: 0.5 });
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
