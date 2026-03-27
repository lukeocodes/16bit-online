import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint } from "../types";

export class WeaponAxe implements Model {
  readonly id = "weapon-axe";
  readonly name = "Iron Axe";
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
        const len = 14;
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);
        const topX = hand.x + ca * len;
        const topY = hand.y + sa * len;

        // Handle
        g.moveTo(hand.x * s, hand.y * s);
        g.lineTo(topX * s, topY * s);
        g.stroke({ width: 2 * s, color: 0x886633 });

        // Axe head
        const px = -sa * 6;
        const py = ca * 6;
        g.moveTo((topX - ca * 3) * s, (topY - sa * 3) * s);
        g.quadraticCurveTo(
          (topX + px) * s,
          (topY + py) * s,
          (topX + ca * 2) * s,
          (topY + sa * 2) * s
        );
        g.closePath();
        g.fill(0xaab0c0);
        g.moveTo((topX - ca * 3) * s, (topY - sa * 3) * s);
        g.quadraticCurveTo(
          (topX + px) * s,
          (topY + py) * s,
          (topX + ca * 2) * s,
          (topY + sa * 2) * s
        );
        g.closePath();
        g.stroke({ width: s * 0.6, color: 0x555566 });

        // Edge highlight
        g.moveTo((topX - ca * 2 + px * 0.7) * s, (topY - sa * 2 + py * 0.7) * s);
        g.lineTo((topX + ca * 1 + px * 0.7) * s, (topY + sa * 1 + py * 0.7) * s);
        g.stroke({ width: s * 0.5, color: 0xd0d8e8, alpha: 0.6 });
      }
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }
}
