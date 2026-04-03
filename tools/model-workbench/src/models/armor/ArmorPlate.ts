import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, FitmentCorners, ModelPalette } from "../types";
import { DEPTH_BODY, DEPTH_COLLAR } from "../types";
import { darken, lighten } from "../palette";
import { drawCornerQuad, quadPoint } from "../draw-helpers";

/**
 * Plate Armor — heavy breastplate with pauldrons and gorget.
 *
 * DEPTH: DEPTH_BODY + 3 (= 93) — above torso body at BODY+0 and pelvis at BODY+2.
 *
 * CORNER-BASED: Uses ctx.fitmentCorners (torso slot) so the plate automatically
 * stretches to fit any body type — narrow elf, wide dwarf, tiny gnome.
 *
 * FACING AWARE: Front view shows breastplate ridge, clavicle, pauldrons.
 *               Back view shows backplate groove, neck guard, back pauldrons.
 */
export class ArmorPlate implements Model {
  readonly id = "armor-plate";
  readonly name = "Plate Armor";
  readonly category = "armor" as const;
  readonly slot = "torso" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, facingCamera, fitmentCorners } = ctx;
    const j  = skeleton.joints;
    const sz = ctx.slotParams.size;
    const wf = skeleton.wf;

    // Use fitment corners if available, else fall back to skeleton joints
    const fc: FitmentCorners = fitmentCorners ?? {
      tl: { x: j.shoulderL.x, y: j.neckBase.y },
      tr: { x: j.shoulderR.x, y: j.neckBase.y },
      bl: { x: j.hipL.x,      y: j.hipL.y },
      br: { x: j.hipR.x,      y: j.hipR.y },
    };

    // Inset the armor slightly from the body corners so it looks like it's on top
    const plateInset = 0.5 * sz;

    return [
      {
        // ─── Main breastplate / backplate ─────────────────────────────────
        depth: DEPTH_BODY + 3,
        draw: (g: Graphics, s: number) => {

          // ─── Base quad fill ─────────────────────────────────────────
          // Inset top slightly (armor doesn't cover the full neck)
          const insetCorners: FitmentCorners = {
            tl: { x: fc.tl.x + 1.5 * sz, y: fc.tl.y + 1 * sz },
            tr: { x: fc.tr.x - 1.5 * sz, y: fc.tr.y + 1 * sz },
            bl: { x: fc.bl.x + 0.5 * sz, y: fc.bl.y - 0.5 * sz },
            br: { x: fc.br.x - 0.5 * sz, y: fc.br.y - 0.5 * sz },
          };

          drawCornerQuad(g, insetCorners, 0, palette.body, palette.outline, 0.45, s);

          if (facingCamera) {
            // ─── FRONT VIEW ─────────────────────────────────────────────

            // Directional side shading — far side of breastplate is darker
            const sideAmt = Math.abs(skeleton.iso.x);
            if (sideAmt > 0.08) {
              const shadowIsRight = ctx.nearSide === "L";
              const shadowCorners: FitmentCorners = shadowIsRight ? {
                tl: insetCorners.tr,
                tr: { x: (insetCorners.tl.x + insetCorners.tr.x) / 2, y: insetCorners.tl.y },
                bl: insetCorners.br,
                br: { x: (insetCorners.bl.x + insetCorners.br.x) / 2, y: insetCorners.bl.y },
              } : {
                tl: { x: (insetCorners.tl.x + insetCorners.tr.x) / 2, y: insetCorners.tl.y },
                tr: insetCorners.tl,
                bl: { x: (insetCorners.bl.x + insetCorners.br.x) / 2, y: insetCorners.bl.y },
                br: insetCorners.bl,
              };
              drawCornerQuad(g, shadowCorners, 0,
                darken(palette.body, 0.22), palette.outline, 0, s);
              g.fill({ color: darken(palette.body, 0.22), alpha: sideAmt * 0.45 });
            }

            // Center ridge (vertical line down middle)
            const midTop = quadPoint(insetCorners, 0.5, 0.05);
            const midBot = quadPoint(insetCorners, 0.5, 0.82);
            g.moveTo(midTop.x * s, midTop.y * s);
            g.lineTo(midBot.x * s, midBot.y * s);
            g.stroke({ width: s * 1.4, color: palette.bodyLt, alpha: 0.48 });

            // Horizontal plate band (at 40% from top)
            const bandL = quadPoint(insetCorners, 0.05, 0.4);
            const bandR = quadPoint(insetCorners, 0.95, 0.4);
            g.moveTo(bandL.x * s, bandL.y * s); g.lineTo(bandR.x * s, bandR.y * s);
            g.stroke({ width: s * 0.6, color: palette.bodyDk, alpha: 0.38 });

            // Chest catch-light (upper-center)
            const catchPt = quadPoint(insetCorners, 0.5, 0.18);
            g.ellipse(catchPt.x * s, catchPt.y * s, 4 * wf * sz * s, 2 * sz * s);
            g.fill({ color: palette.bodyLt, alpha: 0.14 });

            // Clavicle line (top edge, shoulder-to-shoulder arc)
            const clavL = quadPoint(insetCorners, 0.05, 0.02);
            const clavR = quadPoint(insetCorners, 0.95, 0.02);
            const clavMid = quadPoint(insetCorners, 0.5, 0.0);
            g.moveTo(clavL.x * s, clavL.y * s);
            g.quadraticCurveTo(clavMid.x * s, (clavMid.y + 0.5) * s, clavR.x * s, clavR.y * s);
            g.stroke({ width: s * 0.5, color: palette.bodyLt, alpha: 0.3 });

            // Rivets at shoulder corners
            const rivL = quadPoint(insetCorners, 0.08, 0.05);
            const rivR = quadPoint(insetCorners, 0.92, 0.05);
            g.circle(rivL.x * s, rivL.y * s, 0.9 * sz * s); g.fill(palette.bodyLt);
            g.circle(rivR.x * s, rivR.y * s, 0.9 * sz * s); g.fill(palette.bodyLt);

            // Lower plate rivets
            const rivBL = quadPoint(insetCorners, 0.1, 0.88);
            const rivBR = quadPoint(insetCorners, 0.9, 0.88);
            g.circle(rivBL.x * s, rivBL.y * s, 0.8 * sz * s); g.fill(palette.bodyLt);
            g.circle(rivBR.x * s, rivBR.y * s, 0.8 * sz * s); g.fill(palette.bodyLt);

          } else {
            // ─── BACK VIEW ──────────────────────────────────────────────

            // Darker tint overall (back is less lit)
            drawCornerQuad(g, insetCorners, 0,
              darken(palette.body, 0.08), palette.outline, 0, s);
            g.fill({ color: darken(palette.body, 0.08), alpha: 0.35 });

            // Spinal groove
            const spTop = quadPoint(insetCorners, 0.5, 0.05);
            const spBot = quadPoint(insetCorners, 0.5, 0.88);
            g.moveTo(spTop.x * s, spTop.y * s);
            g.lineTo(spBot.x * s, spBot.y * s);
            g.stroke({ width: s * 1.2, color: palette.bodyDk, alpha: 0.42 });

            // Horizontal back band
            const bBL = quadPoint(insetCorners, 0.05, 0.38);
            const bBR = quadPoint(insetCorners, 0.95, 0.38);
            g.moveTo(bBL.x * s, bBL.y * s); g.lineTo(bBR.x * s, bBR.y * s);
            g.stroke({ width: s * 0.5, color: palette.outline, alpha: 0.3 });

            // Back rivets
            const brivL = quadPoint(insetCorners, 0.08, 0.05);
            const brivR = quadPoint(insetCorners, 0.92, 0.05);
            g.circle(brivL.x * s, brivL.y * s, 0.9 * sz * s); g.fill(palette.bodyLt);
            g.circle(brivR.x * s, brivR.y * s, 0.9 * sz * s); g.fill(palette.bodyLt);
          }

          // ─── Pauldrons (shoulder plates) ────────────────────────────
          this.drawPauldron(g, fc, skeleton.iso.x, palette, sz, wf, facingCamera, ctx.nearSide, s);
        },
      },
      {
        // ─── Gorget / neck guard ───────────────────────────────────────
        // Sits at DEPTH_COLLAR = 108, behind head but above torso armor
        depth: DEPTH_COLLAR,
        draw: (g: Graphics, s: number) => {
          const nB  = j.neckBase;
          const gW  = 4 * wf * sz, gH = 2 * sz;

          if (facingCamera) {
            g.ellipse(nB.x * s, (nB.y + 0.5 * sz) * s, gW * s, gH * s);
            g.fill(palette.accent);
            g.ellipse(nB.x * s, (nB.y + 0.5 * sz) * s, gW * s, gH * s);
            g.stroke({ width: s * 0.5, color: palette.outline, alpha: 0.5 });
            // Gorget rivet
            g.circle(nB.x * s, (nB.y + 0.5 * sz) * s, 0.6 * sz * s); g.fill(palette.bodyLt);
          } else {
            // Back neck guard — slightly wider
            g.ellipse(nB.x * s, (nB.y + 0.5 * sz) * s, (gW + 1) * s, (gH + 0.2) * s);
            g.fill(darken(palette.accent, 0.1));
            g.ellipse(nB.x * s, (nB.y + 0.5 * sz) * s, (gW + 1) * s, (gH + 0.2) * s);
            g.stroke({ width: s * 0.5, color: palette.outline, alpha: 0.4 });
          }
        },
      },
    ];
  }

  // ─── Pauldron ─────────────────────────────────────────────────────────────

  private drawPauldron(
    g: Graphics,
    fc: FitmentCorners,
    isoX: number,
    p: ModelPalette,
    sz: number,
    wf: number,
    facingCamera: boolean,
    nearSide: "L" | "R",
    s: number,
  ): void {
    // Pauldrons sit at the top corners of the torso
    for (const side of [-1, 1] as const) {
      const isRight = side === 1;
      // Top corner of torso on this side
      const topCorner = isRight ? fc.tr : fc.tl;
      // Pauldron extends outward and slightly upward from the shoulder
      const outX  = topCorner.x + side * 4.5 * sz * wf;
      const topY  = topCorner.y - 1.5 * sz;
      const botY  = topCorner.y + 5.5 * sz;

      // Determine if this side is near or far
      const sideIsNear = (isRight && nearSide === "R") || (!isRight && nearSide === "L");
      const col = sideIsNear ? p.body : darken(p.body, 0.1);

      const pFC: FitmentCorners = {
        tl: { x: topCorner.x + side * 0.5, y: topY },
        tr: { x: outX,                      y: topY + 1 },
        bl: { x: topCorner.x + side * 0.5, y: botY },
        br: { x: outX - side * 1.5,         y: botY - 1 },
      };

      if (facingCamera) {
        drawCornerQuad(g, pFC, 0, col, p.outline, 0.42, s);
        // Segmentation line (pauldron has 2 plates)
        const segL = quadPoint(pFC, 0.1, 0.55);
        const segR = quadPoint(pFC, 0.9, 0.55);
        g.moveTo(segL.x * s, segL.y * s); g.lineTo(segR.x * s, segR.y * s);
        g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.28 });
        // Rivet
        const riv = quadPoint(pFC, 0.5, 0.25);
        g.circle(riv.x * s, riv.y * s, 0.9 * s); g.fill(p.accent);
        // Lit edge
        if (sideIsNear) {
          g.moveTo(pFC.tl.x * s, pFC.tl.y * s); g.lineTo(pFC.bl.x * s, pFC.bl.y * s);
          g.stroke({ width: s * 1.2, color: p.bodyLt, alpha: 0.22 });
        }
      } else {
        // Back pauldron — rounded, slightly darker, no front rivet details
        drawCornerQuad(g, pFC, 0, darken(col, 0.08), p.outline, 0.38, s);
        const bSeg = { x: (pFC.tl.x + pFC.tr.x) / 2, y: pFC.tl.y + 3 * sz };
        g.ellipse(bSeg.x * s, bSeg.y * s, 2.5 * sz * s, 1 * sz * s);
        g.fill({ color: darken(col, 0.1), alpha: 0.25 });
      }
    }
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
