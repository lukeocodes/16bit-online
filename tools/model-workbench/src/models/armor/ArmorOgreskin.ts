import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";
import { DEPTH_BODY } from "../types";
import { darken, lighten } from "../palette";

/**
 * Ogre skin armor — crude beast-hide armor with stitched seams.
 * Made from thick monster hide, bone toggles, rough fur trim.
 * Leather-type armor mapped to a monster theme.
 */
export class ArmorOgreskin implements Model {
  readonly id = "armor-ogreskin";
  readonly name = "Ogre Hide Vest";
  readonly category = "armor" as const;
  readonly slot = "torso" as const;

  private readonly HIDE = 0x6a7a5a;     // greenish-brown hide
  private readonly HIDE_DK = 0x4a5a3a;  // dark hide
  private readonly HIDE_LT = 0x8a9a7a;  // lighter patches
  private readonly STITCH = 0x3a3a2a;   // dark stitching
  private readonly BONE_TOG = 0xd0c8b0; // bone toggle
  private readonly FUR = 0x7a6a5a;      // fur trim

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton } = ctx;
    const j = skeleton.joints;
    const wf = skeleton.wf;

    return [
      {
        depth: DEPTH_BODY + 3,
        draw: (g: Graphics, s: number) => {
          const { neckBase, waistL, waistR, hipL, hipR, shoulderL, shoulderR } = j;
          const cx = neckBase.x;

          // Rough asymmetric hide vest
          g.moveTo((cx + 1) * s, neckBase.y * s);
          g.quadraticCurveTo((shoulderR.x + 1.5) * s, (shoulderR.y + 0.5) * s, (waistR.x + 1) * s, waistR.y * s);
          g.quadraticCurveTo((hipR.x + 1.5) * s, ((waistR.y + hipR.y) / 2) * s, (hipR.x + 0.5) * s, (hipR.y + 1) * s);
          g.lineTo((hipL.x - 0.5) * s, (hipL.y + 1) * s);
          g.quadraticCurveTo((hipL.x - 1.5) * s, ((waistL.y + hipL.y) / 2) * s, (waistL.x - 1) * s, waistL.y * s);
          g.quadraticCurveTo((shoulderL.x - 1.5) * s, (shoulderL.y + 0.5) * s, (cx - 1) * s, neckBase.y * s);
          g.closePath();
          g.fill(this.HIDE);

          // Hide texture — irregular patches
          for (const [px, py, pr] of [[2, -25, 3], [-3, -22, 2.5], [4, -19, 2], [-2, -17, 3.5], [1, -21, 2]]) {
            g.ellipse((cx + px) * s, (neckBase.y + py + 20) * s, (pr * wf) * s, pr * 0.7 * s);
            g.fill({ color: this.HIDE_LT, alpha: 0.15 });
          }

          // Rough stitching lines (asymmetric, crude)
          // Center seam
          g.moveTo((cx + 0.5) * s, (neckBase.y + 1) * s);
          for (let i = 0; i < 6; i++) {
            const y = neckBase.y + 2 + i * 2.5;
            const offset = i % 2 === 0 ? 0.8 : -0.5;
            g.lineTo((cx + offset) * s, y * s);
          }
          g.stroke({ width: s * 0.5, color: this.STITCH, alpha: 0.4 });

          // Cross-stitch marks along center
          for (let i = 0; i < 5; i++) {
            const y = neckBase.y + 3 + i * 2.8;
            g.moveTo((cx - 1) * s, (y - 0.5) * s);
            g.lineTo((cx + 1) * s, (y + 0.5) * s);
            g.moveTo((cx + 1) * s, (y - 0.5) * s);
            g.lineTo((cx - 1) * s, (y + 0.5) * s);
            g.stroke({ width: s * 0.4, color: this.STITCH, alpha: 0.35 });
          }

          // Bone toggles (instead of metal buckles)
          for (let i = 0; i < 3; i++) {
            const ty = neckBase.y + 4 + i * 4;
            g.roundRect((cx - 0.5) * s, (ty - 0.5) * s, 1.5 * s, 1.5 * s, 0.5 * s);
            g.fill(this.BONE_TOG);
            g.roundRect((cx - 0.5) * s, (ty - 0.5) * s, 1.5 * s, 1.5 * s, 0.5 * s);
            g.stroke({ width: s * 0.3, color: darken(this.BONE_TOG, 0.2), alpha: 0.4 });
          }

          // Fur trim at neckline
          const furY = neckBase.y + 1;
          for (let i = 0; i < 8; i++) {
            const fx = shoulderL.x - 1 + i * ((shoulderR.x - shoulderL.x + 2) / 7);
            const fy = furY + Math.sin(i * 1.8) * 0.8;
            g.circle(fx * s, fy * s, 1.2 * s);
            g.fill(this.FUR);
          }
          // Fur trim outline
          g.moveTo((shoulderL.x - 1) * s, furY * s);
          g.quadraticCurveTo(cx * s, (furY + 1) * s, (shoulderR.x + 1) * s, furY * s);
          g.stroke({ width: s * 0.4, color: darken(this.FUR, 0.2), alpha: 0.3 });

          // Rough rope belt
          const beltY = waistL.y + 0.5;
          g.moveTo((waistL.x + 0.5) * s, beltY * s);
          for (let i = 0; i < 6; i++) {
            const bx = waistL.x + 1 + i * ((waistR.x - waistL.x - 2) / 5);
            const by = beltY + Math.sin(i * 2.5) * 0.5;
            g.lineTo(bx * s, by * s);
          }
          g.stroke({ width: s * 1.5, color: 0x5a4a3a });

          // Hanging bone charm
          g.moveTo(cx * s, (beltY + 1) * s);
          g.lineTo(cx * s, (beltY + 4) * s);
          g.stroke({ width: s * 0.4, color: 0x4a3a2a });
          g.circle(cx * s, (beltY + 4.5) * s, 1 * s);
          g.fill(this.BONE_TOG);

          // Outline (rough/organic)
          g.moveTo((cx + 1) * s, neckBase.y * s);
          g.quadraticCurveTo((shoulderR.x + 1.5) * s, (shoulderR.y + 0.5) * s, (waistR.x + 1) * s, waistR.y * s);
          g.quadraticCurveTo((hipR.x + 1.5) * s, ((waistR.y + hipR.y) / 2) * s, (hipR.x + 0.5) * s, (hipR.y + 1) * s);
          g.lineTo((hipL.x - 0.5) * s, (hipL.y + 1) * s);
          g.quadraticCurveTo((hipL.x - 1.5) * s, ((waistL.y + hipL.y) / 2) * s, (waistL.x - 1) * s, waistL.y * s);
          g.quadraticCurveTo((shoulderL.x - 1.5) * s, (shoulderL.y + 0.5) * s, (cx - 1) * s, neckBase.y * s);
          g.closePath();
          g.stroke({ width: s * 0.6, color: this.HIDE_DK, alpha: 0.45 });
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
