import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";

export class WeaponSpear implements Model {
  readonly id = "weapon-spear";
  readonly name = "Iron Spear";
  readonly category = "weapon" as const;
  readonly slot = "hand-R" as const;
  readonly twoHanded = true;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera } = ctx;
    const side = ctx.nearSide;
    const wrist = skeleton.joints[`wrist${side}`];
    const elbow = skeleton.joints[`elbow${side}`];
    const armAngle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x);

    return [{
      depth: facingCamera ? DEPTH_NEAR_LIMB + 3 : DEPTH_FAR_LIMB + 3,
      draw: (g: Graphics, s: number) => {
        const sz = ctx.slotParams.size;
        const hand = wrist;
        const angle = armAngle;
        const len = 28 * sz;
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);
        const tipX = hand.x + ca * len;
        const tipY = hand.y + sa * len;

        // Shaft
        g.moveTo((hand.x - ca * 6 * sz) * s, (hand.y - sa * 6 * sz) * s);
        g.lineTo(tipX * s, tipY * s);
        g.stroke({ width: 1.8 * s, color: 0x886633 });

        // Spear head
        const px = -sa * 2.5 * sz;
        const py = ca * 2.5 * sz;
        g.poly([
          tipX * s, tipY * s,
          (tipX - ca * 6 * sz + px) * s, (tipY - sa * 6 * sz + py) * s,
          (tipX - ca * 6 * sz - px) * s, (tipY - sa * 6 * sz - py) * s,
        ]);
        g.fill(0xc0c0d0);
        g.poly([
          tipX * s, tipY * s,
          (tipX - ca * 6 * sz + px) * s, (tipY - sa * 6 * sz + py) * s,
          (tipX - ca * 6 * sz - px) * s, (tipY - sa * 6 * sz - py) * s,
        ]);
        g.stroke({ width: s * 0.5, color: 0x555566 });
        // Center line
        g.moveTo((tipX - ca * 6 * sz) * s, (tipY - sa * 6 * sz) * s);
        g.lineTo(tipX * s, tipY * s);
        g.stroke({ width: s * 0.4, color: 0xe0e0f0, alpha: 0.5 });
      }
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }
}
