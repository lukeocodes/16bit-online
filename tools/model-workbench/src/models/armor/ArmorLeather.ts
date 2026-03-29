import type { Graphics } from "pixi.js";
import type {
  Model,
  RenderContext,
  DrawCall,
  Skeleton,
  AttachmentPoint,
} from "../types";
import { DEPTH_BODY } from "../types";

export class ArmorLeather implements Model {
  readonly id = "armor-leather";
  readonly name = "Leather Armor";
  readonly category = "armor" as const;
  readonly slot = "torso" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette } = ctx;
    const sz = ctx.slotParams.size;
    const { waistL, waistR, hipL, hipR, neckBase, shoulderL, shoulderR } = skeleton.joints;
    const wf = skeleton.wf;
    const cx = neckBase.x;

    return [
      {
        depth: DEPTH_BODY + 3,
        draw: (g: Graphics, s: number) => {
          // Stitching lines
          g.moveTo((cx - 2 * wf * sz) * s, (neckBase.y + 2 * sz) * s);
          g.lineTo((cx - 2 * wf * sz) * s, (hipL.y - 1 * sz) * s);
          g.moveTo((cx + 2 * wf * sz) * s, (neckBase.y + 2 * sz) * s);
          g.lineTo((cx + 2 * wf * sz) * s, (hipR.y - 1 * sz) * s);
          g.stroke({ width: s * 0.5, color: palette.accentDk, alpha: 0.5 });

          // Belt
          const beltY = waistL.y + 0.5 * sz;
          const beltH = 2.5 * sz;
          g.rect((waistL.x + 0.5 * sz) * s, (beltY - sz) * s, (waistR.x - waistL.x - sz) * s, beltH * s);
          g.fill(palette.accent);
          g.rect((waistL.x + 0.5 * sz) * s, (beltY - sz) * s, (waistR.x - waistL.x - sz) * s, beltH * s);
          g.stroke({ width: s * 0.4, color: palette.accentDk, alpha: 0.5 });

          // Buckle
          g.roundRect((cx - 1.5 * sz) * s, (beltY - 0.8 * sz) * s, 3 * sz * s, 2 * sz * s, 0.5 * s);
          g.fill(0xccaa44);
          g.roundRect((cx - 1.5 * sz) * s, (beltY - 0.8 * sz) * s, 3 * sz * s, 2 * sz * s, 0.5 * s);
          g.stroke({ width: s * 0.3, color: 0x886622 });

          // Shoulder straps
          g.moveTo(shoulderL.x * s, shoulderL.y * s);
          g.lineTo((cx - sz) * s, (neckBase.y + sz) * s);
          g.moveTo(shoulderR.x * s, shoulderR.y * s);
          g.lineTo((cx + sz) * s, (neckBase.y + sz) * s);
          g.stroke({ width: s * 1.2, color: palette.accent, alpha: 0.7 });
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }
}
