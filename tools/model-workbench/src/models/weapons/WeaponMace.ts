import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";

export class WeaponMace implements Model {
  readonly id = "weapon-mace";
  readonly name = "Iron Mace";
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
        const angle = armAngle;
        const len = 13 * sz;
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);
        const topX = hand.x + ca * len;
        const topY = hand.y + sa * len;

        // Handle
        g.moveTo(hand.x * s, hand.y * s);
        g.lineTo(topX * s, topY * s);
        g.stroke({ width: 2 * s, color: 0x886633 });

        // Mace head
        g.circle(topX * s, topY * s, 4 * sz * s);
        g.fill(0x888899);
        g.circle(topX * s, topY * s, 4 * sz * s);
        g.stroke({ width: s * 0.7, color: 0x444455 });

        // Flanges
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3 + angle;
          const fx = topX + Math.cos(a) * 4;
          const fy = topY + Math.sin(a) * 4;
          g.moveTo(topX * s, topY * s);
          g.lineTo(fx * s, fy * s);
        }
        g.stroke({ width: s * 1.5, color: 0x777788 });

        // Center boss
        g.circle(topX * s, topY * s, 1.5 * s);
        g.fill(0xaaaabc);
      }
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }
}
