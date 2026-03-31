import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_BODY } from "../types";
import { darken } from "../palette";

/**
 * Leather shoulders — hardened leather spaulders with stitching and studs.
 */
export class ShouldersLeather implements Model {
  readonly id = "shoulders-leather";
  readonly name = "Leather Spaulders";
  readonly category = "shoulders" as const;
  readonly slot = "shoulders" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide, facingCamera } = ctx;
    const j = skeleton.joints;
    const calls: DrawCall[] = [];

    const sz = ctx.slotParams.size;
    calls.push({
      depth: facingCamera ? DEPTH_FAR_LIMB + 8 : DEPTH_BODY + 3,
      draw: (g, s) => this.drawShoulder(g, j, palette, s, farSide, sz, false, facingCamera),
    });
    calls.push({
      depth: facingCamera ? DEPTH_BODY + 3 : DEPTH_FAR_LIMB + 8,
      draw: (g, s) => this.drawShoulder(g, j, palette, s, nearSide, sz, true, facingCamera),
    });

    return calls;
  }

  private drawShoulder(
    g: Graphics,
    j: Record<string, V>,
    p: any,
    s: number,
    side: "L" | "R",
    sz = 1,
    isNear = false,
    facingCamera = true
  ): void {
    const shoulder = j[`shoulder${side}`];
    const sign = side === "L" ? -1 : 1;

    // Near side uses base color, far side darkened 10%
    const fillColor = isNear ? p.body : darken(p.body, 0.1);

    // Rounded leather spaulder
    const cx = shoulder.x + sign * 1;
    const cy = shoulder.y - 0.5;
    const w = 6 * sz;
    const h = 5 * sz;

    g.ellipse(cx * s, cy * s, w * s, h * s);
    g.fill(fillColor);
    g.ellipse(cx * s, cy * s, w * s, h * s);
    g.stroke({ width: s * 0.5, color: p.outline, alpha: 0.4 });

    // Edge band
    g.ellipse(cx * s, (cy + h * 0.6) * s, (w - 0.5) * s, 1.5 * s);
    g.fill(p.accent);
    g.ellipse(cx * s, (cy + h * 0.6) * s, (w - 0.5) * s, 1.5 * s);
    g.stroke({ width: s * 0.3, color: p.accentDk, alpha: 0.3 });

    if (!facingCamera) {
      // Back view: no studs, slightly darker overall, simpler surface
      // Subtle back crease instead of stud pattern
      g.moveTo((cx - w * 0.3) * s, (cy - h * 0.3) * s);
      g.lineTo((cx + w * 0.3) * s, (cy - h * 0.3) * s);
      g.stroke({ width: s * 0.3, color: p.bodyDk, alpha: 0.2 });
      return;
    }

    // Studs (3 along the top curve) — front view only
    for (let i = -1; i <= 1; i++) {
      const sx = cx + i * 2.5;
      const sy = cy - h * 0.3;
      g.circle(sx * s, sy * s, 0.7 * s);
      g.fill(p.accentDk);
    }

    // Stitching line
    g.moveTo((cx - w * 0.5) * s, cy * s);
    g.quadraticCurveTo(cx * s, (cy - h * 0.5) * s, (cx + w * 0.5) * s, cy * s);
    g.stroke({ width: s * 0.3, color: p.accentDk, alpha: 0.25 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
