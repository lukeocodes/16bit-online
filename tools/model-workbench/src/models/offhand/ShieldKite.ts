import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";
import { darken, lighten } from "../palette";

/**
 * Kite Shield — kite-shaped shield.
 * Shows decorated front when facingCamera, back straps when facing away.
 */
export class ShieldKite implements Model {
  readonly id = "shield-kite";
  readonly name = "Kite Shield";
  readonly category = "offhand" as const;
  readonly slot = "hand-L" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera } = ctx;
    const side  = facingCamera ? ctx.farSide : ctx.nearSide;
    const wrist = skeleton.joints[`wrist${side}`];
    const iso   = skeleton.iso;
    const wf    = skeleton.wf;
    const sec   = ctx.palette.secondary;

    return [{
      depth: facingCamera ? DEPTH_FAR_LIMB + 3 : DEPTH_NEAR_LIMB + 3,
      draw: (g: Graphics, s: number) => {
        const sz = ctx.slotParams.size;
        const ox = iso.x * 4, oy = iso.y * 2;
        const cx = wrist.x + ox;
        const cy = wrist.y - 4 + oy;
        const sw = 7 * sz * wf, sh = 9 * sz;

        const drawKiteShape = () => {
          g.moveTo(cx * s, (cy - sh) * s);
          g.quadraticCurveTo((cx + sw) * s, (cy - sh * 0.3) * s, (cx + sw * 0.8) * s, cy * s);
          g.quadraticCurveTo((cx + sw * 0.3) * s, (cy + sh * 0.6) * s, cx * s, (cy + sh) * s);
          g.quadraticCurveTo((cx - sw * 0.3) * s, (cy + sh * 0.6) * s, (cx - sw * 0.8) * s, cy * s);
          g.quadraticCurveTo((cx - sw) * s, (cy - sh * 0.3) * s, cx * s, (cy - sh) * s);
          g.closePath();
        };

        if (facingCamera) {
          // ─── FRONT FACE ──────────────────────────────────────────
          drawKiteShape(); g.fill(sec);
          drawKiteShape(); g.stroke({ width: s * 0.8, color: darken(sec, 0.45) });

          // Rim highlight
          g.moveTo(cx * s, (cy - sh + 0.5) * s);
          g.quadraticCurveTo((cx - sw + 0.5) * s, (cy - sh * 0.3) * s, (cx - sw * 0.8 + 0.5) * s, cy * s);
          g.stroke({ width: s * 0.5, color: lighten(sec, 0.2), alpha: 0.5 });

          // Boss
          g.circle(cx * s, (cy - 1) * s, 2.5 * s); g.fill(0xccaa44);
          g.circle(cx * s, (cy - 1) * s, 2.5 * s); g.stroke({ width: s * 0.5, color: 0x886622 });

          // Cross
          g.moveTo(cx * s, (cy - sh * 0.6) * s); g.lineTo(cx * s, (cy + sh * 0.4) * s);
          g.moveTo((cx - sw * 0.5) * s, (cy - 1) * s); g.lineTo((cx + sw * 0.5) * s, (cy - 1) * s);
          g.stroke({ width: s * 0.7, color: darken(sec, 0.2), alpha: 0.4 });
        } else {
          // ─── BACK FACE ───────────────────────────────────────────
          drawKiteShape(); g.fill(darken(sec, 0.28));
          drawKiteShape(); g.stroke({ width: s * 0.6, color: darken(sec, 0.45) });

          // Wood grain
          for (let i = -1; i <= 1; i++) {
            const lx = cx + i * sw * 0.4;
            g.moveTo(lx * s, (cy - sh * 0.5) * s);
            g.quadraticCurveTo((lx + i * 0.3) * s, cy * s, lx * s, (cy + sh * 0.6) * s);
            g.stroke({ width: s * 0.3, color: darken(sec, 0.35), alpha: 0.2 });
          }

          // Arm strap
          g.moveTo((cx - sw * 0.4) * s, (cy - sh * 0.3) * s);
          g.quadraticCurveTo(cx * s, (cy - sh * 0.1) * s, (cx + sw * 0.4) * s, (cy + sh * 0.1) * s);
          g.stroke({ width: s * 2, color: 0x5a3a1a });

          // Buckle
          g.roundRect((cx - 1.5) * s, (cy - sh * 0.1 - 1) * s, 3 * s, 2 * s, 0.3 * s); g.fill(0x888866);
        }
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
