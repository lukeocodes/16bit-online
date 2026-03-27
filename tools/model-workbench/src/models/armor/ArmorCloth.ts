import type { Graphics } from "pixi.js";
import type {
  Model,
  RenderContext,
  DrawCall,
  Skeleton,
  AttachmentPoint,
} from "../types";

export class ArmorCloth implements Model {
  readonly id = "armor-cloth";
  readonly name = "Cloth Robe";
  readonly category = "armor" as const;
  readonly slot = "torso" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette } = ctx;
    const { waistL, waistR, hipL, hipR, neckBase } = skeleton.joints;
    const wf = skeleton.wf;

    return [
      {
        depth: 33,
        draw: (g: Graphics, s: number) => {
          // Collar / neckline
          g.ellipse(
            neckBase.x * s,
            (neckBase.y + 1) * s,
            3.5 * wf * s,
            2.5 * s
          );
          g.fill(palette.accent);
          g.ellipse(
            neckBase.x * s,
            (neckBase.y + 1) * s,
            3.5 * wf * s,
            2.5 * s
          );
          g.stroke({ width: s * 0.5, color: palette.accentDk, alpha: 0.5 });

          // Robe hem extension below hips
          const hemW = Math.abs(hipR.x - hipL.x) + 5;
          const hemCx = (hipL.x + hipR.x) / 2;
          g.moveTo(hipL.x * s, hipL.y * s);
          g.quadraticCurveTo(
            (hemCx - hemW / 2 - 1) * s,
            (hipL.y + 5) * s,
            (hemCx - hemW * 0.3) * s,
            (hipL.y + 6) * s
          );
          g.lineTo((hemCx + hemW * 0.3) * s, (hipR.y + 6) * s);
          g.quadraticCurveTo(
            (hemCx + hemW / 2 + 1) * s,
            (hipR.y + 5) * s,
            hipR.x * s,
            hipR.y * s
          );
          g.closePath();
          g.fill(palette.body);
          // Hem edge
          g.moveTo((hemCx - hemW * 0.3) * s, (hipL.y + 6) * s);
          g.lineTo((hemCx + hemW * 0.3) * s, (hipR.y + 6) * s);
          g.stroke({ width: s * 0.8, color: palette.accent, alpha: 0.6 });

          // Sash
          g.moveTo(waistL.x * s, waistL.y * s);
          g.lineTo(waistR.x * s, waistR.y * s);
          g.stroke({ width: s * 1.5, color: palette.accent, alpha: 0.7 });
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }
}
