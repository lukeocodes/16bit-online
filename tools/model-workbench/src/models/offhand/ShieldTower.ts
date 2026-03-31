import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";
import { darken, lighten } from "../palette";

/**
 * Tower Shield — tall rectangular shield.
 *
 * HAND SELECTION: facingCamera → farSide (left hand, behind body when facing us)
 *                !facingCamera → nearSide (left hand swaps to near/front when facing away)
 *
 * FACING AWARE: Front face when camera-facing; back straps + wood grain when facing away.
 * IN FRONT OF: The arm/hand it's strapped to.
 * DEPTH: FAR_LIMB + 3 (behind body, in front of far arm) when facingCamera,
 *        NEAR_LIMB + 3 (in front of body, over near arm) when facing away.
 */
export class ShieldTower implements Model {
  readonly id = "shield-tower";
  readonly name = "Tower Shield";
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
        const ox  = iso.x * 4, oy = iso.y * 2;
        const cx  = wrist.x + ox;
        const cy  = wrist.y - 6 + oy;
        const sw  = 8 * sz * wf;
        const sh  = 14 * sz;

        if (facingCamera) {
          // ─── FRONT FACE ──────────────────────────────────────────────
          g.roundRect((cx - sw) * s, (cy - sh) * s, sw * 2 * s, sh * 2 * s, 2 * s);
          g.fill(palette.secondary);
          g.roundRect((cx - sw) * s, (cy - sh) * s, sw * 2 * s, sh * 2 * s, 2 * s);
          g.stroke({ width: s * 0.8, color: darken(palette.secondary, 0.3), alpha: 0.5 });

          // Metal rim
          g.roundRect((cx - sw + 0.5) * s, (cy - sh + 0.5) * s, (sw * 2 - 1) * s, (sh * 2 - 1) * s, 1.5 * s);
          g.stroke({ width: s * 1, color: darken(palette.secondary, 0.15), alpha: 0.4 });

          // Cross bands
          g.rect((cx - 1) * s, (cy - sh + 1) * s, 2 * s, (sh * 2 - 2) * s); g.fill(darken(palette.secondary, 0.2));
          g.rect((cx - sw + 1) * s, (cy - 1) * s, (sw * 2 - 2) * s, 2 * s);  g.fill(darken(palette.secondary, 0.2));

          // Boss
          g.circle(cx * s, cy * s, 2.5 * s); g.fill(lighten(palette.secondary, 0.15));
          g.circle(cx * s, cy * s, 2.5 * s); g.stroke({ width: s * 0.5, color: darken(palette.secondary, 0.25), alpha: 0.5 });
          g.circle(cx * s, cy * s, 1 * s);   g.fill(darken(palette.secondary, 0.1));

          // Corner rivets
          for (const [rx, ry] of [[cx - sw + 2, cy - sh + 2], [cx + sw - 2, cy - sh + 2], [cx - sw + 2, cy + sh - 2], [cx + sw - 2, cy + sh - 2]]) {
            g.circle(rx * s, ry * s, 0.8 * s); g.fill(darken(palette.secondary, 0.2));
          }

          // Directional rim highlight
          if (Math.abs(iso.x) > 0.1) {
            const litX = iso.x < 0 ? cx + sw : cx - sw;
            g.moveTo(litX * s, (cy - sh + 1) * s); g.lineTo(litX * s, (cy + sh - 1) * s);
            g.stroke({ width: s * 1.5, color: lighten(palette.secondary, 0.15), alpha: Math.abs(iso.x) * 0.38 });
          }
        } else {
          // ─── BACK FACE ───────────────────────────────────────────────
          const backColor = darken(palette.secondary, 0.28);
          g.roundRect((cx - sw) * s, (cy - sh) * s, sw * 2 * s, sh * 2 * s, 2 * s);
          g.fill(backColor);
          g.roundRect((cx - sw) * s, (cy - sh) * s, sw * 2 * s, sh * 2 * s, 2 * s);
          g.stroke({ width: s * 0.6, color: darken(palette.secondary, 0.45), alpha: 0.5 });

          // Wood grain lines
          for (let i = -2; i <= 2; i++) {
            const lx = cx + i * sw * 0.35;
            g.moveTo(lx * s, (cy - sh + 1) * s);
            g.lineTo((lx + i * 0.3) * s, (cy + sh - 1) * s);
            g.stroke({ width: s * 0.35, color: darken(palette.secondary, 0.35), alpha: 0.22 });
          }

          // Arm straps
          for (const [sy0, sy1] of [[-sh * 0.5, -sh * 0.05], [sh * 0.05, sh * 0.5]]) {
            g.moveTo((cx - sw * 0.5) * s, (cy + sy0) * s);
            g.quadraticCurveTo(cx * s, (cy + (sy0 + sy1) / 2 - 1) * s, (cx + sw * 0.5) * s, (cy + sy1) * s);
            g.stroke({ width: s * 2, color: 0x5a3a1a });
          }

          // Strap buckle
          g.roundRect((cx - 2) * s, (cy - 1.5) * s, 4 * s, 3 * s, 0.5 * s); g.fill(0x888866);
          g.roundRect((cx - 2) * s, (cy - 1.5) * s, 4 * s, 3 * s, 0.5 * s); g.stroke({ width: s * 0.3, color: 0x666644 });
        }
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
