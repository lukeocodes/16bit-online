import type { Graphics } from "pixi.js";
import type {
  Model,
  RenderContext,
  DrawCall,
  Skeleton,
  AttachmentPoint,
  V,
  ModelPalette,
} from "../types";

function drawPauldron(
  g: Graphics,
  shoulder: V,
  s: number,
  pal: ModelPalette,
  side: number
): void {
  const px = shoulder.x + side * 2;
  const py = shoulder.y - 1;
  g.ellipse(px * s, py * s, 5 * s, 3 * s);
  g.fill(pal.accent);
  g.ellipse(px * s, py * s, 5 * s, 3 * s);
  g.stroke({ width: s * 0.6, color: pal.outline });
  // Highlight ridge
  g.ellipse(px * s, (py - 0.8) * s, 3 * s, 1.2 * s);
  g.fill({ color: pal.bodyLt, alpha: 0.4 });
}

export class ArmorPlate implements Model {
  readonly id = "armor-plate";
  readonly name = "Plate Armor";
  readonly category = "armor" as const;
  readonly slot = "torso" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette } = ctx;
    const {
      waistL,
      waistR,
      hipL,
      hipR,
      chestL,
      chestR,
      neckBase,
      shoulderL,
      shoulderR,
    } = skeleton.joints;
    const wf = skeleton.wf;
    const cx = neckBase.x;

    return [
      {
        depth: 33,
        draw: (g: Graphics, s: number) => {
          // Breastplate center ridge
          g.moveTo(cx * s, (neckBase.y + 1) * s);
          g.lineTo(cx * s, ((waistL.y + hipL.y) / 2) * s);
          g.stroke({ width: s * 1.5, color: palette.bodyLt, alpha: 0.5 });

          // Horizontal plate lines
          const my = (chestL.y + waistL.y) / 2;
          g.moveTo((chestL.x + 2) * s, my * s);
          g.lineTo((chestR.x - 2) * s, my * s);
          g.stroke({ width: s * 0.6, color: palette.bodyDk, alpha: 0.4 });

          // Pauldrons
          drawPauldron(g, shoulderL, s, palette, -1);
          drawPauldron(g, shoulderR, s, palette, 1);

          // Rivets
          const rivY = neckBase.y + 3;
          g.circle((cx - 3 * wf) * s, rivY * s, 0.8 * s);
          g.circle((cx + 3 * wf) * s, rivY * s, 0.8 * s);
          g.fill(palette.bodyLt);

          // Gorget (neck guard)
          g.ellipse(
            neckBase.x * s,
            (neckBase.y + 0.5) * s,
            4 * wf * s,
            2 * s
          );
          g.fill(palette.accent);
          g.ellipse(
            neckBase.x * s,
            (neckBase.y + 0.5) * s,
            4 * wf * s,
            2 * s
          );
          g.stroke({ width: s * 0.5, color: palette.outline, alpha: 0.5 });
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }
}
