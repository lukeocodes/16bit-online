import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint } from "../types";

export class WeaponBow implements Model {
  readonly id = "weapon-bow";
  readonly name = "Hunting Bow";
  readonly category = "weapon" as const;
  readonly slot = "hand-R" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera } = ctx;
    const side = ctx.nearSide;
    const wrist = skeleton.joints[`wrist${side}`];
    const iso = skeleton.iso;

    return [{
      depth: facingCamera ? 57 : 23,
      draw: (g: Graphics, s: number) => {
        const hand = wrist;
        const bowH = 16;
        const curve = 5 * (iso.x !== 0 ? Math.sign(iso.x) : 1);

        // Stave
        g.moveTo(hand.x * s, (hand.y - bowH / 2) * s);
        g.quadraticCurveTo(
          (hand.x + curve) * s,
          hand.y * s,
          hand.x * s,
          (hand.y + bowH / 2) * s
        );
        g.stroke({ width: 2.5 * s, color: 0x886633 });

        // Stave tips
        g.circle(hand.x * s, (hand.y - bowH / 2) * s, 0.8 * s);
        g.circle(hand.x * s, (hand.y + bowH / 2) * s, 0.8 * s);
        g.fill(0xaa8844);

        // String
        g.moveTo(hand.x * s, (hand.y - bowH / 2) * s);
        g.lineTo(hand.x * s, (hand.y + bowH / 2) * s);
        g.stroke({ width: 0.5 * s, color: 0xccccaa });

        // Grip wrap
        g.rect((hand.x - 1) * s, (hand.y - 2) * s, 2 * s, 4 * s);
        g.fill(0x664422);
      }
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }
}
