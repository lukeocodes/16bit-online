import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";

export class WeaponSpear implements Model {
  readonly id = "weapon-spear";
  readonly name = "Iron Spear";
  readonly category = "weapon" as const;
  readonly slot = "hand-R" as const;
  readonly twoHanded = true;

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
        const len = 28 * sz;
        const tipX = wrist.x + ca * len, tipY = wrist.y + sa * len;
        const butX = wrist.x - ca * 6 * sz, butY = wrist.y - sa * 6 * sz;

        g.moveTo(butX * s, butY * s); g.lineTo(tipX * s, tipY * s);
        g.stroke({ width: 1.8 * s, color: 0x886633 });

        const px = -sa * 2.5 * sz, py = ca * 2.5 * sz;
        g.poly([tipX * s, tipY * s, (tipX - ca * 6 * sz + px) * s, (tipY - sa * 6 * sz + py) * s, (tipX - ca * 6 * sz - px) * s, (tipY - sa * 6 * sz - py) * s]);
        g.fill(0xc0c0d0);
        g.poly([tipX * s, tipY * s, (tipX - ca * 6 * sz + px) * s, (tipY - sa * 6 * sz + py) * s, (tipX - ca * 6 * sz - px) * s, (tipY - sa * 6 * sz - py) * s]);
        g.stroke({ width: s * 0.5, color: 0x555566 });

        // Center highlight
        g.moveTo((tipX - ca * 6 * sz) * s, (tipY - sa * 6 * sz) * s);
        g.lineTo(tipX * s, tipY * s);
        g.stroke({ width: s * 0.4, color: 0xe0e0f0, alpha: 0.5 });

        // Butt cap
        g.circle(butX * s, butY * s, 1.2 * sz * s); g.fill(0x888899);
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
