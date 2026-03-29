import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";
import { darken, lighten } from "../palette";

/**
 * Halberd — long polearm with axe blade, spike, and hook.
 */
export class WeaponHalberd implements Model {
  readonly id = "weapon-halberd";
  readonly name = "Halberd";
  readonly category = "weapon" as const;
  readonly slot = "hand-R" as const;
  readonly twoHanded = true;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera } = ctx;
    const side = ctx.nearSide;
    const wrist = skeleton.joints[`wrist${side}`];
    const elbow = skeleton.joints[`elbow${side}`];
    const angle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x);

    return [{
      depth: facingCamera ? DEPTH_NEAR_LIMB + 3 : DEPTH_FAR_LIMB + 3,
      draw: (g: Graphics, s: number) => {
        const sz = ctx.slotParams.size;
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);
        const px = -sa;
        const py = ca;

        // Long shaft
        const shaftLen = 24 * sz;
        const tipX = wrist.x + ca * shaftLen;
        const tipY = wrist.y + sa * shaftLen;
        g.moveTo((wrist.x - ca * 3) * s, (wrist.y - sa * 3) * s);
        g.lineTo(tipX * s, tipY * s);
        g.stroke({ width: s * 1.8, color: 0x6b4226 });

        // Axe blade (on one side)
        const bladeBase = 0.78; // position along shaft
        const bladeX = wrist.x + ca * shaftLen * bladeBase;
        const bladeY = wrist.y + sa * shaftLen * bladeBase;
        const bladeW = 5 * sz;
        const bladeH = 6 * sz;

        g.moveTo(bladeX * s, bladeY * s);
        g.quadraticCurveTo(
          (bladeX + px * bladeW + ca * 1) * s,
          (bladeY + py * bladeW + sa * 1) * s,
          (bladeX + px * bladeW * 0.8 + ca * bladeH) * s,
          (bladeY + py * bladeW * 0.8 + sa * bladeH) * s
        );
        g.lineTo((bladeX + ca * bladeH) * s, (bladeY + sa * bladeH) * s);
        g.closePath();
        g.fill(0xc0c0d0);
        g.moveTo(bladeX * s, bladeY * s);
        g.quadraticCurveTo(
          (bladeX + px * bladeW + ca * 1) * s,
          (bladeY + py * bladeW + sa * 1) * s,
          (bladeX + px * bladeW * 0.8 + ca * bladeH) * s,
          (bladeY + py * bladeW * 0.8 + sa * bladeH) * s
        );
        g.lineTo((bladeX + ca * bladeH) * s, (bladeY + sa * bladeH) * s);
        g.closePath();
        g.stroke({ width: s * 0.5, color: 0x808090, alpha: 0.5 });

        // Edge highlight
        g.moveTo(bladeX * s, bladeY * s);
        g.quadraticCurveTo(
          (bladeX + px * bladeW * 0.5 + ca * bladeH * 0.5) * s,
          (bladeY + py * bladeW * 0.5 + sa * bladeH * 0.5) * s,
          (bladeX + px * bladeW * 0.8 + ca * bladeH) * s,
          (bladeY + py * bladeW * 0.8 + sa * bladeH) * s
        );
        g.stroke({ width: s * 0.4, color: 0xe0e0f0, alpha: 0.4 });

        // Back hook (opposite side, smaller)
        g.moveTo(bladeX * s, bladeY * s);
        g.quadraticCurveTo(
          (bladeX - px * 2.5) * s,
          (bladeY - py * 2.5) * s,
          (bladeX - px * 2 + ca * 2.5) * s,
          (bladeY - py * 2 + sa * 2.5) * s
        );
        g.stroke({ width: s * 1, color: 0xb0b0c0 });

        // Top spike
        const spikeBaseX = bladeX + ca * bladeH;
        const spikeBaseY = bladeY + sa * bladeH;
        g.moveTo(spikeBaseX * s, spikeBaseY * s);
        g.lineTo((spikeBaseX + ca * 4) * s, (spikeBaseY + sa * 4) * s);
        g.stroke({ width: s * 1.2, color: 0xc0c0d0 });
        // Spike tip
        g.poly([
          (spikeBaseX + ca * 4) * s, (spikeBaseY + sa * 4) * s,
          (spikeBaseX + ca * 5.5 + px * 0.5) * s, (spikeBaseY + sa * 5.5 + py * 0.5) * s,
          (spikeBaseX + ca * 5.5 - px * 0.5) * s, (spikeBaseY + sa * 5.5 - py * 0.5) * s,
        ]);
        g.fill(0xd0d0e0);

        // Langet straps (metal bands holding blade to shaft)
        for (let i = 0; i < 2; i++) {
          const t = bladeBase - 0.08 - i * 0.05;
          const lx = wrist.x + ca * shaftLen * t;
          const ly = wrist.y + sa * shaftLen * t;
          g.moveTo((lx + px * 1.5) * s, (ly + py * 1.5) * s);
          g.lineTo((lx - px * 1.5) * s, (ly - py * 1.5) * s);
          g.stroke({ width: s * 0.8, color: 0x888888 });
        }

        // Butt spike at bottom
        g.moveTo((wrist.x - ca * 3) * s, (wrist.y - sa * 3) * s);
        g.lineTo((wrist.x - ca * 5) * s, (wrist.y - sa * 5) * s);
        g.stroke({ width: s * 1, color: 0xa0a0b0 });
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
