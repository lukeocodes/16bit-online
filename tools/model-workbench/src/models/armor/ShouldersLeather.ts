import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";

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

    calls.push({
      depth: facingCamera ? 28 : 42,
      draw: (g, s) => this.drawShoulder(g, j, palette, s, farSide),
    });
    calls.push({
      depth: facingCamera ? 42 : 28,
      draw: (g, s) => this.drawShoulder(g, j, palette, s, nearSide),
    });

    return calls;
  }

  private drawShoulder(g: Graphics, j: Record<string, V>, p: any, s: number, side: "L" | "R"): void {
    const shoulder = j[`shoulder${side}`];
    const sign = side === "L" ? -1 : 1;
    const wf = 1;

    // Rounded leather spaulder
    const cx = shoulder.x + sign * 1;
    const cy = shoulder.y - 0.5;
    const w = 6;
    const h = 5;

    g.ellipse(cx * s, cy * s, w * s, h * s);
    g.fill(p.body);
    g.ellipse(cx * s, cy * s, w * s, h * s);
    g.stroke({ width: s * 0.5, color: p.outline, alpha: 0.4 });

    // Edge band
    g.ellipse(cx * s, (cy + h * 0.6) * s, (w - 0.5) * s, 1.5 * s);
    g.fill(p.accent);
    g.ellipse(cx * s, (cy + h * 0.6) * s, (w - 0.5) * s, 1.5 * s);
    g.stroke({ width: s * 0.3, color: p.accentDk, alpha: 0.3 });

    // Studs (3 along the top curve)
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
