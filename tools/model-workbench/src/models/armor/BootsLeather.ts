import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";

/**
 * Leather boots — sturdy mid-calf boots with buckle straps.
 */
export class BootsLeather implements Model {
  readonly id = "boots-leather";
  readonly name = "Leather Boots";
  readonly category = "feet" as const;
  readonly slot = "feet-L" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, palette, farSide, nearSide } = ctx;
    const j = skeleton.joints;
    const iso = skeleton.iso;
    const calls: DrawCall[] = [];

    for (const side of [farSide, nearSide]) {
      const d = side === farSide ? 11.5 : 13.5;
      calls.push({ depth: d, draw: (g, s) => this.drawBoot(g, j, iso, palette, s, side) });
    }
    return calls;
  }

  private drawBoot(g: Graphics, j: Record<string, V>, iso: V, p: any, s: number, side: "L" | "R"): void {
    const ankle = j[`ankle${side}`];
    const knee = j[`knee${side}`];
    const color = p.body;
    const dk = p.bodyDk;
    const accent = p.accent;

    // Boot shaft (extends up the calf)
    const shaftTopY = ankle.y - 5;
    const shaftTopX = ankle.x + (knee.x - ankle.x) * 0.3;
    g.roundRect((shaftTopX - 3) * s, shaftTopY * s, 6 * s, (ankle.y - shaftTopY + 1) * s, 1 * s);
    g.fill(color);
    g.roundRect((shaftTopX - 3) * s, shaftTopY * s, 6 * s, (ankle.y - shaftTopY + 1) * s, 1 * s);
    g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.35 });

    // Boot top fold
    g.ellipse(shaftTopX * s, shaftTopY * s, 3.2 * s, 1.2 * s);
    g.fill(dk);

    // Buckle strap
    const strapY = shaftTopY + 3;
    g.rect((shaftTopX - 2.8) * s, (strapY - 0.5) * s, 5.6 * s, 1.2 * s);
    g.fill(accent);
    // Buckle
    g.rect((shaftTopX + 1) * s, (strapY - 0.7) * s, 1.5 * s, 1.5 * s);
    g.fill(p.accentDk);

    // Foot
    const footLen = 4.5;
    const fwdX = iso.x * footLen;
    const fwdY = iso.y * footLen * 0.5;
    const tipX = ankle.x + fwdX;
    const tipY = ankle.y + fwdY + 1.8;

    const fdx = tipX - ankle.x;
    const fdy = tipY - ankle.y;
    const flen = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
    const pnx = -fdy / flen;
    const pny = fdx / flen;
    const hw = 2.5;
    const tw = 1.5;

    g.moveTo((ankle.x + pnx * hw) * s, (ankle.y + pny * hw) * s);
    g.lineTo((tipX + pnx * tw) * s, (tipY + pny * tw) * s);
    g.quadraticCurveTo(
      (tipX + fdx / flen * 1.8) * s, (tipY + fdy / flen * 1.2) * s,
      (tipX - pnx * tw) * s, (tipY - pny * tw) * s
    );
    g.lineTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.closePath();
    g.fill(color);
    g.moveTo((ankle.x + pnx * hw) * s, (ankle.y + pny * hw) * s);
    g.lineTo((tipX + pnx * tw) * s, (tipY + pny * tw) * s);
    g.quadraticCurveTo(
      (tipX + fdx / flen * 1.8) * s, (tipY + fdy / flen * 1.2) * s,
      (tipX - pnx * tw) * s, (tipY - pny * tw) * s
    );
    g.lineTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.closePath();
    g.stroke({ width: s * 0.4, color: p.outline, alpha: 0.35 });

    // Sole line
    g.moveTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
    g.lineTo((tipX - pnx * tw) * s, (tipY - pny * tw) * s);
    g.stroke({ width: s * 0.6, color: dk, alpha: 0.4 });
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }
}
