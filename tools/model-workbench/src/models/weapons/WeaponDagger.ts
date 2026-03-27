import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint } from "../types";
import { drawBlade } from "../draw-helpers";

export class WeaponDagger implements Model {
  readonly id = "weapon-dagger";
  readonly name = "Iron Dagger";
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
        const len = 9;
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);
        const tipX = hand.x + ca * len;
        const tipY = hand.y + sa * len;

        drawBlade(g, hand.x, hand.y, tipX, tipY, 1.5, 0xd0d0e0, s);

        // Crossguard
        const cgX = hand.x + ca * 1.5;
        const cgY = hand.y + sa * 1.5;
        const cpx = -sa * 2.5;
        const cpy = ca * 2.5;
        g.moveTo((cgX - cpx) * s, (cgY - cpy) * s);
        g.lineTo((cgX + cpx) * s, (cgY + cpy) * s);
        g.stroke({ width: 2 * s, color: 0x886633 });

        // Grip
        g.moveTo(hand.x * s, hand.y * s);
        g.lineTo((hand.x - ca * 2) * s, (hand.y - sa * 2) * s);
        g.stroke({ width: 1.5 * s, color: 0x664422 });
      }
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }
}
