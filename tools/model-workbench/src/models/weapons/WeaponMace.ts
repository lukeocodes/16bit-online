import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";

export class WeaponMace implements Model {
  readonly id = "weapon-mace";
  readonly name = "Iron Mace";
  readonly category = "weapon" as const;
  readonly slot = "hand-R" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera } = ctx;
    const side  = facingCamera ? ctx.nearSide : ctx.farSide;
    const wrist = skeleton.joints[`wrist${side}`];
    const elbow = skeleton.joints[`elbow${side}`];
    const angle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x);

    return [{
      depth: facingCamera ? DEPTH_NEAR_LIMB + 3 : DEPTH_FAR_LIMB + 3,
      draw: (g: Graphics, s: number) => {
        const sz  = ctx.slotParams.size;
        const ca  = Math.cos(angle), sa = Math.sin(angle);
        const len = 13 * sz;
        const topX = wrist.x + ca * len, topY = wrist.y + sa * len;

        g.moveTo(wrist.x * s, wrist.y * s);
        g.lineTo(topX * s, topY * s);
        g.stroke({ width: 2 * s, color: 0x886633 });

        // Mace head — round with flanges
        g.circle(topX * s, topY * s, 4 * sz * s); g.fill(0x888899);
        g.circle(topX * s, topY * s, 4 * sz * s); g.stroke({ width: s * 0.7, color: 0x444455 });

        for (let i = 0; i < 6; i++) {
          const fa = (i * Math.PI) / 3 + angle;
          g.moveTo(topX * s, topY * s);
          g.lineTo((topX + Math.cos(fa) * 4) * s, (topY + Math.sin(fa) * 4) * s);
        }
        g.stroke({ width: s * 1.5, color: 0x777788 });

        // Center boss + highlight
        g.circle(topX * s, topY * s, 1.5 * s); g.fill(0xaaaabc);
        g.circle((topX - sa * 1) * s, (topY + ca * 1) * s, 0.8 * s);
        g.fill({ color: 0xddddee, alpha: 0.5 });
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
