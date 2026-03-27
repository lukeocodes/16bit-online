import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";

/**
 * Cloth shoulders — simple padded cloth epaulettes/mantle.
 */
export class ShouldersCloth implements Model {
  readonly id = "shoulders-cloth";
  readonly name = "Cloth Mantle";
  readonly category = "shoulders" as const;
  readonly slot = "shoulders" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide, facingCamera } = ctx;
    const j = skeleton.joints;
    const calls: DrawCall[] = [];

    // Far shoulder (behind torso)
    calls.push({
      depth: facingCamera ? 28 : 42,
      draw: (g, s) => this.drawShoulder(g, j, palette, s, farSide),
    });
    // Near shoulder (in front)
    calls.push({
      depth: facingCamera ? 42 : 28,
      draw: (g, s) => this.drawShoulder(g, j, palette, s, nearSide),
    });

    return calls;
  }

  private drawShoulder(g: Graphics, j: Record<string, V>, p: any, s: number, side: "L" | "R"): void {
    const shoulder = j[`shoulder${side}`];
    const elbow = j[`elbow${side}`];

    // Flowing cloth drape over shoulder
    const dx = elbow.x - shoulder.x;
    const dy = elbow.y - shoulder.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = (-dy / len) * 4;
    const py = (dx / len) * 4;

    g.moveTo((shoulder.x + px) * s, (shoulder.y + py - 1) * s);
    g.quadraticCurveTo(
      (shoulder.x + px * 1.3) * s, (shoulder.y + py + 3) * s,
      (shoulder.x + dx * 0.4 + px * 0.5) * s, (shoulder.y + dy * 0.4 + py * 0.5 + 2) * s
    );
    g.lineTo((shoulder.x + dx * 0.4 - px * 0.3) * s, (shoulder.y + dy * 0.4 - py * 0.3 + 2) * s);
    g.quadraticCurveTo(
      (shoulder.x - px * 0.5) * s, (shoulder.y - py * 0.5 + 1) * s,
      (shoulder.x + px) * s, (shoulder.y + py - 1) * s
    );
    g.closePath();
    g.fill(p.body);

    // Edge stitch
    g.moveTo((shoulder.x + px) * s, (shoulder.y + py - 1) * s);
    g.quadraticCurveTo(
      (shoulder.x + px * 1.3) * s, (shoulder.y + py + 3) * s,
      (shoulder.x + dx * 0.4 + px * 0.5) * s, (shoulder.y + dy * 0.4 + py * 0.5 + 2) * s
    );
    g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.35 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
