import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";
import { drawBlade } from "../draw-helpers";

export class WeaponDagger implements Model {
  readonly id = "weapon-dagger";
  readonly name = "Iron Dagger";
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
        const len = 9 * sz;
        const tipX = wrist.x + ca * len, tipY = wrist.y + sa * len;

        drawBlade(g, wrist.x, wrist.y, tipX, tipY, 1.5 * sz, 0xd0d0e0, s);

        const cgX = wrist.x + ca * 1.5 * sz, cgY = wrist.y + sa * 1.5 * sz;
        const cpx = -sa * 2.5 * sz, cpy = ca * 2.5 * sz;
        g.moveTo((cgX - cpx) * s, (cgY - cpy) * s);
        g.lineTo((cgX + cpx) * s, (cgY + cpy) * s);
        g.stroke({ width: 2 * s, color: 0x886633 });

        g.moveTo(wrist.x * s, wrist.y * s);
        g.lineTo((wrist.x - ca * 2 * sz) * s, (wrist.y - sa * 2 * sz) * s);
        g.stroke({ width: 1.5 * s, color: 0x664422 });
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
