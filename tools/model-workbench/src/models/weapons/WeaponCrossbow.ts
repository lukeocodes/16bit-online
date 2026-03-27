import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { darken, lighten } from "../palette";

/**
 * Crossbow — mechanical ranged weapon. Stock + prod (bow arms) + string.
 */
export class WeaponCrossbow implements Model {
  readonly id = "weapon-crossbow";
  readonly name = "Crossbow";
  readonly category = "weapon" as const;
  readonly slot = "hand-R" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera } = ctx;
    const side = ctx.nearSide;
    const wrist = skeleton.joints[`wrist${side}`];
    const elbow = skeleton.joints[`elbow${side}`];
    const angle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x);

    return [{
      depth: facingCamera ? 57 : 23,
      draw: (g: Graphics, s: number) => {
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);
        const px = -sa; // perpendicular
        const py = ca;

        // Stock (wooden body)
        const stockLen = 14;
        const stockEndX = wrist.x + ca * stockLen;
        const stockEndY = wrist.y + sa * stockLen;
        g.moveTo(wrist.x * s, wrist.y * s);
        g.lineTo(stockEndX * s, stockEndY * s);
        g.stroke({ width: s * 2.5, color: 0x6b4226 });
        g.moveTo(wrist.x * s, wrist.y * s);
        g.lineTo(stockEndX * s, stockEndY * s);
        g.stroke({ width: s * 0.5, color: 0x4a2e18, alpha: 0.3 });

        // Prod (bow arms) at the front
        const prodX = wrist.x + ca * stockLen * 0.8;
        const prodY = wrist.y + sa * stockLen * 0.8;
        const armLen = 7;

        // Left arm
        g.moveTo(prodX * s, prodY * s);
        g.quadraticCurveTo(
          (prodX + px * armLen * 0.8 + ca * 2) * s,
          (prodY + py * armLen * 0.8 + sa * 2) * s,
          (prodX + px * armLen) * s,
          (prodY + py * armLen) * s
        );
        // Right arm
        g.moveTo(prodX * s, prodY * s);
        g.quadraticCurveTo(
          (prodX - px * armLen * 0.8 + ca * 2) * s,
          (prodY - py * armLen * 0.8 + sa * 2) * s,
          (prodX - px * armLen) * s,
          (prodY - py * armLen) * s
        );
        g.stroke({ width: s * 1.5, color: 0x555555 });

        // String
        g.moveTo((prodX + px * armLen) * s, (prodY + py * armLen) * s);
        g.lineTo((prodX - ca * 1) * s, (prodY - sa * 1) * s);
        g.lineTo((prodX - px * armLen) * s, (prodY - py * armLen) * s);
        g.stroke({ width: s * 0.4, color: 0x888866 });

        // Trigger mechanism
        g.rect(
          (wrist.x + ca * 3 - 1) * s,
          (wrist.y + sa * 3 - 1) * s,
          2 * s, 2 * s
        );
        g.fill(0x555555);

        // Bolt (loaded)
        const boltStartX = prodX - ca * 2;
        const boltStartY = prodY - sa * 2;
        const boltEndX = prodX + ca * 4;
        const boltEndY = prodY + sa * 4;
        g.moveTo(boltStartX * s, boltStartY * s);
        g.lineTo(boltEndX * s, boltEndY * s);
        g.stroke({ width: s * 0.8, color: 0x6b4226 });
        // Bolt tip
        g.poly([
          boltEndX * s, boltEndY * s,
          (boltEndX + ca * 1.5 + px * 0.8) * s, (boltEndY + sa * 1.5 + py * 0.8) * s,
          (boltEndX + ca * 1.5 - px * 0.8) * s, (boltEndY + sa * 1.5 - py * 0.8) * s,
        ]);
        g.fill(0x888888);
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
