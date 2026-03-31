import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V, ModelPalette } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_BODY } from "../types";
import { darken, lighten } from "../palette";

/**
 * Plate Pauldrons — heavy layered shoulder armour.
 *
 * DEPTH: facingCamera → farSide behind body (FAR_LIMB+8), nearSide in front (BODY+3)
 *        !facingCamera → swapped (after turn, near becomes behind, far becomes front)
 * NEAR/FAR TONING: near shoulder slightly lit, far shoulder darker.
 * FACING AWARE: shows pauldron front when facingCamera, back-plate silhouette when away.
 */
export class ShouldersPlate implements Model {
  readonly id = "shoulders-plate";
  readonly name = "Plate Pauldrons";
  readonly category = "shoulders" as const;
  readonly slot = "shoulders" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide, facingCamera } = ctx;
    const j  = skeleton.joints;
    const sz = ctx.slotParams.size;

    return [
      {
        depth: facingCamera ? DEPTH_FAR_LIMB + 8 : DEPTH_BODY + 3,
        draw: (g, s) => this.drawShoulder(g, j, palette, s, farSide, sz, false, facingCamera),
      },
      {
        depth: facingCamera ? DEPTH_BODY + 3 : DEPTH_FAR_LIMB + 8,
        draw: (g, s) => this.drawShoulder(g, j, palette, s, nearSide, sz, true, facingCamera),
      },
    ];
  }

  private drawShoulder(g: Graphics, j: Record<string, V>, p: ModelPalette, s: number, side: "L" | "R", sz: number, isNear: boolean, facingCamera: boolean): void {
    const shoulder = j[`shoulder${side}`];
    const sign = side === "L" ? -1 : 1;
    const cx = shoulder.x + sign * 1.5, cy = shoulder.y - 1;
    const w  = 7.5 * sz, h = 6 * sz;

    // Near side slightly lighter, far side slightly darker
    const bodyColor = isNear ? p.body : darken(p.body, 0.1);
    const bodyDkColor = isNear ? p.bodyDk : darken(p.bodyDk, 0.1);

    if (facingCamera) {
      // Front face of pauldron
      g.roundRect((cx - w * 0.5 * sign - (sign > 0 ? 0 : w)) * s, (cy - h * 0.3) * s, w * s, h * 0.7 * s, 2 * s);
      g.fill(bodyDkColor);
      g.ellipse((cx + sign * 0.5) * s, (cy - 0.5) * s, (w - 1) * s, (h - 1.5) * s); g.fill(bodyColor);
      g.ellipse((cx + sign * 0.5) * s, (cy - 0.5) * s, (w - 1) * s, (h - 1.5) * s);
      g.stroke({ width: s * 0.6, color: p.outline, alpha: 0.45 });
      // Segmentation lines
      for (let i = 1; i <= 2; i++) {
        const ly = cy + h * (i * 0.2 - 0.1);
        g.moveTo((cx - sign * (w - 3)) * s, ly * s);
        g.quadraticCurveTo((cx + sign * 1) * s, (ly + 0.5) * s, (cx + sign * (w - 3)) * s, ly * s);
        g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.3 });
      }
      g.circle((cx + sign * 0.5) * s, (cy - h * 0.15) * s, 1 * s); g.fill(p.accent);
      g.ellipse((cx - sign * 1) * s, (cy - h * 0.2) * s, 2 * s, 1.5 * s); g.fill({ color: isNear ? p.bodyLt : p.body, alpha: 0.15 });
    } else {
      // Back face of pauldron (rounded back plate, slightly darker)
      g.ellipse((cx + sign * 0.5) * s, (cy - 0.5) * s, (w - 1) * s, (h - 1.5) * s);
      g.fill(darken(bodyColor, 0.08));
      g.ellipse((cx + sign * 0.5) * s, (cy - 0.5) * s, (w - 1) * s, (h - 1.5) * s);
      g.stroke({ width: s * 0.5, color: p.outline, alpha: 0.4 });
      const ly = cy + h * 0.08;
      g.moveTo((cx - sign * (w - 3)) * s, ly * s);
      g.quadraticCurveTo((cx + sign * 1) * s, (ly + 0.3) * s, (cx + sign * (w - 3)) * s, ly * s);
      g.stroke({ width: s * 0.35, color: p.outline, alpha: 0.22 });
    }
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
