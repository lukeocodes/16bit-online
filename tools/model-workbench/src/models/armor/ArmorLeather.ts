import type { Graphics } from "pixi.js";
import type {
  Model,
  RenderContext,
  DrawCall,
  Skeleton,
  AttachmentPoint,
} from "../types";

export class ArmorLeather implements Model {
  readonly id = "armor-leather";
  readonly name = "Leather Armor";
  readonly category = "armor" as const;
  readonly slot = "torso" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette } = ctx;
    const { waistL, waistR, hipL, hipR, neckBase, shoulderL, shoulderR } =
      skeleton.joints;
    const wf = skeleton.wf;
    const cx = neckBase.x;

    return [
      {
        depth: 33,
        draw: (g: Graphics, s: number) => {
          // Stitching lines down the front
          g.moveTo((cx - 2 * wf) * s, (neckBase.y + 2) * s);
          g.lineTo((cx - 2 * wf) * s, (hipL.y - 1) * s);
          g.moveTo((cx + 2 * wf) * s, (neckBase.y + 2) * s);
          g.lineTo((cx + 2 * wf) * s, (hipR.y - 1) * s);
          g.stroke({ width: s * 0.5, color: palette.accentDk, alpha: 0.5 });

          // Belt with buckle
          const beltY = waistL.y + 0.5;
          g.rect(
            (waistL.x + 0.5) * s,
            (beltY - 1) * s,
            (waistR.x - waistL.x - 1) * s,
            2.5 * s
          );
          g.fill(palette.accent);
          g.rect(
            (waistL.x + 0.5) * s,
            (beltY - 1) * s,
            (waistR.x - waistL.x - 1) * s,
            2.5 * s
          );
          g.stroke({ width: s * 0.4, color: palette.accentDk, alpha: 0.5 });
          // Buckle
          g.roundRect(
            (cx - 1.5) * s,
            (beltY - 0.8) * s,
            3 * s,
            2 * s,
            0.5 * s
          );
          g.fill(0xccaa44);
          g.roundRect(
            (cx - 1.5) * s,
            (beltY - 0.8) * s,
            3 * s,
            2 * s,
            0.5 * s
          );
          g.stroke({ width: s * 0.3, color: 0x886622 });

          // Shoulder straps
          g.moveTo(shoulderL.x * s, shoulderL.y * s);
          g.lineTo((cx - 1) * s, (neckBase.y + 1) * s);
          g.moveTo(shoulderR.x * s, shoulderR.y * s);
          g.lineTo((cx + 1) * s, (neckBase.y + 1) * s);
          g.stroke({ width: s * 1.2, color: palette.accent, alpha: 0.7 });
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }
}
