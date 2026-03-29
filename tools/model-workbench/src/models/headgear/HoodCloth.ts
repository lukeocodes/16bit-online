import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint } from "../types";
import { DEPTH_HEAD, DEPTH_BODY, DEPTH_FAR_LIMB } from "../types";

/**
 * Cloth Hood — covers the head and drapes over shoulders.
 * Rogue/ranger style. When facing camera the face opening is drawn as a
 * cutout ring so the underlying face at DEPTH_HEAD shows through.
 */
export class HoodCloth implements Model {
  readonly id = "hood-cloth";
  readonly name = "Cloth Hood";
  readonly category = "headgear" as const;
  readonly slot = "head-top" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, facingCamera } = ctx;
    const head = skeleton.joints.head;
    const neckBase = skeleton.joints.neckBase;
    const wf = skeleton.wf;
    const iso = skeleton.iso;
    const r = 7 * (ctx.slotParams.size);

    return [
      {
        // Back drape — sits behind body
        depth: facingCamera ? DEPTH_FAR_LIMB - 5 : DEPTH_BODY + 6,
        draw: (g: Graphics, s: number) => {
          g.moveTo((head.x - (r + 2) * wf) * s, (head.y + 2) * s);
          g.quadraticCurveTo(
            (head.x - (r + 3) * wf) * s, (neckBase.y + 3) * s,
            (head.x - 3 * wf) * s, (neckBase.y + 8) * s
          );
          g.lineTo((head.x + 3 * wf) * s, (neckBase.y + 8) * s);
          g.quadraticCurveTo(
            (head.x + (r + 3) * wf) * s, (neckBase.y + 3) * s,
            (head.x + (r + 2) * wf) * s, (head.y + 2) * s
          );
          g.closePath();
          g.fill(palette.body);
        },
      },
      {
        depth: DEPTH_HEAD + 1,
        draw: (g: Graphics, s: number) => {
          const outerW = (r + 3) * wf;
          // baseY below face opening bottom (head.y + 1 + (r-2) = head.y+6) so no arch
          // edge bisects the face area, and chin is covered from all angles
          const baseY  = head.y + 8;
          const apexY  = head.y - r - 1;

          // Arch stays wide up the sides then tapers to apex — cp2 kept wide so
          // upper head corners are covered before the final convergence to the point.
          const drawArch = () => {
            g.moveTo((head.x - outerW) * s, baseY * s);
            g.bezierCurveTo(
              (head.x - outerW) * s, (head.y - r * 0.6) * s,   // rises along outer edge
              (head.x - outerW * 0.4) * s, (apexY + 1.5) * s,  // stays wide near crown
              head.x * s, apexY * s
            );
            g.bezierCurveTo(
              (head.x + outerW * 0.4) * s, (apexY + 1.5) * s,
              (head.x + outerW) * s, (head.y - r * 0.6) * s,
              (head.x + outerW) * s, baseY * s
            );
            g.quadraticCurveTo(head.x * s, (baseY + 1) * s, (head.x - outerW) * s, baseY * s);
          };

          // Arch sides only (for stroke) — no bottom arc across the face
          const drawArchRim = () => {
            g.moveTo((head.x - outerW) * s, baseY * s);
            g.bezierCurveTo(
              (head.x - outerW) * s, (head.y - r * 0.6) * s,
              (head.x - outerW * 0.4) * s, (apexY + 1.5) * s,
              head.x * s, apexY * s
            );
            g.bezierCurveTo(
              (head.x + outerW * 0.4) * s, (apexY + 1.5) * s,
              (head.x + outerW) * s, (head.y - r * 0.6) * s,
              (head.x + outerW) * s, baseY * s
            );
          };

          if (facingCamera) {
            drawArch();
            g.fill(palette.body);
            const openX = head.x + iso.x * 0.5;
            // Face opening — slightly elongated
            g.ellipse(openX * s, (head.y + 1) * s, (r - 1) * wf * s, (r - 1.5) * s);
            g.cut();
            // Outer rim only — no stroke across face opening
            drawArchRim();
            g.stroke({ width: s * 0.5, color: palette.outline, alpha: 0.35 });
          } else {
            drawArch();
            g.fill(palette.body);
            drawArch();
            g.stroke({ width: s * 0.5, color: palette.outline, alpha: 0.35 });
            // Shadow in side-view face opening
            if (Math.abs(iso.x) > 0.3 && iso.y >= 0) {
              const openX = head.x + iso.x * 1;
              g.ellipse(openX * s, (head.y + 1) * s, (r - 1) * wf * s, (r - 1.5) * s);
              g.fill({ color: 0x111122, alpha: 0.5 });
            }
            // Fold line at chin (back/side views only)
            g.moveTo((head.x - outerW) * s, baseY * s);
            g.quadraticCurveTo(head.x * s, (baseY + 2) * s, (head.x + outerW) * s, baseY * s);
            g.stroke({ width: s * 0.6, color: palette.bodyDk, alpha: 0.3 });
          }
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
