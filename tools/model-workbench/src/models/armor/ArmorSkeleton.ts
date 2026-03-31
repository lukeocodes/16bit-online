import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";
import { DEPTH_BODY } from "../types";
import { darken } from "../palette";

/**
 * Skeleton armor — bone-colored with rib-like ridges and skull motifs.
 * Made from actual bones or bone-white metal. Macabre, undead-themed.
 * When facing away: back spine/vertebrae column replaces rib cage front and skull emblem.
 */
export class ArmorSkeleton implements Model {
  readonly id = "armor-skeleton";
  readonly name = "Bone Armor";
  readonly category = "armor" as const;
  readonly slot = "torso" as const;

  private readonly BONE = 0xd0c8b8;     // bone white
  private readonly BONE_DK = 0xa09888;  // darker bone
  private readonly BONE_LT = 0xe8e0d8;  // light bone
  private readonly SHADOW = 0x444444;    // dark gaps
  private readonly ACCENT = 0x666060;    // grey metal

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

          // Main bone plate torso
          g.moveTo(cx * s, neckBase.y * s);
          g.quadraticCurveTo((shoulderR.x + 0.5) * s, (shoulderR.y - 0.5) * s, (waistR.x + 0.5) * s, waistR.y * s);
          g.lineTo((hipR.x + 0.3) * s, hipR.y * s);
          g.lineTo((hipL.x - 0.3) * s, hipL.y * s);
          g.lineTo((waistL.x - 0.5) * s, waistL.y * s);
          g.quadraticCurveTo((shoulderL.x - 0.5) * s, (shoulderR.y - 0.5) * s, cx * s, neckBase.y * s);
          g.closePath();
          g.fill(this.BONE);

