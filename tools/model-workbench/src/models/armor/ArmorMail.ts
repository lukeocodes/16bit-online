import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_BODY } from "../types";
import { darken, lighten } from "../palette";

/**
 * Chain Mail — horizontal ring pattern, mail skirt.
 * Mail is symmetric front/back; slightly darker overall from the back.
 * IN FRONT OF: torso at DEPTH_BODY + 3.
 */
export class ArmorMail implements Model {
  readonly id = "armor-mail";
  readonly name = "Chain Mail";
  readonly category = "armor" as const;
  readonly slot = "torso" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, facingCamera } = ctx;
    const sz = ctx.slotParams.size;
    const { waistL, waistR, hipL, hipR, chestL, chestR } = skeleton.joints;

    return [{
      depth: DEPTH_BODY + 3,
      draw: (g: Graphics, s: number) => {
        // Chain pattern rows
        for (let i = 0; i < 5; i++) {
          const ry = chestL.y + 1 * sz + i * 2.5 * sz;
          const t  = i / 5;
          const lx = chestL.x + (waistL.x - chestL.x) * t + 1.5 * sz;
          const rx = chestR.x + (waistR.x - chestR.x) * t - 1.5 * sz;
          g.moveTo(lx * s, ry * s); g.lineTo(rx * s, ry * s);
        }
        const rowAlpha = facingCamera ? 0.35 : 0.22; // slightly less visible from back
        g.stroke({ width: s * 0.4, color: palette.bodyLt, alpha: rowAlpha });

        // Mail skirt
        g.moveTo(waistL.x * s, waistL.y * s);
        g.lineTo((hipL.x - 1.5 * sz) * s, (hipL.y + 3 * sz) * s);
        g.lineTo((hipR.x + 1.5 * sz) * s, (hipR.y + 3 * sz) * s);
        g.lineTo(waistR.x * s, waistR.y * s);
        g.closePath();
        // Back view: skirt is slightly darker (we're seeing the back of the links)
        g.fill(facingCamera ? palette.body : darken(palette.body, 0.08));
        g.moveTo(waistL.x * s, waistL.y * s);
        g.lineTo((hipL.x - 1.5 * sz) * s, (hipL.y + 3 * sz) * s);
        g.lineTo((hipR.x + 1.5 * sz) * s, (hipR.y + 3 * sz) * s);
        g.lineTo(waistR.x * s, waistR.y * s);
        g.closePath(); g.stroke({ width: s * 0.5, color: palette.outline, alpha: 0.4 });

        // Hem rivets
        const hemY = hipL.y + 3 * sz;
        for (let i = 0; i < 6; i++) {
          const t  = i / 5;
          const hx = hipL.x - 1.5 * sz + (hipR.x + 1.5 * sz - (hipL.x - 1.5 * sz)) * t;
          g.circle(hx * s, (hemY + (i % 2) * sz) * s, 0.6 * sz * s);
        }
        g.fill(palette.bodyDk);
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
