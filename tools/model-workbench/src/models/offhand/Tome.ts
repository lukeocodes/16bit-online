import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_FAR_LIMB, DEPTH_NEAR_LIMB } from "../types";
import { darken, lighten } from "../palette";

/**
 * Spell Tome — magical spellbook in the off-hand.
 * Front: open pages with runes. Back: closed cover when facing away.
 */
export class Tome implements Model {
  readonly id = "offhand-tome";
  readonly name = "Spell Tome";
  readonly category = "offhand" as const;
  readonly slot = "hand-L" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera, palette } = ctx;
    const side  = facingCamera ? ctx.farSide : ctx.nearSide;
    const wrist = skeleton.joints[`wrist${side}`];
    const iso   = skeleton.iso;
    const wf    = skeleton.wf;

    return [{
      depth: facingCamera ? DEPTH_FAR_LIMB + 2 : DEPTH_NEAR_LIMB + 2,
      draw: (g: Graphics, s: number) => {
        const ox = iso.x * 3, oy = iso.y * 1.5;
        const cx = wrist.x + ox, cy = wrist.y - 3 + oy;
        const bw = 5 * wf, bh = 7;
        const cover   = darken(palette.primary, 0.1);
        const coverDk = darken(palette.primary, 0.3);
        const pages   = 0xeee8d8;

        // Back cover (always drawn first)
        g.roundRect((cx - bw + 0.5) * s, (cy - bh + 0.5) * s, (bw * 2 - 1) * s, (bh * 2 - 1) * s, 1 * s);
        g.fill(coverDk);

        if (facingCamera) {
          // ─── OPEN PAGES (front view) ──────────────────────────────
          // Page spread
          g.roundRect((cx - bw + 1.5) * s, (cy - bh + 1.5) * s, (bw * 2 - 3) * s, (bh * 2 - 3) * s, 0.5 * s);
          g.fill(pages);

          // Page lines
          for (let i = 0; i < 4; i++) {
            const ly = cy - bh + 3.5 + i * 2.5;
            g.moveTo((cx - bw + 3) * s, ly * s); g.lineTo((cx + bw - 3) * s, ly * s);
            g.stroke({ width: s * 0.3, color: darken(pages, 0.15), alpha: 0.3 });
          }

          // Page divider (spine fold)
          g.moveTo(cx * s, (cy - bh + 1.5) * s); g.lineTo(cx * s, (cy + bh - 1.5) * s);
          g.stroke({ width: s * 0.4, color: darken(pages, 0.1), alpha: 0.25 });

          // Front cover outline
          g.roundRect((cx - bw) * s, (cy - bh) * s, bw * 2 * s, bh * 2 * s, 1.5 * s);
          g.stroke({ width: s * 0.8, color: cover, alpha: 0.8 });
        } else {
          // ─── CLOSED BACK COVER ───────────────────────────────────
          // Leather back cover
          g.roundRect((cx - bw + 1.5) * s, (cy - bh + 1.5) * s, (bw * 2 - 3) * s, (bh * 2 - 3) * s, 0.5 * s);
          g.fill(darken(palette.primary, 0.15));

          // Back cover texture lines
          for (let i = 0; i < 3; i++) {
            const ly = cy - bh + 3 + i * 3.5;
            g.moveTo((cx - bw + 2) * s, ly * s); g.lineTo((cx + bw - 2) * s, ly * s);
            g.stroke({ width: s * 0.25, color: darken(palette.primary, 0.25), alpha: 0.22 });
          }

          // Back cover outline
          g.roundRect((cx - bw) * s, (cy - bh) * s, bw * 2 * s, bh * 2 * s, 1.5 * s);
          g.stroke({ width: s * 0.8, color: darken(cover, 0.1), alpha: 0.6 });
        }

        // Spine (always visible)
        g.moveTo((cx - bw) * s, (cy - bh + 1) * s);
        g.lineTo((cx - bw) * s, (cy + bh - 1) * s);
        g.stroke({ width: s * 1.5, color: coverDk });

        // Cover emblem
        g.circle(cx * s, (cy - 1) * s, 2 * s); g.fill({ color: palette.primary, alpha: 0.6 });
        g.circle(cx * s, (cy - 1) * s, 2 * s); g.stroke({ width: s * 0.4, color: lighten(palette.primary, 0.3), alpha: 0.5 });
        g.circle(cx * s, (cy - 1) * s, 3.5 * s); g.fill({ color: lighten(palette.primary, 0.3), alpha: 0.08 });

        // Corner clasps
        for (const [rx, ry] of [[cx - bw + 1, cy - bh + 1], [cx + bw - 1, cy - bh + 1], [cx - bw + 1, cy + bh - 1], [cx + bw - 1, cy + bh - 1]]) {
          g.circle(rx * s, ry * s, 0.6 * s); g.fill(coverDk);
        }

        // Bookmark ribbon (only when showing pages)
        if (facingCamera) {
          g.moveTo((cx + bw - 2) * s, (cy - bh) * s);
          g.quadraticCurveTo((cx + bw - 1) * s, (cy + bh + 1) * s, (cx + bw - 2.5) * s, (cy + bh + 3) * s);
          g.stroke({ width: s * 0.6, color: 0xcc3333 });
        }
      },
    }];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
