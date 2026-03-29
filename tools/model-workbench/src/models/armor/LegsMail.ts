import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_BODY } from "../types";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Mail leg armor — chain mail chausses covering thighs and calves.
 * Metallic sheen, ring pattern detail, padded underneath.
 */
export class LegsMail implements Model {
  readonly id = "legs-mail";
  readonly name = "Mail Chausses";
  readonly category = "legs" as const;
  readonly slot = "legs" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide } = ctx;
    const j = skeleton.joints;
    const calls: DrawCall[] = [];

    const sz = ctx.slotParams.size;
    for (const side of [farSide, nearSide]) {
      const d = side === farSide ? DEPTH_FAR_LIMB + 0 : DEPTH_FAR_LIMB + 2;
      calls.push({ depth: d, draw: (g, s) => this.drawLeg(g, j, palette, s, side, sz) });
    }

    // Waist mail skirt
    calls.push({
      depth: DEPTH_BODY + 3,
      draw: (g, s) => {
        const { hipL, hipR, crotch } = j;
        const skirtY = crotch.y + 1;
        g.moveTo(hipL.x * s, hipL.y * s);
        g.lineTo((hipL.x - 0.5) * s, skirtY * s);
        g.lineTo((hipR.x + 0.5) * s, skirtY * s);
        g.lineTo(hipR.x * s, hipR.y * s);
        g.closePath();
        g.fill(palette.body);
        g.moveTo(hipL.x * s, hipL.y * s);
        g.lineTo((hipL.x - 0.5) * s, skirtY * s);
        g.lineTo((hipR.x + 0.5) * s, skirtY * s);
        g.lineTo(hipR.x * s, hipR.y * s);
        g.closePath();
        g.stroke({ width: s * 0.4, color: palette.outline, alpha: 0.3 });

        // Chain pattern on skirt
        for (let i = 0; i < 3; i++) {
          const y = hipL.y + (skirtY - hipL.y) * ((i + 0.5) / 3);
          const w = (hipR.x - hipL.x) * (0.8 + i * 0.05);
          for (let j = 0; j < 4; j++) {
            const x = hipL.x + w * ((j + 0.5) / 4);
            g.circle(x * s, y * s, 0.6 * s);
            g.stroke({ width: s * 0.25, color: palette.bodyLt, alpha: 0.3 });
          }
        }
      },
    });

    return calls;
  }

  private drawLeg(g: Graphics, j: Record<string, V>, p: any, s: number, side: "L" | "R", sz = 1): void {
    const hip = j[`hip${side}`];
    const knee = j[`knee${side}`];
    const ankle = j[`ankle${side}`];
    const legTop: V = { x: hip.x * 0.5, y: hip.y };

    // Mail-covered thigh
    drawTaperedLimb(g, legTop, knee, 6.5 * sz, 5 * sz, p.body, p.bodyDk, p.outline, s);

    // Knee cop (metal plate over mail)
    g.roundRect((knee.x - 3 * sz) * s, (knee.y - 2 * sz) * s, 6 * sz * s, 4 * sz * s, 1.5 * s);
    g.fill(p.bodyLt);
    g.roundRect((knee.x - 3) * s, (knee.y - 2) * s, 6 * s, 4 * s, 1.5 * s);
    g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.4 });

    // Mail-covered calf
    drawTaperedLimb(g, knee, ankle, 5 * sz, 3.8 * sz, p.body, p.bodyDk, p.outline, s);

    // Ring pattern (small circles along the thigh)
    const midX = (legTop.x + knee.x) / 2;
    const midY = (legTop.y + knee.y) / 2;
    for (let i = 0; i < 3; i++) {
      const t = (i + 1) / 4;
      const rx = legTop.x + (knee.x - legTop.x) * t;
      const ry = legTop.y + (knee.y - legTop.y) * t;
      g.circle(rx * s, ry * s, 0.5 * s);
      g.stroke({ width: s * 0.2, color: p.bodyLt, alpha: 0.25 });
    }
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
