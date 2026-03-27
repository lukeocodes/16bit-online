import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";
import { darken } from "../palette";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Leather leg armor — fitted leather trousers with knee pads.
 * Snug fit, stitching details, reinforced knees.
 */
export class LegsLeather implements Model {
  readonly id = "legs-leather";
  readonly name = "Leather Leggings";
  readonly category = "legs" as const;
  readonly slot = "legs" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide } = ctx;
    const j = skeleton.joints;
    const calls: DrawCall[] = [];

    for (const side of [farSide, nearSide]) {
      const d = side === farSide ? 10.5 : 12.5;
      calls.push({ depth: d, draw: (g, s) => this.drawLeg(g, j, palette, s, side) });
    }

    // Belt/waist panel
    calls.push({
      depth: 33,
      draw: (g, s) => {
        const { hipL, hipR, crotch } = j;
        g.moveTo(hipL.x * s, hipL.y * s);
        g.lineTo(((hipL.x + crotch.x) / 2 - 0.3) * s, crotch.y * s);
        g.lineTo(((hipR.x + crotch.x) / 2 + 0.3) * s, crotch.y * s);
        g.lineTo(hipR.x * s, hipR.y * s);
        g.closePath();
        g.fill(palette.body);
        g.moveTo(hipL.x * s, hipL.y * s);
        g.lineTo(((hipL.x + crotch.x) / 2 - 0.3) * s, crotch.y * s);
        g.lineTo(((hipR.x + crotch.x) / 2 + 0.3) * s, crotch.y * s);
        g.lineTo(hipR.x * s, hipR.y * s);
        g.closePath();
        g.stroke({ width: s * 0.5, color: palette.outline, alpha: 0.35 });
      },
    });

    return calls;
  }

  private drawLeg(g: Graphics, j: Record<string, V>, p: any, s: number, side: "L" | "R"): void {
    const hip = j[`hip${side}`];
    const knee = j[`knee${side}`];
    const ankle = j[`ankle${side}`];
    const legTop: V = { x: hip.x * 0.5, y: hip.y };

    // Fitted leather thigh
    drawTaperedLimb(g, legTop, knee, 6.2, 4.8, p.body, p.bodyDk, p.outline, s);

    // Knee pad (reinforced)
    g.ellipse(knee.x * s, knee.y * s, 3.5 * s, 2.2 * s);
    g.fill(p.accent);
    g.ellipse(knee.x * s, knee.y * s, 3.5 * s, 2.2 * s);
    g.stroke({ width: s * 0.4, color: p.accentDk, alpha: 0.4 });

    // Rivet on knee
    g.circle(knee.x * s, knee.y * s, 0.8 * s);
    g.fill(p.accentDk);

    // Fitted leather calf
    drawTaperedLimb(g, knee, ankle, 5, 3.8, p.body, p.bodyDk, p.outline, s);

    // Stitching line down the side
    const mx = (legTop.x + knee.x) / 2 + 2.5;
    const my = (legTop.y + knee.y) / 2;
    g.moveTo((legTop.x + 2.5) * s, legTop.y * s);
    g.lineTo((knee.x + 2) * s, knee.y * s);
    g.stroke({ width: s * 0.3, color: p.accentDk, alpha: 0.3 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
