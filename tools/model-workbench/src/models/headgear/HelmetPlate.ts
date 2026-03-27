import type { Graphics } from "pixi.js";
import type {
  Model,
  RenderContext,
  DrawCall,
  Skeleton,
  AttachmentPoint,
} from "../types";

export class HelmetPlate implements Model {
  readonly id = "helmet-plate";
  readonly name = "Plate Helmet";
  readonly category = "headgear" as const;
  readonly slot = "head-top" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, facingCamera, bodyWidth } = ctx;
    const head = skeleton.joints.head;
    const wf = skeleton.wf;
    const iso = skeleton.iso;
    const sideView = Math.abs(iso.x) > 0.3;
    const r = 7 * (bodyWidth ?? 1);

    return [
      {
        depth: 52,
        draw: (g: Graphics, s: number) => {
          // Helm body
          g.ellipse(
            head.x * s,
            (head.y - 0.5) * s,
            (r + 1.5) * wf * s,
            (r + 1) * s
          );
          g.fill({ color: palette.body, alpha: 0.85 });
          g.ellipse(
            head.x * s,
            (head.y - 0.5) * s,
            (r + 1.5) * wf * s,
            (r + 1) * s
          );
          g.stroke({ width: s * 0.7, color: palette.outline });

          // Nose guard / center ridge
          if (facingCamera || sideView) {
            g.moveTo(head.x * s, (head.y - r - 1) * s);
            g.lineTo(head.x * s, (head.y + 1) * s);
            g.stroke({ width: s * 1.2, color: palette.bodyLt, alpha: 0.5 });
          }

          // Eye slit
          if (facingCamera || (sideView && iso.y >= -0.1)) {
            const slitW = 6 * wf;
            g.rect(
              (head.x - slitW / 2) * s,
              (head.y + 0.5) * s,
              slitW * s,
              1.8 * s
            );
            g.fill(0x111122);
          }
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }
}
