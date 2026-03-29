import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";
import { drawBlade } from "../draw-helpers";

export class WeaponSword implements Model {
  readonly id = "weapon-sword";
  readonly name = "Iron Sword";
  readonly category = "weapon" as const;
  readonly slot = "hand-R" as const;

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
        const angle = armAngle + (facingCamera ? Math.PI / 2 : -Math.PI / 2);
        const len = 18 * sz;
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);

        // Blade
        const tipX = hand.x + ca * len;
        const tipY = hand.y + sa * len;
        drawBlade(g, hand.x, hand.y + 1, tipX, tipY, 2 * sz, 0xd0d0e0, s);

        // Crossguard
        const cgX = hand.x + ca * 2 * sz;
        const cgY = hand.y + sa * 2 * sz;
        const cpx = -sa * 3.5 * sz;
        const cpy = ca * 3.5 * sz;
        g.moveTo((cgX - cpx) * s, (cgY - cpy) * s);
        g.lineTo((cgX + cpx) * s, (cgY + cpy) * s);
        g.stroke({ width: 2.5 * s, color: 0x886633 });
        // Guard ends
        g.circle((cgX - cpx) * s, (cgY - cpy) * s, 1 * s);
        g.circle((cgX + cpx) * s, (cgY + cpy) * s, 1 * s);
        g.fill(0xaa8844);

        // Grip
        g.moveTo(hand.x * s, hand.y * s);
        g.lineTo((hand.x - ca * 3 * sz) * s, (hand.y - sa * 3 * sz) * s);
        g.stroke({ width: 2 * s, color: 0x664422 });

        // Pommel
        g.circle((hand.x - ca * 3.5 * sz) * s, (hand.y - sa * 3.5 * sz) * s, 1.5 * s);
        g.fill(0xaa8844);
      }
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }
}
