import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";

export class WeaponWand implements Model {
  readonly id = "weapon-wand";
  readonly name = "Fire Wand";
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
        const len = 11 * sz;
        const tipX = wrist.x + ca * len, tipY = wrist.y + sa * len;

        // Shaft
        g.moveTo(wrist.x * s, wrist.y * s);
        g.lineTo(tipX * s, tipY * s);
        g.stroke({ width: 1.8 * s, color: 0x664422 });

        // Glowing tip
        g.circle(tipX * s, tipY * s, 2.5 * sz * s); g.fill({ color: 0xff6644, alpha: 0.85 });
        g.circle(tipX * s, tipY * s, 1.2 * sz * s); g.fill({ color: 0xffcc88, alpha: 0.7 });
        // Glow halo
        g.circle(tipX * s, tipY * s, 4 * sz * s); g.fill({ color: 0xff4422, alpha: 0.08 });

        g.rect((wrist.x - ca * 1 - 0.8) * s, (wrist.y - sa * 1 - 0.8) * s, 1.6 * s, 1.6 * s);
        g.fill(0x886633);
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
