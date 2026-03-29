import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";
import { darken } from "../palette";

/**
 * Flail — handle + chain + spiked ball. Chain sways with walk.
 */
export class WeaponFlail implements Model {
  readonly id = "weapon-flail";
  readonly name = "Iron Flail";
  readonly category = "weapon" as const;
  readonly slot = "hand-R" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera } = ctx;
    const side = ctx.nearSide;
    const wrist = skeleton.joints[`wrist${side}`];
    const elbow = skeleton.joints[`elbow${side}`];
    const angle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x);
    const walkPhase = skeleton.walkPhase;

    return [{
      depth: facingCamera ? DEPTH_NEAR_LIMB + 3 : DEPTH_FAR_LIMB + 3,
      draw: (g: Graphics, s: number) => {
        const sz = ctx.slotParams.size;
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);

        // Handle
        const handleLen = 10 * sz;
        const handleEndX = wrist.x + ca * handleLen;
        const handleEndY = wrist.y + sa * handleLen;
        g.moveTo(wrist.x * s, wrist.y * s);
        g.lineTo(handleEndX * s, handleEndY * s);
        g.stroke({ width: s * 2.2, color: 0x6b4226 });

        // Pommel
        g.circle(wrist.x * s, wrist.y * s, 1.2 * s);
        g.fill(0x888888);

        // Chain (sways with walk)
        const sway = walkPhase !== 0 ? Math.sin(walkPhase * 2) * 3 : 0;
        const chainLen = 8 * sz;
        const px = -sa;
        const py = ca;

        const links = 5;
        let prevX = handleEndX;
        let prevY = handleEndY;
        for (let i = 0; i < links; i++) {
          const t = (i + 1) / links;
          const chainX = handleEndX + ca * chainLen * t + sway * t * px;
          const chainY = handleEndY + sa * chainLen * t + sway * t * py + t * t * 3; // gravity droop
          g.moveTo(prevX * s, prevY * s);
          g.lineTo(chainX * s, chainY * s);
          g.stroke({ width: s * 1, color: 0x666666 });

          // Link dot
          g.circle(chainX * s, chainY * s, 0.6 * s);
          g.fill(0x888888);

          prevX = chainX;
          prevY = chainY;
        }

        // Spiked ball
        const ballX = prevX;
        const ballY = prevY;
        const ballR = 3 * sz;

        g.circle(ballX * s, ballY * s, ballR * s);
        g.fill(0x777777);
        g.circle(ballX * s, ballY * s, ballR * s);
        g.stroke({ width: s * 0.5, color: 0x444444, alpha: 0.5 });

        // Spikes (8 radial)
        for (let i = 0; i < 8; i++) {
          const spikeAngle = (i / 8) * Math.PI * 2;
          const baseX = ballX + Math.cos(spikeAngle) * ballR;
          const baseY = ballY + Math.sin(spikeAngle) * ballR;
          const tipX = ballX + Math.cos(spikeAngle) * (ballR + 2);
          const tipY = ballY + Math.sin(spikeAngle) * (ballR + 2);
          g.moveTo(baseX * s, baseY * s);
          g.lineTo(tipX * s, tipY * s);
          g.stroke({ width: s * 0.8, color: 0x888888 });
        }

        // Metal highlight
        g.circle((ballX - 0.5) * s, (ballY - 0.5) * s, 1 * s);
        g.fill({ color: 0xbbbbbb, alpha: 0.3 });
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
