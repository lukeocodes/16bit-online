import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";
import { DEPTH_BODY } from "../types";
import { darken, lighten } from "../palette";

/**
 * Elven armor — elegant green/gold with leaf motifs and flowing lines.
 * Light mail-like material with organic curves. Graceful, nature-themed.
 * When facing away: front vine patterns hidden, simpler back of elven mail shown.
 */
export class ArmorElven implements Model {
  readonly id = "armor-elven";
  readonly name = "Elven Leafweave";
  readonly category = "armor" as const;
  readonly slot = "torso" as const;

  private readonly LEAF = 0x2a6a3a;      // forest green
  private readonly LEAF_DK = 0x1a4a2a;   // dark green
  private readonly LEAF_LT = 0x4a8a5a;   // light green
  private readonly GOLD = 0xbbaa55;      // gold filigree
  private readonly GOLD_DK = 0x887733;   // dark gold
  private readonly SILVER = 0xb0b8c0;    // silver accents

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera } = ctx;
    const j = skeleton.joints;
    const wf = skeleton.wf;

    return [
      {
        depth: DEPTH_BODY + 3,
        draw: (g: Graphics, s: number) => {
          const { neckBase, waistL, waistR, hipL, hipR, shoulderL, shoulderR } = j;
          const cx = neckBase.x;

          // Main torso — slightly fitted, organic shape
          g.moveTo(cx * s, neckBase.y * s);
          g.quadraticCurveTo((shoulderR.x + 0.5) * s, shoulderR.y * s, (waistR.x + 0.5) * s, waistR.y * s);
          g.quadraticCurveTo((hipR.x + 0.8) * s, ((waistR.y + hipR.y) / 2) * s, hipR.x * s, hipR.y * s);
          g.lineTo(hipL.x * s, hipL.y * s);
          g.quadraticCurveTo((hipL.x - 0.8) * s, ((waistL.y + hipL.y) / 2) * s, (waistL.x - 0.5) * s, waistL.y * s);
          g.quadraticCurveTo((shoulderL.x - 0.5) * s, shoulderL.y * s, cx * s, neckBase.y * s);
          g.closePath();
          g.fill(this.LEAF);

          // Outline
          g.moveTo(cx * s, neckBase.y * s);
          g.quadraticCurveTo((shoulderR.x + 0.5) * s, shoulderR.y * s, (waistR.x + 0.5) * s, waistR.y * s);
          g.quadraticCurveTo((hipR.x + 0.8) * s, ((waistR.y + hipR.y) / 2) * s, hipR.x * s, hipR.y * s);
          g.lineTo(hipL.x * s, hipL.y * s);
          g.quadraticCurveTo((hipL.x - 0.8) * s, ((waistL.y + hipL.y) / 2) * s, (waistL.x - 0.5) * s, waistL.y * s);
          g.quadraticCurveTo((shoulderL.x - 0.5) * s, shoulderL.y * s, cx * s, neckBase.y * s);
          g.closePath();
          g.stroke({ width: s * 0.5, color: this.GOLD, alpha: 0.5 });

          if (facingCamera) {
            // Front: gold filigree vine pattern (curved lines)
            // Left vine
            g.moveTo((cx - 1) * s, (neckBase.y + 2) * s);
            g.quadraticCurveTo(
              (cx - 4 * wf) * s, ((neckBase.y + waistL.y) / 2 - 1) * s,
              (cx - 2 * wf) * s, (waistL.y - 1) * s
            );
            g.stroke({ width: s * 0.6, color: this.GOLD, alpha: 0.45 });

            // Right vine
            g.moveTo((cx + 1) * s, (neckBase.y + 2) * s);
            g.quadraticCurveTo(
              (cx + 4 * wf) * s, ((neckBase.y + waistR.y) / 2 - 1) * s,
              (cx + 2 * wf) * s, (waistR.y - 1) * s
            );
            g.stroke({ width: s * 0.6, color: this.GOLD, alpha: 0.45 });

            // Small leaf ornaments along vines
            for (let i = 0; i < 3; i++) {
              const t = (i + 0.5) / 3;
              const midY = neckBase.y + (waistL.y - neckBase.y) * t;

              // Left leaf
              const lx = cx - 3 * wf * (0.5 + t * 0.5);
              g.moveTo(lx * s, (midY - 0.5) * s);
              g.quadraticCurveTo((lx - 1) * s, midY * s, lx * s, (midY + 1) * s);
              g.quadraticCurveTo((lx + 0.5) * s, midY * s, lx * s, (midY - 0.5) * s);
              g.closePath();
              g.fill({ color: this.LEAF_LT, alpha: 0.4 });

              // Right leaf
              const rx = cx + 3 * wf * (0.5 + t * 0.5);
              g.moveTo(rx * s, (midY - 0.5) * s);
              g.quadraticCurveTo((rx + 1) * s, midY * s, rx * s, (midY + 1) * s);
              g.quadraticCurveTo((rx - 0.5) * s, midY * s, rx * s, (midY - 0.5) * s);
              g.closePath();
              g.fill({ color: this.LEAF_LT, alpha: 0.4 });
            }

            // Neckline — elegant V-shape with gold trim
            g.moveTo((shoulderL.x) * s, (neckBase.y + 1) * s);
            g.quadraticCurveTo(cx * s, (neckBase.y + 4) * s, (shoulderR.x) * s, (neckBase.y + 1) * s);
            g.stroke({ width: s * 0.8, color: this.GOLD, alpha: 0.5 });

            // Central leaf emblem
            const embY = (neckBase.y + waistL.y) / 2;
            g.moveTo(cx * s, (embY - 3) * s);
            g.quadraticCurveTo((cx + 2 * wf) * s, (embY - 1) * s, cx * s, (embY + 3) * s);
            g.quadraticCurveTo((cx - 2 * wf) * s, (embY - 1) * s, cx * s, (embY - 3) * s);
            g.closePath();
            g.fill({ color: this.GOLD, alpha: 0.4 });
            g.moveTo(cx * s, (embY - 3) * s);
            g.quadraticCurveTo((cx + 2 * wf) * s, (embY - 1) * s, cx * s, (embY + 3) * s);
            g.quadraticCurveTo((cx - 2 * wf) * s, (embY - 1) * s, cx * s, (embY - 3) * s);
            g.closePath();
            g.stroke({ width: s * 0.4, color: this.GOLD_DK, alpha: 0.5 });

            // Leaf vein
            g.moveTo(cx * s, (embY - 2) * s);
            g.lineTo(cx * s, (embY + 2) * s);
            g.stroke({ width: s * 0.3, color: this.GOLD_DK, alpha: 0.3 });
          } else {
            // Back view: simplified elven mail — subtle back stitching, no front motifs
            // Back center seam (straight spine line)
            g.moveTo(cx * s, (neckBase.y + 1) * s);
            g.lineTo(cx * s, (waistL.y - 0.5) * s);
            g.stroke({ width: s * 0.5, color: this.GOLD_DK, alpha: 0.3 });

            // Back mail rows (horizontal link rows — simpler than front)
            for (let i = 0; i < 4; i++) {
              const rowY = neckBase.y + 2 + i * 3;
              const rowW = (waistR.x - waistL.x) * (0.7 - i * 0.04);
              g.moveTo((cx - rowW / 2) * s, rowY * s);
              g.lineTo((cx + rowW / 2) * s, rowY * s);
              g.stroke({ width: s * 0.35, color: this.LEAF_LT, alpha: 0.2 });
            }

            // Back neckline — simple curve, no V detail
            g.moveTo((shoulderL.x) * s, (neckBase.y + 1) * s);
            g.quadraticCurveTo(cx * s, (neckBase.y + 2) * s, (shoulderR.x) * s, (neckBase.y + 1) * s);
            g.stroke({ width: s * 0.6, color: this.GOLD, alpha: 0.35 });
          }

          // Silver belt/sash (visible from both sides)
          const beltY = waistL.y + 0.5;
          g.rect((waistL.x + 1) * s, (beltY - 0.8) * s, (waistR.x - waistL.x - 2) * s, 1.8 * s);
          g.fill(this.SILVER);
          g.rect((waistL.x + 1) * s, (beltY - 0.8) * s, (waistR.x - waistL.x - 2) * s, 1.8 * s);
          g.stroke({ width: s * 0.3, color: darken(this.SILVER, 0.2), alpha: 0.3 });

          // Silver leaf buckle (visible from both sides)
          g.moveTo(cx * s, (beltY - 1.5) * s);
          g.quadraticCurveTo((cx + 1.2) * s, beltY * s, cx * s, (beltY + 1.5) * s);
          g.quadraticCurveTo((cx - 1.2) * s, beltY * s, cx * s, (beltY - 1.5) * s);
          g.closePath();
          g.fill(this.GOLD);
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
