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
    const side = ctx.nearSide;
    const wrist = skeleton.joints[`wrist${side}`];
    const elbow = skeleton.joints[`elbow${side}`];
    // 90° perpendicular to the forearm — same convention as the sword
    const armAngle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x);
    const angle = armAngle + (facingCamera ? Math.PI / 2 : -Math.PI / 2);

    return [{
      depth: facingCamera ? DEPTH_NEAR_LIMB + 3 : DEPTH_FAR_LIMB + 3,
      draw: (g: Graphics, s: number) => {
        const sz = ctx.slotParams.size;
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);

        // Grip is in the middle of the staff — top portion longer (orb end up)
        const topLen = 17 * sz;   // orb end above grip
        const botLen = 11 * sz;   // butt end below grip

        const topX = wrist.x + ca * topLen;
        const topY = wrist.y + sa * topLen;
        const botX = wrist.x - ca * botLen;
        const botY = wrist.y - sa * botLen;

        // Shaft
        g.moveTo(botX * s, botY * s);
        g.lineTo(topX * s, topY * s);
        g.stroke({ width: 2.2 * s, color: 0x664422 });

        // Grip wrappings (around the hand position)
        for (let i = 0; i < 3; i++) {
          const t = -1 + i * 1.5;
          const wx = wrist.x + ca * t;
          const wy = wrist.y + sa * t;
          g.moveTo((wx - sa * 1.5) * s, (wy + ca * 1.5) * s);
          g.lineTo((wx + sa * 1.5) * s, (wy - ca * 1.5) * s);
        }
        g.stroke({ width: s * 0.5, color: 0x886633 });

        // Prongs holding the orb (just below the orb)
        const prong1X = topX - ca * 5 * sz;
        const prong1Y = topY - sa * 5 * sz;
        g.moveTo((prong1X - sa * 2) * s, (prong1Y + ca * 2) * s);
        g.quadraticCurveTo(
          (topX - sa * 3) * s, (topY + ca * 3) * s,
          (topX - sa * 1) * s, (topY + ca * 1) * s
        );
        g.moveTo((prong1X + sa * 2) * s, (prong1Y - ca * 2) * s);
        g.quadraticCurveTo(
          (topX + sa * 3) * s, (topY - ca * 3) * s,
          (topX + sa * 1) * s, (topY - ca * 1) * s
        );
        g.stroke({ width: s * 0.8, color: 0x664422 });

        // Crystal orb at top
        g.circle(topX * s, topY * s, 3.5 * sz * s);
        g.fill({ color: 0x44aaff, alpha: 0.85 });
        g.circle(topX * s, topY * s, 3.5 * sz * s);
        g.stroke({ width: s * 0.6, color: 0x2266aa });

        // Inner glow
        g.circle((topX - sa * 0.5) * s, (topY + ca * 0.5) * s, 1.5 * s);
        g.fill({ color: 0xaaddff, alpha: 0.6 });

        // Butt cap
        g.circle(botX * s, botY * s, 1.5 * sz * s);
        g.fill(0x886633);
      }
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }
}
