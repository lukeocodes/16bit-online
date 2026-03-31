import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";

export class WeaponThrowingKnife implements Model {
  readonly id = "weapon-throwing-knife";
  readonly name = "Throwing Knife";
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
        const px  = -sa, py = ca;

        const bladeLen = 8 * sz;
        const tipX = wrist.x + ca * bladeLen, tipY = wrist.y + sa * bladeLen;
        const bW   = 1.2 * sz;

        g.poly([(wrist.x + px * bW) * s, (wrist.y + py * bW) * s, tipX * s, tipY * s, (wrist.x - px * bW) * s, (wrist.y - py * bW) * s]);
        g.fill(0xd0d0e0);
        g.poly([(wrist.x + px * bW) * s, (wrist.y + py * bW) * s, tipX * s, tipY * s, (wrist.x - px * bW) * s, (wrist.y - py * bW) * s]);
        g.stroke({ width: s * 0.3, color: 0x808090, alpha: 0.5 });

        g.moveTo(wrist.x * s, wrist.y * s); g.lineTo(tipX * s, tipY * s);
        g.stroke({ width: s * 0.4, color: 0xe8e8f0, alpha: 0.5 });

        // Crossguard
        g.moveTo((wrist.x - ca * 0.5 + px * 1.5) * s, (wrist.y - sa * 0.5 + py * 1.5) * s);
        g.lineTo((wrist.x - ca * 0.5 - px * 1.5) * s, (wrist.y - sa * 0.5 - py * 1.5) * s);
        g.stroke({ width: s * 1.2, color: 0x888888 });

        const gripLen = 4 * sz;
        const gripEX  = wrist.x - ca * gripLen, gripEY = wrist.y - sa * gripLen;
        g.moveTo(wrist.x * s, wrist.y * s); g.lineTo(gripEX * s, gripEY * s);
        g.stroke({ width: s * 1.5, color: 0x4a3a2a });

        for (let i = 0; i < 3; i++) {
          const t  = (i + 0.5) / 3;
          const wx = wrist.x + (gripEX - wrist.x) * t, wy = wrist.y + (gripEY - wrist.y) * t;
          g.moveTo((wx + px * 1) * s, (wy + py * 1) * s); g.lineTo((wx - px * 1) * s, (wy - py * 1) * s);
          g.stroke({ width: s * 0.4, color: 0x3a2a1a, alpha: 0.4 });
        }

        g.circle(gripEX * s, gripEY * s, 1 * s); g.fill(0x888888);
        g.circle(gripEX * s, gripEY * s, 0.5 * s); g.fill(0x444444);
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
