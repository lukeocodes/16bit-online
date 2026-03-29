import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";

export class WeaponBow implements Model {
  readonly id = "weapon-bow";
  readonly name = "Hunting Bow";
  readonly category = "weapon" as const;
  readonly slot = "hand-R" as const;
  readonly twoHanded = true;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera } = ctx;
    const side = ctx.nearSide;
    const wrist = skeleton.joints[`wrist${side}`];
    const elbow = skeleton.joints[`elbow${side}`];
    const armAngle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x);
    // Bow limbs run perpendicular to the forearm
    const perpAngle = armAngle + (facingCamera ? Math.PI / 2 : -Math.PI / 2);

    return [{
      depth: facingCamera ? DEPTH_NEAR_LIMB + 3 : DEPTH_FAR_LIMB + 3,
      draw: (g: Graphics, s: number) => {
        const sz = ctx.slotParams.size;
        const hand = wrist;
        const bowH = 16 * sz;
        const ca = Math.cos(perpAngle);   // along bow limbs
        const sa = Math.sin(perpAngle);
        const acA = Math.cos(armAngle);   // along arm (stave belly direction)
        const acS = Math.sin(armAngle);

        const topX = hand.x + ca * bowH / 2;
        const topY = hand.y + sa * bowH / 2;
        const botX = hand.x - ca * bowH / 2;
        const botY = hand.y - sa * bowH / 2;
        // Stave curves toward the arm direction (belly of the bow)
        const curveSign = facingCamera ? 1 : -1;
        const cvX = hand.x + acA * 5 * sz * curveSign;
        const cvY = hand.y + acS * 5 * sz * curveSign;

        // Stave
        g.moveTo(topX * s, topY * s);
        g.quadraticCurveTo(cvX * s, cvY * s, botX * s, botY * s);
        g.stroke({ width: 2.5 * s, color: 0x886633 });

        // Stave tips
        g.circle(topX * s, topY * s, 0.8 * s);
        g.circle(botX * s, botY * s, 0.8 * s);
        g.fill(0xaa8844);

        // String
        g.moveTo(topX * s, topY * s);
        g.lineTo(botX * s, botY * s);
        g.stroke({ width: 0.5 * s, color: 0xccccaa });

        // Grip wrap
        const gw = 2 * sz;
        g.rect((hand.x - ca * gw - sa * 1) * s, (hand.y - sa * gw + ca * 1) * s, 2 * s, 4 * s);
        g.fill(0x664422);
      }
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }
}
