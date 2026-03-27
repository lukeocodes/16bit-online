import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint } from "../types";

export class WeaponStaff implements Model {
  readonly id = "weapon-staff";
  readonly name = "Arcane Staff";
  readonly category = "weapon" as const;
  readonly slot = "hand-R" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera } = ctx;
    const side = ctx.nearSide;
    const wrist = skeleton.joints[`wrist${side}`];

    return [{
      depth: facingCamera ? 57 : 23,
      draw: (g: Graphics, s: number) => {
        const hand = wrist;
        const topY = hand.y - 28;
        const botY = hand.y + 5;

        // Shaft
        g.moveTo(hand.x * s, topY * s);
        g.lineTo(hand.x * s, botY * s);
        g.stroke({ width: 2.2 * s, color: 0x664422 });

        // Shaft wrapping
        for (let i = 0; i < 3; i++) {
          const wy = hand.y - 5 + i * 3;
          g.moveTo((hand.x - 1.5) * s, wy * s);
          g.lineTo((hand.x + 1.5) * s, (wy + 1) * s);
        }
        g.stroke({ width: s * 0.5, color: 0x886633 });

        // Crystal/orb at top
        g.circle(hand.x * s, (topY + 2) * s, 3.5 * s);
        g.fill({ color: 0x44aaff, alpha: 0.85 });
        g.circle(hand.x * s, (topY + 2) * s, 3.5 * s);
        g.stroke({ width: s * 0.6, color: 0x2266aa });

        // Inner glow
        g.circle((hand.x - 0.5) * s, (topY + 1.5) * s, 1.5 * s);
        g.fill({ color: 0xaaddff, alpha: 0.6 });

        // Prongs holding the orb
        g.moveTo((hand.x - 2) * s, (topY + 5) * s);
        g.quadraticCurveTo((hand.x - 3) * s, (topY + 2) * s, (hand.x - 1) * s, (topY - 0.5) * s);
        g.moveTo((hand.x + 2) * s, (topY + 5) * s);
        g.quadraticCurveTo((hand.x + 3) * s, (topY + 2) * s, (hand.x + 1) * s, (topY - 0.5) * s);
        g.stroke({ width: s * 0.8, color: 0x664422 });
      }
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }
}
