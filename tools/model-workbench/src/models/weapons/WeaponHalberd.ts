import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";

export class WeaponHalberd implements Model {
  readonly id = "weapon-halberd";
  readonly name = "Halberd";
  readonly category = "weapon" as const;
  readonly slot = "hand-R" as const;
  readonly twoHanded = true;

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

        const shaftLen = 24 * sz;
        const tipX = wrist.x + ca * shaftLen, tipY = wrist.y + sa * shaftLen;
        const butX = wrist.x - ca * 3, butY = wrist.y - sa * 3;

        g.moveTo(butX * s, butY * s); g.lineTo(tipX * s, tipY * s);
        g.stroke({ width: s * 1.8, color: 0x6b4226 });

        // Axe blade
        const b  = 0.78;
        const bX = wrist.x + ca * shaftLen * b, bY = wrist.y + sa * shaftLen * b;
        const bW = 5 * sz, bH = 6 * sz;

        g.moveTo(bX * s, bY * s);
        g.quadraticCurveTo((bX + px * bW + ca * 1) * s, (bY + py * bW + sa * 1) * s, (bX + px * bW * 0.8 + ca * bH) * s, (bY + py * bW * 0.8 + sa * bH) * s);
        g.lineTo((bX + ca * bH) * s, (bY + sa * bH) * s);
        g.closePath(); g.fill(0xc0c0d0);
        g.moveTo(bX * s, bY * s);
        g.quadraticCurveTo((bX + px * bW + ca * 1) * s, (bY + py * bW + sa * 1) * s, (bX + px * bW * 0.8 + ca * bH) * s, (bY + py * bW * 0.8 + sa * bH) * s);
        g.lineTo((bX + ca * bH) * s, (bY + sa * bH) * s);
        g.closePath(); g.stroke({ width: s * 0.5, color: 0x808090, alpha: 0.5 });

        // Edge highlight
        g.moveTo(bX * s, bY * s);
        g.quadraticCurveTo((bX + px * bW * 0.5 + ca * bH * 0.5) * s, (bY + py * bW * 0.5 + sa * bH * 0.5) * s, (bX + px * bW * 0.8 + ca * bH) * s, (bY + py * bW * 0.8 + sa * bH) * s);
        g.stroke({ width: s * 0.4, color: 0xe0e0f0, alpha: 0.4 });

        // Back hook
        g.moveTo(bX * s, bY * s);
        g.quadraticCurveTo((bX - px * 2.5) * s, (bY - py * 2.5) * s, (bX - px * 2 + ca * 2.5) * s, (bY - py * 2 + sa * 2.5) * s);
        g.stroke({ width: s * 1, color: 0xb0b0c0 });

        // Spike at tip
        const spX = bX + ca * bH, spY = bY + sa * bH;
        g.moveTo(spX * s, spY * s); g.lineTo((spX + ca * 4) * s, (spY + sa * 4) * s);
        g.stroke({ width: s * 1.2, color: 0xc0c0d0 });
        g.poly([(spX + ca * 4) * s, (spY + sa * 4) * s, (spX + ca * 5.5 + px * 0.5) * s, (spY + sa * 5.5 + py * 0.5) * s, (spX + ca * 5.5 - px * 0.5) * s, (spY + sa * 5.5 - py * 0.5) * s]);
        g.fill(0xd0d0e0);

        // Langets
        for (let i = 0; i < 2; i++) {
          const t  = b - 0.08 - i * 0.05;
          const lx = wrist.x + ca * shaftLen * t, ly = wrist.y + sa * shaftLen * t;
          g.moveTo((lx + px * 1.5) * s, (ly + py * 1.5) * s);
          g.lineTo((lx - px * 1.5) * s, (ly - py * 1.5) * s);
          g.stroke({ width: s * 0.8, color: 0x888888 });
        }

        // Butt spike
        g.moveTo(butX * s, butY * s); g.lineTo((butX - ca * 2) * s, (butY - sa * 2) * s);
        g.stroke({ width: s * 1, color: 0xa0a0b0 });
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
