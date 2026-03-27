import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint } from "../types";

export class WeaponWand implements Model {
  readonly id = "weapon-wand";
  readonly name = "Fire Wand";
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
        const len = 11;
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);
        const tipX = hand.x + ca * len;
        const tipY = hand.y + sa * len;

        // Shaft
        g.moveTo(hand.x * s, hand.y * s);
        g.lineTo(tipX * s, tipY * s);
        g.stroke({ width: 1.8 * s, color: 0x664422 });

        // Glowing tip
        g.circle(tipX * s, tipY * s, 2.5 * s);
        g.fill({ color: 0xff6644, alpha: 0.85 });
        g.circle(tipX * s, tipY * s, 1.2 * s);
        g.fill({ color: 0xffcc88, alpha: 0.7 });

        // Grip
        g.rect((hand.x - ca * 1 - 0.8) * s, (hand.y - sa * 1 - 0.8) * s, 1.6 * s, 1.6 * s);
        g.fill(0x886633);
      }
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }
}
