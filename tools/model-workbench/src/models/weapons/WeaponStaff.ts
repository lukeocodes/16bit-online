import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";

export class WeaponStaff implements Model {
  readonly id = "weapon-staff";
  readonly name = "Arcane Staff";
  readonly category = "weapon" as const;
  readonly slot = "hand-R" as const;
  readonly twoHanded = true;

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
        const sz     = ctx.slotParams.size;
        const ca     = Math.cos(angle), sa = Math.sin(angle);
        const topLen = 17 * sz, botLen = 11 * sz;

        const topX = wrist.x + ca * topLen, topY = wrist.y + sa * topLen;
        const botX = wrist.x - ca * botLen, botY = wrist.y - sa * botLen;

        g.moveTo(botX * s, botY * s); g.lineTo(topX * s, topY * s);
        g.stroke({ width: 2.2 * s, color: 0x664422 });

        // Grip wraps
        for (let i = 0; i < 3; i++) {
          const t  = -1 + i * 1.5;
          const wx = wrist.x + ca * t, wy = wrist.y + sa * t;
          g.moveTo((wx - sa * 1.5) * s, (wy + ca * 1.5) * s);
          g.lineTo((wx + sa * 1.5) * s, (wy - ca * 1.5) * s);
        }
        g.stroke({ width: s * 0.5, color: 0x886633 });

        // Prongs
        const p1X = topX - ca * 5 * sz, p1Y = topY - sa * 5 * sz;
        g.moveTo((p1X - sa * 2) * s, (p1Y + ca * 2) * s);
        g.quadraticCurveTo((topX - sa * 3) * s, (topY + ca * 3) * s, (topX - sa * 1) * s, (topY + ca * 1) * s);
        g.moveTo((p1X + sa * 2) * s, (p1Y - ca * 2) * s);
        g.quadraticCurveTo((topX + sa * 3) * s, (topY - ca * 3) * s, (topX + sa * 1) * s, (topY - ca * 1) * s);
        g.stroke({ width: s * 0.8, color: 0x664422 });

        // Crystal orb
        g.circle(topX * s, topY * s, 3.5 * sz * s); g.fill({ color: 0x44aaff, alpha: 0.85 });
        g.circle(topX * s, topY * s, 3.5 * sz * s); g.stroke({ width: s * 0.6, color: 0x2266aa });
        g.circle((topX - sa * 0.5) * s, (topY + ca * 0.5) * s, 1.5 * s);
        g.fill({ color: 0xaaddff, alpha: 0.6 });
        // Glow
        g.circle(topX * s, topY * s, 6 * sz * s); g.fill({ color: 0x44aaff, alpha: 0.06 });

        g.circle(botX * s, botY * s, 1.5 * sz * s); g.fill(0x886633);
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
