import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";
import { darken, lighten } from "../palette";

/**
 * Buckler — small round shield.
 * Front: decorated face with boss. Back: strap knuckle grip.
 */
export class ShieldBuckler implements Model {
  readonly id = "shield-buckler";
  readonly name = "Buckler";
  readonly category = "offhand" as const;
  readonly slot = "hand-L" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera, palette } = ctx;
    const side  = facingCamera ? ctx.farSide : ctx.nearSide;
    const wrist = skeleton.joints[`wrist${side}`];
    const iso   = skeleton.iso;
    const wf    = skeleton.wf;

    return [{
      depth: facingCamera ? DEPTH_FAR_LIMB + 3 : DEPTH_NEAR_LIMB + 3,
      draw: (g: Graphics, s: number) => {
        const sz  = ctx.slotParams.size;
        const ox  = iso.x * 3, oy = iso.y * 1.5;
        const cx  = wrist.x + ox;
        const cy  = wrist.y - 1 + oy;
        const r   = 5 * sz * wf;

        if (facingCamera) {
          // ─── FRONT FACE ──────────────────────────────────────────
          g.circle(cx * s, cy * s, r * s); g.fill(palette.secondary);
          g.circle(cx * s, cy * s, r * s); g.stroke({ width: s * 0.7, color: darken(palette.secondary, 0.3), alpha: 0.5 });
          g.circle(cx * s, cy * s, (r - 1.5) * s); g.stroke({ width: s * 0.5, color: darken(palette.secondary, 0.15), alpha: 0.35 });

          // Boss
          g.circle(cx * s, cy * s, 2 * s); g.fill(lighten(palette.secondary, 0.2));
          g.circle(cx * s, cy * s, 2 * s); g.stroke({ width: s * 0.4, color: darken(palette.secondary, 0.2), alpha: 0.45 });
          g.circle(cx * s, cy * s, 0.8 * s); g.fill(darken(palette.secondary, 0.15));

          // Rivets
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            g.circle((cx + Math.cos(a) * (r - 0.8)) * s, (cy + Math.sin(a) * (r - 0.8)) * s, 0.5 * s);
            g.fill(darken(palette.secondary, 0.25));
          }

          // Rim directional highlight
          if (Math.abs(iso.x) > 0.1) {
            const hA = iso.x < 0 ? 0 : Math.PI;
            g.moveTo((cx + Math.cos(hA - 0.8) * r) * s, (cy + Math.sin(hA - 0.8) * r) * s);
            g.arc(cx * s, cy * s, r * s, hA - 0.8, hA + 0.8);
            g.stroke({ width: s * 1.2, color: lighten(palette.secondary, 0.15), alpha: Math.abs(iso.x) * 0.4 });
          }
        } else {
          // ─── BACK FACE ───────────────────────────────────────────
          g.circle(cx * s, cy * s, r * s); g.fill(darken(palette.secondary, 0.28));
          g.circle(cx * s, cy * s, r * s); g.stroke({ width: s * 0.6, color: darken(palette.secondary, 0.42), alpha: 0.5 });

          // Knuckle grip bar (horizontal grip handle on back)
          g.rect((cx - r * 0.6) * s, (cy - 0.7) * s, r * 1.2 * s, 1.4 * s); g.fill(0x5a3a1a);
          g.rect((cx - r * 0.6) * s, (cy - 0.7) * s, r * 1.2 * s, 1.4 * s); g.stroke({ width: s * 0.3, color: 0x3a2210, alpha: 0.5 });

          // Grip bolt heads
          g.circle((cx - r * 0.5) * s, cy * s, 0.5 * s); g.fill(0x888866);
          g.circle((cx + r * 0.5) * s, cy * s, 0.5 * s); g.fill(0x888866);
        }
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
