import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_BODY } from "../types";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Plate leg armor — full plate greaves and cuisses.
 * Heavy metal plates with rivets, articulated knee cop.
 */
export class LegsPlate implements Model {
  readonly id = "legs-plate";
  readonly name = "Plate Greaves";
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

    // Tassets (plate skirt)
    calls.push({
      depth: DEPTH_BODY + 3,
      draw: (g, s) => {
        const { hipL, hipR, crotch } = j;
        const tassetY = crotch.y + 2;

        // Left tasset plate
        g.roundRect((hipL.x - 0.5) * s, hipL.y * s, ((-hipL.x + crotch.x) * 0.5 + 1) * s, (tassetY - hipL.y) * s, 1 * s);
        g.fill(palette.body);
        g.roundRect((hipL.x - 0.5) * s, hipL.y * s, ((-hipL.x + crotch.x) * 0.5 + 1) * s, (tassetY - hipL.y) * s, 1 * s);
        g.stroke({ width: s * 0.5, color: palette.outline, alpha: 0.4 });

        // Right tasset plate
        g.roundRect((crotch.x * 0.5 - 0.5) * s, hipR.y * s, ((hipR.x - crotch.x) * 0.5 + 1) * s, (tassetY - hipR.y) * s, 1 * s);
        g.fill(palette.body);
        g.roundRect((crotch.x * 0.5 - 0.5) * s, hipR.y * s, ((hipR.x - crotch.x) * 0.5 + 1) * s, (tassetY - hipR.y) * s, 1 * s);
        g.stroke({ width: s * 0.5, color: palette.outline, alpha: 0.4 });

        // Highlight on plates
        g.roundRect((hipL.x) * s, (hipL.y + 1) * s, 3 * s, (tassetY - hipL.y - 2) * s, 0.5 * s);
        g.fill({ color: palette.bodyLt, alpha: 0.2 });
        g.roundRect((crotch.x * 0.5) * s, (hipR.y + 1) * s, 3 * s, (tassetY - hipR.y - 2) * s, 0.5 * s);
        g.fill({ color: palette.bodyLt, alpha: 0.2 });
      },
    });

    return calls;
  }

  private drawLeg(g: Graphics, j: Record<string, V>, p: any, s: number, side: "L" | "R", sz = 1): void {
    const hip = j[`hip${side}`];
    const knee = j[`knee${side}`];
    const ankle = j[`ankle${side}`];
    const legTop: V = { x: hip.x * 0.5, y: hip.y };

    // Cuisse (thigh plate)
    drawTaperedLimb(g, legTop, knee, 6.8 * sz, 5.2 * sz, p.body, p.bodyDk, p.outline, s);

    // Plate edge highlight
    drawTaperedLimb(g, legTop, knee, 6.8 * sz, 5.2 * sz, p.bodyLt, p.bodyLt, p.bodyLt, s);
    // Redraw main over highlight to create edge effect
    drawTaperedLimb(g, legTop, { x: knee.x, y: knee.y - 0.5 }, 6 * sz, 4.5 * sz, p.body, p.bodyDk, p.outline, s);

    // Articulated knee cop (larger, segmented)
    g.roundRect((knee.x - 3.5 * sz) * s, (knee.y - 2.5 * sz) * s, 7 * sz * s, 5 * sz * s, 2 * s);
    g.fill(p.bodyLt);
    g.roundRect((knee.x - 3.5) * s, (knee.y - 2.5) * s, 7 * s, 5 * s, 2 * s);
    g.stroke({ width: s * 0.5, color: p.outline, alpha: 0.45 });

    // Knee articulation line
    g.moveTo((knee.x - 2.5) * s, knee.y * s);
    g.lineTo((knee.x + 2.5) * s, knee.y * s);
    g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.3 });

    // Rivet
    g.circle(knee.x * s, (knee.y - 1) * s, 0.7 * s);
    g.fill(p.accent);

    // Greave (shin plate)
    drawTaperedLimb(g, knee, ankle, 5.5 * sz, 4.2 * sz, p.body, p.bodyDk, p.outline, s);

    // Shin ridge (center line)
    g.moveTo(knee.x * s, (knee.y + 2) * s);
    g.lineTo(ankle.x * s, (ankle.y - 1) * s);
    g.stroke({ width: s * 0.6, color: p.bodyLt, alpha: 0.25 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
