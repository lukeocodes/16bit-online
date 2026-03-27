import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";
import { darken, lighten } from "../palette";

/**
 * Dragon armor — dark red/black plate with scale pattern, fiery accents.
 * Forged from dragonscale and obsidian. Heavy, prestigious.
 */
export class ArmorDragon implements Model {
  readonly id = "armor-dragon";
  readonly name = "Dragonscale Plate";
  readonly category = "armor" as const;
  readonly slot = "torso" as const;

  private readonly SCALE = 0x4a1a1a;    // dark crimson
  private readonly SCALE_DK = 0x2a0a0a; // near-black red
  private readonly SCALE_LT = 0x6a2a2a; // lighter crimson
  private readonly FIRE = 0xff6600;      // fiery orange accent
  private readonly FIRE_DK = 0xcc3300;   // deep fire
  private readonly GOLD = 0xccaa44;      // gold trim

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton } = ctx;
    const j = skeleton.joints;
    const wf = skeleton.wf;

    return [
      {
        depth: 33,
        draw: (g: Graphics, s: number) => {
          const { neckBase, waistL, waistR, hipL, hipR, shoulderL, shoulderR } = j;
          const cx = neckBase.x;

          // Scale-textured torso plate
          // Main body
          g.moveTo(cx * s, neckBase.y * s);
          g.quadraticCurveTo((shoulderR.x + 1) * s, (shoulderR.y - 1) * s, (waistR.x + 1) * s, waistR.y * s);
          g.lineTo((hipR.x + 0.5) * s, hipR.y * s);
          g.lineTo((hipL.x - 0.5) * s, hipL.y * s);
          g.lineTo((waistL.x - 1) * s, waistL.y * s);
          g.quadraticCurveTo((shoulderL.x - 1) * s, (shoulderL.y - 1) * s, cx * s, neckBase.y * s);
          g.closePath();
          g.fill(this.SCALE);

          // Scale pattern (overlapping semicircles)
          const rows = 5;
          const cols = 4;
          const scaleW = (waistR.x - waistL.x) / cols;
          for (let r = 0; r < rows; r++) {
            const rowY = neckBase.y + 2 + r * 3;
            const offset = r % 2 === 0 ? 0 : scaleW / 2;
            for (let c = 0; c < cols; c++) {
              const sx = waistL.x + c * scaleW + offset;
              g.moveTo((sx - scaleW * 0.5) * s, rowY * s);
              g.quadraticCurveTo(sx * s, (rowY + 2) * s, (sx + scaleW * 0.5) * s, rowY * s);
              g.stroke({ width: s * 0.4, color: this.SCALE_LT, alpha: 0.25 });
            }
          }

          // Gold trim at neckline
          g.moveTo((shoulderL.x - 0.5) * s, (neckBase.y + 1) * s);
          g.quadraticCurveTo(cx * s, (neckBase.y - 0.5) * s, (shoulderR.x + 0.5) * s, (neckBase.y + 1) * s);
          g.stroke({ width: s * 1.2, color: this.GOLD, alpha: 0.6 });

          // Dragon crest emblem (center chest)
          const embX = cx;
          const embY = (neckBase.y + waistL.y) / 2 - 1;

          // Wings of crest
          g.moveTo(embX * s, (embY - 1) * s);
          g.quadraticCurveTo((embX - 3 * wf) * s, (embY - 2) * s, (embX - 4 * wf) * s, embY * s);
          g.quadraticCurveTo((embX - 2 * wf) * s, (embY + 1) * s, embX * s, (embY + 0.5) * s);
          g.quadraticCurveTo((embX + 2 * wf) * s, (embY + 1) * s, (embX + 4 * wf) * s, embY * s);
          g.quadraticCurveTo((embX + 3 * wf) * s, (embY - 2) * s, embX * s, (embY - 1) * s);
          g.closePath();
          g.fill({ color: this.FIRE, alpha: 0.5 });

          // Central diamond
          g.poly([
            embX * s, (embY - 2) * s,
            (embX + 1.5 * wf) * s, embY * s,
            embX * s, (embY + 2) * s,
            (embX - 1.5 * wf) * s, embY * s,
          ]);
          g.fill(this.FIRE_DK);
          g.poly([
            embX * s, (embY - 2) * s,
            (embX + 1.5 * wf) * s, embY * s,
            embX * s, (embY + 2) * s,
            (embX - 1.5 * wf) * s, embY * s,
          ]);
          g.stroke({ width: s * 0.4, color: this.GOLD, alpha: 0.6 });

          // Belt with fiery buckle
          const beltY = waistL.y + 0.5;
          g.rect((waistL.x + 0.5) * s, (beltY - 1) * s, (waistR.x - waistL.x - 1) * s, 2.5 * s);
          g.fill(this.SCALE_DK);
          g.rect((cx - 1.5) * s, (beltY - 1.5) * s, 3 * s, 3.5 * s);
          g.fill(this.GOLD);
          g.circle(cx * s, beltY * s, 1 * s);
          g.fill(this.FIRE);

          // Outline
          g.moveTo(cx * s, neckBase.y * s);
          g.quadraticCurveTo((shoulderR.x + 1) * s, (shoulderR.y - 1) * s, (waistR.x + 1) * s, waistR.y * s);
          g.lineTo((hipR.x + 0.5) * s, hipR.y * s);
          g.lineTo((hipL.x - 0.5) * s, hipL.y * s);
          g.lineTo((waistL.x - 1) * s, waistL.y * s);
          g.quadraticCurveTo((shoulderL.x - 1) * s, (shoulderL.y - 1) * s, cx * s, neckBase.y * s);
          g.closePath();
          g.stroke({ width: s * 0.6, color: this.SCALE_DK, alpha: 0.5 });
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
