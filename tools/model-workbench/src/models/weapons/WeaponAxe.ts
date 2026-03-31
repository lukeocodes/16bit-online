import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";

export class WeaponAxe implements Model {
  readonly id = "weapon-axe";
  readonly name = "Iron Axe";
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
        const len = 14 * sz;
        const topX = wrist.x + ca * len, topY = wrist.y + sa * len;

        g.moveTo(wrist.x * s, wrist.y * s);
        g.lineTo(topX * s, topY * s);
        g.stroke({ width: 2 * s, color: 0x886633 });

        // Axe head — perpendicular side flips naturally with arm direction
        const px = -sa * 6 * sz, py = ca * 6 * sz;
        g.moveTo((topX - ca * 3) * s, (topY - sa * 3) * s);
        g.quadraticCurveTo((topX + px) * s, (topY + py) * s, (topX + ca * 2) * s, (topY + sa * 2) * s);
        g.closePath(); g.fill(0xaab0c0);
        g.moveTo((topX - ca * 3) * s, (topY - sa * 3) * s);
        g.quadraticCurveTo((topX + px) * s, (topY + py) * s, (topX + ca * 2) * s, (topY + sa * 2) * s);
        g.closePath(); g.stroke({ width: s * 0.6, color: 0x555566 });

        // Edge highlight
        g.moveTo((topX - ca * 2 + px * 0.7) * s, (topY - sa * 2 + py * 0.7) * s);
        g.lineTo((topX + ca * 1 + px * 0.7) * s, (topY + sa * 1 + py * 0.7) * s);
        g.stroke({ width: s * 0.5, color: 0xd0d8e8, alpha: 0.6 });

        // Back spike (counter-weight)
        g.moveTo(topX * s, topY * s);
        g.lineTo((topX - px * 0.4 + ca * 1.5) * s, (topY - py * 0.4 + sa * 1.5) * s);
        g.stroke({ width: s * 0.8, color: 0x999aaa });
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
