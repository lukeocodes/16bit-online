import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_BODY } from "../types";
import { darken } from "../palette";

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

    const cx = shoulder.x + sign * 1;
    const cy = shoulder.y;

    // Near side slightly brighter, far side darkened
    const fillColor = isNear ? p.body : darken(p.body, 0.1);

    if (!facingCamera) {
      // Back view: slightly wider drape, darker, single ring row instead of 2
      const w = 7 * sz;
      const h = 5.5 * sz;

      g.moveTo((cx - w * sign * 0.3) * s, (cy - h * 0.6) * s);
      g.quadraticCurveTo(
        (cx + sign * w) * s, (cy - h * 0.3) * s,
        (cx + sign * w * 0.85) * s, (cy + h * 0.5) * s
      );
      g.quadraticCurveTo(
        (cx + sign * w * 0.5) * s, (cy + h * 0.8) * s,
        (cx - sign * 0.5) * s, (cy + h * 0.4) * s
      );
      g.quadraticCurveTo(
        (cx - sign * 2) * s, cy * s,
        (cx - w * sign * 0.3) * s, (cy - h * 0.6) * s
      );
      g.closePath();
      g.fill(darken(fillColor, 0.1));

      // Single ring row for back view
      for (let col = 0; col < 3; col++) {
        const rx = cx + sign * (col * 1.8 + 0.5);
        const ry = cy;
        g.circle(rx * s, ry * s, 0.5 * s);
        g.stroke({ width: s * 0.2, color: p.bodyLt, alpha: 0.25 });
      }

      // Leather edge band at bottom
      g.moveTo((cx + sign * w * 0.85) * s, (cy + h * 0.5) * s);
      g.quadraticCurveTo(
        (cx + sign * w * 0.5) * s, (cy + h * 0.8) * s,
        (cx - sign * 0.5) * s, (cy + h * 0.4) * s
      );
      g.stroke({ width: s * 1, color: p.accent, alpha: 0.4 });
      return;
    }

    const w = 6.5 * sz;
    const h = 5.5 * sz;

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
      (cx - sign * 2) * s, cy * s,
      (cx - w * sign * 0.3) * s, (cy - h * 0.6) * s
    );
    g.closePath();
    g.fill(fillColor);

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
      (cx - sign * 2) * s, cy * s,
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
