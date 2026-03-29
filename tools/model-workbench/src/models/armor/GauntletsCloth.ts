import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";
import { drawTaperedLimb } from "../draw-helpers";

/**
 * Cloth gauntlets — wrapped cloth bracers and fingerless gloves.
 */
export class GauntletsCloth implements Model {
  readonly id = "gauntlets-cloth";
  readonly name = "Cloth Wrappings";
  readonly category = "gauntlets" as const;
  readonly slot = "gauntlets" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide, facingCamera } = ctx;
    const j = skeleton.joints;
    const calls: DrawCall[] = [];

    const sz = ctx.slotParams.size;
    calls.push({
      depth: facingCamera ? DEPTH_FAR_LIMB + 4 : DEPTH_NEAR_LIMB + 0,
      draw: (g, s) => this.drawGauntlet(g, j, palette, s, farSide, sz),
    });
    calls.push({
      depth: facingCamera ? DEPTH_NEAR_LIMB + 5 : DEPTH_FAR_LIMB + 5,
      draw: (g, s) => this.drawGauntlet(g, j, palette, s, nearSide, sz),
    });

    return calls;
  }

  private drawGauntlet(g: Graphics, j: Record<string, V>, p: any, s: number, side: "L" | "R", sz = 1): void {
    const elbow = j[`elbow${side}`];
    const wrist = j[`wrist${side}`];

    // Cloth wrap over forearm
    drawTaperedLimb(g, elbow, wrist, 3.8 * sz, 3.2 * sz, p.body, p.bodyDk, p.outline, s);

    // Wrap bands (horizontal)
    const dx = wrist.x - elbow.x;
    const dy = wrist.y - elbow.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = -dy / len;
    const py = dx / len;

    for (let i = 0; i < 3; i++) {
      const t = (i + 0.5) / 3.5;
      const bx = elbow.x + dx * t;
      const by = elbow.y + dy * t;
      const bw = 3.5 - i * 0.3;
      g.moveTo((bx + px * bw) * s, (by + py * bw) * s);
      g.lineTo((bx - px * bw) * s, (by - py * bw) * s);
      g.stroke({ width: s * 0.5, color: p.bodyDk, alpha: 0.3 });
    }

    // Wrapped hand
    g.circle(wrist.x * s, wrist.y * s, 2.5 * s);
    g.fill(p.body);
    g.circle(wrist.x * s, wrist.y * s, 2.5 * s);
    g.stroke({ width: s * 0.3, color: p.outline, alpha: 0.25 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
