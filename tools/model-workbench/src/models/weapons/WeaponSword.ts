import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";
import { drawBlade } from "../draw-helpers";

/**
 * Iron Sword — straight blade, crossguard, grip, pommel.
 *
 * HAND SELECTION: facingCamera → nearSide (right hand screen-right, in front)
 *                !facingCamera → farSide  (right hand screen-left after turning, behind)
 * DEPTH: NEAR_LIMB when in front, FAR_LIMB when behind body.
 * BLADE ANGLE: perpendicular to arm, flipped with facingCamera so it reads upward from either view.
 */
export class WeaponSword implements Model {
  readonly id = "weapon-sword";
  readonly name = "Iron Sword";
  readonly category = "weapon" as const;
  readonly slot = "hand-R" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera } = ctx;
    const side  = facingCamera ? ctx.nearSide : ctx.farSide;
    const wrist = skeleton.joints[`wrist${side}`];
    const elbow = skeleton.joints[`elbow${side}`];
    const armAngle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x);
    const angle    = armAngle + (facingCamera ? Math.PI / 2 : -Math.PI / 2);

    return [{
      depth: facingCamera ? DEPTH_NEAR_LIMB + 3 : DEPTH_FAR_LIMB + 3,
      draw: (g: Graphics, s: number) => {
        const sz  = ctx.slotParams.size;
        const ca  = Math.cos(angle);
        const sa  = Math.sin(angle);
        const len = 18 * sz;
        const tipX = wrist.x + ca * len;
        const tipY = wrist.y + sa * len;

        drawBlade(g, wrist.x, wrist.y + 1, tipX, tipY, 2 * sz, 0xd0d0e0, s);

        // Crossguard
        const cgX = wrist.x + ca * 2 * sz;
        const cgY = wrist.y + sa * 2 * sz;
        const cpx = -sa * 3.5 * sz, cpy = ca * 3.5 * sz;
        g.moveTo((cgX - cpx) * s, (cgY - cpy) * s);
        g.lineTo((cgX + cpx) * s, (cgY + cpy) * s);
        g.stroke({ width: 2.5 * s, color: 0x886633 });
        g.circle((cgX - cpx) * s, (cgY - cpy) * s, 1 * s);
        g.circle((cgX + cpx) * s, (cgY + cpy) * s, 1 * s);
        g.fill(0xaa8844);

        g.moveTo(wrist.x * s, wrist.y * s);
        g.lineTo((wrist.x - ca * 3 * sz) * s, (wrist.y - sa * 3 * sz) * s);
        g.stroke({ width: 2 * s, color: 0x664422 });

        g.circle((wrist.x - ca * 3.5 * sz) * s, (wrist.y - sa * 3.5 * sz) * s, 1.5 * s);
        g.fill(0xaa8844);
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