          if (facingCamera) {
            // Front: rib-like ridges across the torso (horizontal bone plates)
            for (let i = 0; i < 4; i++) {
              const t = (i + 0.5) / 4.5;
              const ribY = neckBase.y + (hipL.y - neckBase.y) * t;
              const ribW = (waistR.x - waistL.x) * (0.9 - t * 0.15) * 0.5;

              // Rib plate
              g.moveTo((cx - ribW) * s, ribY * s);
              g.quadraticCurveTo(
                (cx - ribW * 0.5) * s, (ribY - 1) * s,
                cx * s, (ribY - 0.5) * s
              );
              g.quadraticCurveTo(
                (cx + ribW * 0.5) * s, (ribY - 1) * s,
                (cx + ribW) * s, ribY * s
              );
              g.stroke({ width: s * 1.5, color: this.BONE_LT });

              // Gap shadow between ribs
              g.moveTo((cx - ribW * 0.8) * s, (ribY + 0.8) * s);
              g.lineTo((cx + ribW * 0.8) * s, (ribY + 0.8) * s);
              g.stroke({ width: s * 0.4, color: this.SHADOW, alpha: 0.25 });
            }

            // Central spine ridge (front)
            g.moveTo(cx * s, (neckBase.y + 2) * s);
            g.lineTo(cx * s, (hipL.y - 1) * s);
            g.stroke({ width: s * 1.2, color: this.BONE_LT });
            g.moveTo(cx * s, (neckBase.y + 2) * s);
            g.lineTo(cx * s, (hipL.y - 1) * s);
            g.stroke({ width: s * 0.4, color: this.BONE_DK, alpha: 0.3 });

            // Skull emblem on chest (front only)
            const skullX = cx;
            const skullY = (neckBase.y + waistL.y) / 2 - 1;
            const skullR = 2.5 * wf;

            // Skull shape
            g.roundRect((skullX - skullR) * s, (skullY - skullR) * s, skullR * 2 * s, skullR * 2.2 * s, 1.5 * s);
            g.fill(this.BONE_LT);
            g.roundRect((skullX - skullR) * s, (skullY - skullR) * s, skullR * 2 * s, skullR * 2.2 * s, 1.5 * s);
            g.stroke({ width: s * 0.4, color: this.BONE_DK, alpha: 0.4 });

            // Eye sockets
            g.circle((skullX - 0.8 * wf) * s, (skullY - 0.2) * s, 0.8 * s);
            g.fill(this.SHADOW);
            g.circle((skullX + 0.8 * wf) * s, (skullY - 0.2) * s, 0.8 * s);
            g.fill(this.SHADOW);

            // Nose
            g.poly([
              skullX * s, (skullY + 0.5) * s,
              (skullX - 0.3) * s, (skullY + 1.2) * s,
              (skullX + 0.3) * s, (skullY + 1.2) * s,
            ]);
            g.fill(this.SHADOW);

            // Teeth
            g.moveTo((skullX - 1.2) * s, (skullY + 1.6) * s);
            g.lineTo((skullX + 1.2) * s, (skullY + 1.6) * s);
            g.stroke({ width: s * 0.5, color: this.BONE_DK, alpha: 0.4 });
          } else {
            // Back view: vertebrae column instead of rib cage front and skull
            // Back spine column (prominent vertical ridge)
            g.moveTo(cx * s, (neckBase.y + 1) * s);
            g.lineTo(cx * s, (hipL.y - 1) * s);
            g.stroke({ width: s * 1.8, color: this.BONE_LT });
            g.moveTo(cx * s, (neckBase.y + 1) * s);
            g.lineTo(cx * s, (hipL.y - 1) * s);
            g.stroke({ width: s * 0.5, color: this.BONE_DK, alpha: 0.35 });

            // Vertebrae discs along the spine
            const vertebraeCount = 6;
            const spineTop = neckBase.y + 2;
            const spineBot = hipL.y - 2;
            for (let i = 0; i < vertebraeCount; i++) {
              const t = i / (vertebraeCount - 1);
              const vy = spineTop + (spineBot - spineTop) * t;
              const vw = 2.0 + (i < vertebraeCount / 2 ? i * 0.15 : (vertebraeCount - 1 - i) * 0.15);
              g.ellipse(cx * s, vy * s, vw * s, 0.9 * s);
              g.fill(this.BONE_LT);
              g.ellipse(cx * s, vy * s, vw * s, 0.9 * s);
              g.stroke({ width: s * 0.3, color: this.BONE_DK, alpha: 0.3 });
            }

            // Back rib arcs (shorter than front, curving away)
            for (let i = 1; i < 4; i++) {
              const t = (i + 0.5) / 4.5;
              const ribY = neckBase.y + (hipL.y - neckBase.y) * t;
              const ribW = (waistR.x - waistL.x) * (0.6 - t * 0.1) * 0.5;

              // Left back rib arc
              g.moveTo(cx * s, ribY * s);
              g.quadraticCurveTo(
                (cx - ribW * 0.5) * s, (ribY + 0.8) * s,
                (cx - ribW) * s, ribY * s
              );
              g.stroke({ width: s * 1.0, color: this.BONE_LT });

              // Right back rib arc
              g.moveTo(cx * s, ribY * s);
              g.quadraticCurveTo(
                (cx + ribW * 0.5) * s, (ribY + 0.8) * s,
                (cx + ribW) * s, ribY * s
              );
              g.stroke({ width: s * 1.0, color: this.BONE_LT });
            }
          }

          // Grey metal belt (both sides)
          const beltY = waistL.y + 0.5;
          g.rect((waistL.x + 0.5) * s, (beltY - 1) * s, (waistR.x - waistL.x - 1) * s, 2.5 * s);
          g.fill(this.ACCENT);
          g.rect((waistL.x + 0.5) * s, (beltY - 1) * s, (waistR.x - waistL.x - 1) * s, 2.5 * s);
          g.stroke({ width: s * 0.3, color: darken(this.ACCENT, 0.3), alpha: 0.4 });

          // Bone buckle (both sides)
          g.circle(cx * s, beltY * s, 1.5 * s);
          g.fill(this.BONE_LT);
          g.circle(cx * s, beltY * s, 1.5 * s);
          g.stroke({ width: s * 0.3, color: this.BONE_DK, alpha: 0.4 });

          // Outline
          g.moveTo(cx * s, neckBase.y * s);
          g.quadraticCurveTo((shoulderR.x + 0.5) * s, (shoulderR.y - 0.5) * s, (waistR.x + 0.5) * s, waistR.y * s);
          g.lineTo((hipR.x + 0.3) * s, hipR.y * s);
          g.lineTo((hipL.x - 0.3) * s, hipL.y * s);
          g.lineTo((waistL.x - 0.5) * s, waistL.y * s);
          g.quadraticCurveTo((shoulderL.x - 0.5) * s, (shoulderR.y - 0.5) * s, cx * s, neckBase.y * s);
          g.closePath();
          g.stroke({ width: s * 0.5, color: this.BONE_DK, alpha: 0.4 });
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
