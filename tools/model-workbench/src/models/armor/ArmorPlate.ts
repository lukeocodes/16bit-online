import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V, ModelPalette } from "../types";
import { DEPTH_BODY, DEPTH_COLLAR } from "../types";
import { darken, lighten } from "../palette";

/**
 * Plate Armor — heavy breastplate, pauldrons, gorget.
 *
 * FACING AWARE: front plate decorations + gorget when facingCamera;
 *               backplate groove + neck guard when facing away.
 * IN FRONT OF: the torso at DEPTH_BODY + 3.
 * DEPTH_COLLAR: gorget sits behind face from front; neck guard from back.
 */
function drawPauldron(g: Graphics, shoulder: V, s: number, p: ModelPalette, sign: number, sz: number, facingCamera: boolean): void {
  const cx = shoulder.x + sign * 2 * sz, cy = shoulder.y - 1 * sz;
  const w  = 7.5 * sz, h = 6 * sz;

  if (facingCamera) {
    g.roundRect((cx - w * 0.5 * sign - (sign > 0 ? 0 : w)) * s, (cy - h * 0.3) * s, w * s, h * 0.7 * s, 2 * s);
    g.fill(p.bodyDk);
    g.ellipse((cx + sign * 0.5) * s, (cy - 0.5) * s, (w - 1) * s, (h - 1.5) * s); g.fill(p.body);
    g.ellipse((cx + sign * 0.5) * s, (cy - 0.5) * s, (w - 1) * s, (h - 1.5) * s);
    g.stroke({ width: s * 0.6, color: p.outline, alpha: 0.45 });
    for (let i = 1; i <= 2; i++) {
      const ly = cy + h * (i * 0.2 - 0.1);
      g.moveTo((cx - sign * (w - 3)) * s, ly * s);
      g.quadraticCurveTo((cx + sign * 1) * s, (ly + 0.5) * s, (cx + sign * (w - 3)) * s, ly * s);
      g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.3 });
    }
    g.circle((cx + sign * 0.5) * s, (cy - h * 0.15) * s, 1 * s); g.fill(p.accent);
    g.ellipse((cx - sign * 1) * s, (cy - h * 0.2) * s, 2 * s, 1.5 * s); g.fill({ color: p.bodyLt, alpha: 0.15 });
  } else {
    // Back pauldron — same silhouette, slightly darker, single back groove
    g.ellipse((cx + sign * 0.5) * s, (cy - 0.5) * s, (w - 1) * s, (h - 1.5) * s);
    g.fill(darken(p.body, 0.1));
    g.ellipse((cx + sign * 0.5) * s, (cy - 0.5) * s, (w - 1) * s, (h - 1.5) * s);
    g.stroke({ width: s * 0.5, color: p.outline, alpha: 0.4 });
    const ly = cy + h * 0.1;
    g.moveTo((cx - sign * (w - 3)) * s, ly * s);
    g.quadraticCurveTo((cx + sign * 1) * s, (ly + 0.3) * s, (cx + sign * (w - 3)) * s, ly * s);
    g.stroke({ width: s * 0.35, color: p.outline, alpha: 0.22 });
  }
}

export class ArmorPlate implements Model {
  readonly id = "armor-plate";
  readonly name = "Plate Armor";
  readonly category = "armor" as const;
  readonly slot = "torso" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, facingCamera } = ctx;
    const sz = ctx.slotParams.size;
    const j  = skeleton.joints;
    const { waistL, hipL, hipR, chestL, chestR, neckBase, shoulderL, shoulderR } = j;
    const wf = skeleton.wf, cx = neckBase.x;

    return [
      {
        depth: DEPTH_BODY + 3,
        draw: (g: Graphics, s: number) => {
          if (facingCamera) {
            // Breastplate center ridge
            g.moveTo(cx * s, (neckBase.y + 1 * sz) * s);
            g.lineTo(cx * s, ((waistL.y + hipL.y) / 2) * s);
            g.stroke({ width: s * 1.5, color: palette.bodyLt, alpha: 0.5 });
            // Horizontal plate band
            const my = (chestL.y + waistL.y) / 2;
            g.moveTo((chestL.x + 2 * sz) * s, my * s); g.lineTo((chestR.x - 2 * sz) * s, my * s);
            g.stroke({ width: s * 0.6, color: palette.bodyDk, alpha: 0.4 });
            // Chest catch-light
            g.ellipse(cx * s, (neckBase.y + 4 * sz) * s, 4 * wf * sz * s, 2 * sz * s);
            g.fill({ color: palette.bodyLt, alpha: 0.12 });
          } else {
            // Spinal groove
            g.moveTo(cx * s, (neckBase.y + 1 * sz) * s);
            g.lineTo(cx * s, ((waistL.y + hipL.y) / 2) * s);
            g.stroke({ width: s * 1.2, color: palette.bodyDk, alpha: 0.42 });
            // Backplate horizontal band
            const by = (chestL.y + waistL.y) / 2 - 1;
            g.moveTo((chestL.x + 2 * sz) * s, by * s); g.lineTo((chestR.x - 2 * sz) * s, by * s);
            g.stroke({ width: s * 0.5, color: palette.outline, alpha: 0.3 });
            // Back face slightly darker tint
            g.moveTo((chestL.x + 1 * sz) * s, (chestL.y + 1) * s);
            g.lineTo(hipL.x * s, hipL.y * s); g.lineTo(hipR.x * s, hipR.y * s);
            g.lineTo((chestR.x - 1 * sz) * s, (chestR.y + 1) * s); g.closePath();
            g.fill({ color: palette.bodyDk, alpha: 0.12 });
          }

          drawPauldron(g, shoulderL, s, palette, -1, sz, facingCamera);
          drawPauldron(g, shoulderR, s, palette,  1, sz, facingCamera);

          // Rivets
          g.circle((cx - 3 * wf * sz) * s, (neckBase.y + 3 * sz) * s, 0.8 * sz * s);
          g.circle((cx + 3 * wf * sz) * s, (neckBase.y + 3 * sz) * s, 0.8 * sz * s);
          g.fill(palette.bodyLt);
        },
      },
      {
        // Gorget (front) / neck guard (back) — DEPTH_COLLAR sits behind face
        depth: DEPTH_COLLAR,
        draw: (g: Graphics, s: number) => {
          if (facingCamera) {
            g.ellipse(neckBase.x * s, (neckBase.y + 0.5 * sz) * s, 4 * wf * sz * s, 2 * sz * s);
            g.fill(palette.accent);
            g.ellipse(neckBase.x * s, (neckBase.y + 0.5 * sz) * s, 4 * wf * sz * s, 2 * sz * s);
            g.stroke({ width: s * 0.5, color: palette.outline, alpha: 0.5 });
          } else {
            // Back neck guard
            g.ellipse(neckBase.x * s, (neckBase.y + 0.5 * sz) * s, 4.5 * wf * sz * s, 2.2 * sz * s);
            g.fill(darken(palette.accent, 0.1));
            g.ellipse(neckBase.x * s, (neckBase.y + 0.5 * sz) * s, 4.5 * wf * sz * s, 2.2 * sz * s);
            g.stroke({ width: s * 0.5, color: palette.outline, alpha: 0.4 });
          }
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
