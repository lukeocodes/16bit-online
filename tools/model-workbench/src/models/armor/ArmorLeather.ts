import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_BODY } from "../types";
import { darken, lighten } from "../palette";

/**
 * Leather Armor — stitching, belt, shoulder straps.
 * FACING AWARE: front shows shoulder straps + buckle; back shows spine stitching.
 */
export class ArmorLeather implements Model {
  readonly id = "armor-leather";
  readonly name = "Leather Armor";
  readonly category = "armor" as const;
  readonly slot = "torso" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, facingCamera } = ctx;
    const sz = ctx.slotParams.size;
    const { waistL, waistR, hipL, hipR, neckBase, shoulderL, shoulderR } = skeleton.joints;
    const wf = skeleton.wf, cx = neckBase.x;

    return [{
      depth: DEPTH_BODY + 3,
      draw: (g: Graphics, s: number) => {
        // Stitching lines (both views — visible on front and back)
        g.moveTo((cx - 2 * wf * sz) * s, (neckBase.y + 2 * sz) * s);
        g.lineTo((cx - 2 * wf * sz) * s, (hipL.y - 1 * sz) * s);
        g.moveTo((cx + 2 * wf * sz) * s, (neckBase.y + 2 * sz) * s);
        g.lineTo((cx + 2 * wf * sz) * s, (hipL.y - 1 * sz) * s);
        g.stroke({ width: s * 0.5, color: palette.accentDk, alpha: facingCamera ? 0.5 : 0.35 });

        if (facingCamera) {
          // Belt + buckle (front)
          const beltY = waistL.y + 0.5 * sz;
          g.rect((waistL.x + 0.5 * sz) * s, (beltY - sz) * s, (waistR.x - waistL.x - sz) * s, 2.5 * sz * s);
          g.fill(palette.accent);
          g.rect((waistL.x + 0.5 * sz) * s, (beltY - sz) * s, (waistR.x - waistL.x - sz) * s, 2.5 * sz * s);
          g.stroke({ width: s * 0.4, color: palette.accentDk, alpha: 0.5 });
          g.roundRect((cx - 1.5 * sz) * s, (beltY - 0.8 * sz) * s, 3 * sz * s, 2 * sz * s, 0.5 * s);
          g.fill(0xccaa44);
          g.roundRect((cx - 1.5 * sz) * s, (beltY - 0.8 * sz) * s, 3 * sz * s, 2 * sz * s, 0.5 * s);
          g.stroke({ width: s * 0.3, color: 0x886622 });
          // Shoulder straps
          g.moveTo(shoulderL.x * s, shoulderL.y * s); g.lineTo((cx - sz) * s, (neckBase.y + sz) * s);
          g.moveTo(shoulderR.x * s, shoulderR.y * s); g.lineTo((cx + sz) * s, (neckBase.y + sz) * s);
          g.stroke({ width: s * 1.2, color: palette.accent, alpha: 0.7 });
        } else {
          // Back — spine stitching down center
          g.moveTo(cx * s, (neckBase.y + 1 * sz) * s);
          g.lineTo(cx * s, (hipL.y - 2 * sz) * s);
          g.stroke({ width: s * 0.6, color: palette.accentDk, alpha: 0.35 });
          // Belt visible from back
          const beltY = waistL.y + 0.5 * sz;
          g.moveTo((waistL.x + 0.5 * sz) * s, (beltY) * s);
          g.lineTo((waistR.x - 0.5 * sz) * s, beltY * s);
          g.stroke({ width: s * 1.8, color: darken(palette.accent, 0.08), alpha: 0.55 });
          // Back shoulder strap ends
          g.moveTo(shoulderL.x * s, (shoulderL.y + 1) * s); g.lineTo((cx - sz) * s, (neckBase.y + sz + 1) * s);
          g.moveTo(shoulderR.x * s, (shoulderR.y + 1) * s); g.lineTo((cx + sz) * s, (neckBase.y + sz + 1) * s);
          g.stroke({ width: s * 1.0, color: darken(palette.accent, 0.1), alpha: 0.5 });
        }
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
