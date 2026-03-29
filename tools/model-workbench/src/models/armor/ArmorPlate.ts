import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V, ModelPalette } from "../types";
import { DEPTH_BODY, DEPTH_COLLAR } from "../types";

function drawPauldron(g: Graphics, shoulder: V, s: number, pal: ModelPalette, side: number, sz: number): void {
  const px = shoulder.x + side * 2 * sz;
  const py = shoulder.y - 1 * sz;
  g.ellipse(px * s, py * s, 5 * sz * s, 3 * sz * s);
  g.fill(pal.accent);
  g.ellipse(px * s, py * s, 5 * sz * s, 3 * sz * s);
  g.stroke({ width: s * 0.6, color: pal.outline });
  g.ellipse(px * s, (py - 0.8 * sz) * s, 3 * sz * s, 1.2 * sz * s);
  g.fill({ color: pal.bodyLt, alpha: 0.4 });
}

export class ArmorPlate implements Model {
  readonly id = "armor-plate";
  readonly name = "Plate Armor";
  readonly category = "armor" as const;
  readonly slot = "torso" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette } = ctx;
    const sz = ctx.slotParams.size;
    const { waistL, waistR, hipL, hipR, chestL, chestR, neckBase, shoulderL, shoulderR } = skeleton.joints;
    const wf = skeleton.wf;
    const cx = neckBase.x;

    return [
      {
        depth: DEPTH_BODY + 3,
        draw: (g: Graphics, s: number) => {
          // Breastplate center ridge
          g.moveTo(cx * s, (neckBase.y + 1 * sz) * s);
          g.lineTo(cx * s, ((waistL.y + hipL.y) / 2) * s);
          g.stroke({ width: s * 1.5, color: palette.bodyLt, alpha: 0.5 });

          // Horizontal plate line
          const my = (chestL.y + waistL.y) / 2;
          g.moveTo((chestL.x + 2 * sz) * s, my * s);
          g.lineTo((chestR.x - 2 * sz) * s, my * s);
          g.stroke({ width: s * 0.6, color: palette.bodyDk, alpha: 0.4 });

          // Pauldrons
          drawPauldron(g, shoulderL, s, palette, -1, sz);
          drawPauldron(g, shoulderR, s, palette,  1, sz);

          // Rivets
          const rivY = neckBase.y + 3 * sz;
          g.circle((cx - 3 * wf * sz) * s, rivY * s, 0.8 * sz * s);
          g.circle((cx + 3 * wf * sz) * s, rivY * s, 0.8 * sz * s);
          g.fill(palette.bodyLt);
        },
      },
      {
        // Gorget — behind face, above torso armor
        depth: DEPTH_COLLAR,
        draw: (g: Graphics, s: number) => {
          g.ellipse(neckBase.x * s, (neckBase.y + 0.5 * sz) * s, 4 * wf * sz * s, 2 * sz * s);
          g.fill(palette.accent);
          g.ellipse(neckBase.x * s, (neckBase.y + 0.5 * sz) * s, 4 * wf * sz * s, 2 * sz * s);
          g.stroke({ width: s * 0.5, color: palette.outline, alpha: 0.5 });
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
