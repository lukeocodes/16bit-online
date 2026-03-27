import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";

/**
 * Mail shoulders — chain mail mantlets draped over shoulders.
 */
export class ShouldersMail implements Model {
  readonly id = "shoulders-mail";
  readonly name = "Mail Mantlets";
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
    const elbow = j[`elbow${side}`];
    const sign = side === "L" ? -1 : 1;

    const cx = shoulder.x + sign * 1;
    const cy = shoulder.y;
    const w = 6.5;
    const h = 5.5;

    // Mail drape shape (slightly longer, flows down more)
    g.moveTo((cx - w * sign * 0.3) * s, (cy - h * 0.6) * s);
    g.quadraticCurveTo(
      (cx + sign * w) * s, (cy - h * 0.3) * s,
      (cx + sign * w * 0.8) * s, (cy + h * 0.5) * s
    );
    g.quadraticCurveTo(
      (cx + sign * w * 0.5) * s, (cy + h * 0.8) * s,
      (cx - sign * 0.5) * s, (cy + h * 0.4) * s
    );
    g.quadraticCurveTo(
      (cx - sign * 2) * s, (cy) * s,
      (cx - w * sign * 0.3) * s, (cy - h * 0.6) * s
    );
    g.closePath();
    g.fill(p.body);

    // Outline
    g.moveTo((cx - w * sign * 0.3) * s, (cy - h * 0.6) * s);
    g.quadraticCurveTo(
      (cx + sign * w) * s, (cy - h * 0.3) * s,
      (cx + sign * w * 0.8) * s, (cy + h * 0.5) * s
    );
    g.quadraticCurveTo(
      (cx + sign * w * 0.5) * s, (cy + h * 0.8) * s,
      (cx - sign * 0.5) * s, (cy + h * 0.4) * s
    );
    g.quadraticCurveTo(
      (cx - sign * 2) * s, (cy) * s,
      (cx - w * sign * 0.3) * s, (cy - h * 0.6) * s
    );
    g.closePath();
    g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.35 });

    // Ring pattern (scattered circles)
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const rx = cx + sign * (col * 1.8 + 0.5);
        const ry = cy - 1 + row * 2;
        g.circle(rx * s, ry * s, 0.5 * s);
        g.stroke({ width: s * 0.2, color: p.bodyLt, alpha: 0.3 });
      }
    }

    // Leather edge band at bottom
    g.moveTo((cx + sign * w * 0.8) * s, (cy + h * 0.5) * s);
    g.quadraticCurveTo(
      (cx + sign * w * 0.5) * s, (cy + h * 0.8) * s,
      (cx - sign * 0.5) * s, (cy + h * 0.4) * s
    );
    g.stroke({ width: s * 1, color: p.accent, alpha: 0.5 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
