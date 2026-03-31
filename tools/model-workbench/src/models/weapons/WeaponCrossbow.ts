import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";

export class WeaponCrossbow implements Model {
  readonly id = "weapon-crossbow";
  readonly name = "Crossbow";
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

        const stockLen = 14 * sz;
        const stockEndX = wrist.x + ca * stockLen, stockEndY = wrist.y + sa * stockLen;

        g.moveTo(wrist.x * s, wrist.y * s); g.lineTo(stockEndX * s, stockEndY * s);
        g.stroke({ width: s * 2.5, color: 0x6b4226 });
        g.moveTo(wrist.x * s, wrist.y * s); g.lineTo(stockEndX * s, stockEndY * s);
        g.stroke({ width: s * 0.5, color: 0x4a2e18, alpha: 0.3 });

        const prodX = wrist.x + ca * stockLen * 0.8, prodY = wrist.y + sa * stockLen * 0.8;
        const armLen = 7 * sz;

        g.moveTo(prodX * s, prodY * s);
        g.quadraticCurveTo((prodX + px * armLen * 0.8 + ca * 2) * s, (prodY + py * armLen * 0.8 + sa * 2) * s, (prodX + px * armLen) * s, (prodY + py * armLen) * s);
        g.moveTo(prodX * s, prodY * s);
        g.quadraticCurveTo((prodX - px * armLen * 0.8 + ca * 2) * s, (prodY - py * armLen * 0.8 + sa * 2) * s, (prodX - px * armLen) * s, (prodY - py * armLen) * s);
        g.stroke({ width: s * 1.5, color: 0x555555 });

        // String
        g.moveTo((prodX + px * armLen) * s, (prodY + py * armLen) * s);
        g.lineTo((prodX - ca * 1) * s, (prodY - sa * 1) * s);
        g.lineTo((prodX - px * armLen) * s, (prodY - py * armLen) * s);
        g.stroke({ width: s * 0.4, color: 0x888866 });

        g.rect((wrist.x + ca * 3 - 1) * s, (wrist.y + sa * 3 - 1) * s, 2 * s, 2 * s); g.fill(0x555555);

        // Loaded bolt
        const boltS = prodX - ca * 2, boltSY = prodY - sa * 2;
        const boltE = prodX + ca * 4, boltEY = prodY + sa * 4;
        g.moveTo(boltS * s, boltSY * s); g.lineTo(boltE * s, boltEY * s);
        g.stroke({ width: s * 0.8, color: 0x6b4226 });
        g.poly([boltE * s, boltEY * s, (boltE + ca * 1.5 + px * 0.8) * s, (boltEY + sa * 1.5 + py * 0.8) * s, (boltE + ca * 1.5 - px * 0.8) * s, (boltEY + sa * 1.5 - py * 0.8) * s]);
        g.fill(0x888888);
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
