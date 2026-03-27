import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint } from "../types";
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
      depth: facingCamera ? 57 : 23,
      draw: (g: Graphics, s: number) => {
        const hand = wrist;
        const angle = armAngle;
        const len = 18;
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);

        // Blade
        const tipX = hand.x + ca * len;
        const tipY = hand.y + sa * len;
        drawBlade(g, hand.x, hand.y + 1, tipX, tipY, 2, 0xd0d0e0, s);

        // Crossguard
        const cgX = hand.x + ca * 2;
        const cgY = hand.y + sa * 2;
        const cpx = -sa * 3.5;
        const cpy = ca * 3.5;
        g.moveTo((cgX - cpx) * s, (cgY - cpy) * s);
        g.lineTo((cgX + cpx) * s, (cgY + cpy) * s);
        g.stroke({ width: 2.5 * s, color: 0x886633 });
        // Guard ends
        g.circle((cgX - cpx) * s, (cgY - cpy) * s, 1 * s);
        g.circle((cgX + cpx) * s, (cgY + cpy) * s, 1 * s);
        g.fill(0xaa8844);

        // Grip
        g.moveTo(hand.x * s, hand.y * s);
        g.lineTo((hand.x - ca * 3) * s, (hand.y - sa * 3) * s);
        g.stroke({ width: 2 * s, color: 0x664422 });

        // Pommel
        g.circle((hand.x - ca * 3.5) * s, (hand.y - sa * 3.5) * s, 1.5 * s);
        g.fill(0xaa8844);
      }
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }
}
