import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";

export class WeaponFlail implements Model {
  readonly id = "weapon-flail";
  readonly name = "Iron Flail";
  readonly category = "weapon" as const;
  readonly slot = "hand-R" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera } = ctx;
    const side  = facingCamera ? ctx.nearSide : ctx.farSide;
    const wrist = skeleton.joints[`wrist${side}`];
    const elbow = skeleton.joints[`elbow${side}`];
    const angle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x);
    const walkPhase = skeleton.walkPhase;

    return [{
      depth: facingCamera ? DEPTH_NEAR_LIMB + 3 : DEPTH_FAR_LIMB + 3,
      draw: (g: Graphics, s: number) => {
        const sz  = ctx.slotParams.size;
        const ca  = Math.cos(angle), sa = Math.sin(angle);

        const handleLen  = 10 * sz;
        const handleEndX = wrist.x + ca * handleLen;
        const handleEndY = wrist.y + sa * handleLen;

        g.moveTo(wrist.x * s, wrist.y * s);
        g.lineTo(handleEndX * s, handleEndY * s);
        g.stroke({ width: s * 2.2, color: 0x6b4226 });

        g.circle(wrist.x * s, wrist.y * s, 1.2 * s); g.fill(0x888888);

        const sway  = walkPhase !== 0 ? Math.sin(walkPhase * 2) * 3 : 0;
        const chainLen = 8 * sz;
        const px = -sa, py = ca;
        const links = 5;
        let prevX = handleEndX, prevY = handleEndY;
        for (let i = 0; i < links; i++) {
          const t  = (i + 1) / links;
          const cx = handleEndX + ca * chainLen * t + sway * t * px;
          const cy = handleEndY + sa * chainLen * t + sway * t * py + t * t * 3;
          g.moveTo(prevX * s, prevY * s); g.lineTo(cx * s, cy * s);
          g.stroke({ width: s * 1, color: 0x666666 });
          g.circle(cx * s, cy * s, 0.6 * s); g.fill(0x888888);
          prevX = cx; prevY = cy;
        }

        const ballR = 3 * sz;
        g.circle(prevX * s, prevY * s, ballR * s); g.fill(0x777777);
        g.circle(prevX * s, prevY * s, ballR * s); g.stroke({ width: s * 0.5, color: 0x444444, alpha: 0.5 });

        for (let i = 0; i < 8; i++) {
          const sa2 = (i / 8) * Math.PI * 2;
          g.moveTo((prevX + Math.cos(sa2) * ballR) * s, (prevY + Math.sin(sa2) * ballR) * s);
          g.lineTo((prevX + Math.cos(sa2) * (ballR + 2)) * s, (prevY + Math.sin(sa2) * (ballR + 2)) * s);
        }
        g.stroke({ width: s * 0.8, color: 0x888888 });

        g.circle((prevX - 0.5) * s, (prevY - 0.5) * s, 1 * s);
        g.fill({ color: 0xbbbbbb, alpha: 0.3 });
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
