import type { Graphics } from "pixi.js";
import type {
  Model,
  RenderContext,
  DrawCall,
  Skeleton,
  AttachmentPoint,
} from "../types";

export class CoifMail implements Model {
  readonly id = "coif-mail";
  readonly name = "Mail Coif";
  readonly category = "headgear" as const;
  readonly slot = "head-top" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette} = ctx;
    const head = skeleton.joints.head;
    const wf = skeleton.wf;
    const r = 7 * (ctx.slotParams.size);

    return [
      {
        depth: 52,
        draw: (g: Graphics, s: number) => {
          // Semi-transparent coif overlay
          g.ellipse(
            head.x * s,
            (head.y + 1) * s,
            (r + 1) * wf * s,
            (r + 2) * s
          );
          g.fill({ color: palette.body, alpha: 0.45 });
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }
}
