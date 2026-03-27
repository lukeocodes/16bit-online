import type { Graphics } from "pixi.js";
import type {
  Model,
  RenderContext,
  DrawCall,
  Skeleton,
  AttachmentPoint,
} from "../types";

export class ArmorMail implements Model {
  readonly id = "armor-mail";
  readonly name = "Chain Mail";
  readonly category = "armor" as const;
  readonly slot = "torso" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette } = ctx;
    const { waistL, waistR, hipL, hipR, chestL, chestR } = skeleton.joints;

    return [
      {
        depth: 33,
        draw: (g: Graphics, s: number) => {
          // Chain pattern — horizontal dashed lines
          for (let i = 0; i < 5; i++) {
            const ry = chestL.y + 1 + i * 2.5;
            const lerpT = i / 5;
            const lx =
              chestL.x + (waistL.x - chestL.x) * lerpT + 1.5;
            const rx =
              chestR.x + (waistR.x - chestR.x) * lerpT - 1.5;
            g.moveTo(lx * s, ry * s);
            g.lineTo(rx * s, ry * s);
          }
          g.stroke({ width: s * 0.4, color: palette.bodyLt, alpha: 0.35 });

          // Mail skirt below waist
          g.moveTo(waistL.x * s, waistL.y * s);
          g.lineTo((hipL.x - 1.5) * s, (hipL.y + 3) * s);
          g.lineTo((hipR.x + 1.5) * s, (hipR.y + 3) * s);
          g.lineTo(waistR.x * s, waistR.y * s);
          g.closePath();
          g.fill(palette.body);
          g.moveTo(waistL.x * s, waistL.y * s);
          g.lineTo((hipL.x - 1.5) * s, (hipL.y + 3) * s);
          g.lineTo((hipR.x + 1.5) * s, (hipR.y + 3) * s);
          g.lineTo(waistR.x * s, waistR.y * s);
          g.closePath();
          g.stroke({ width: s * 0.5, color: palette.outline, alpha: 0.4 });

          // Zigzag hem
          const hemY = hipL.y + 3;
          for (let i = 0; i < 6; i++) {
            const t = i / 5;
            const hx =
              hipL.x - 1.5 + (hipR.x + 1.5 - (hipL.x - 1.5)) * t;
            g.circle(hx * s, (hemY + (i % 2) * 1) * s, 0.6 * s);
          }
          g.fill(palette.bodyDk);
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }
}
