import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, AttachmentPoint, V } from "../types";
import { darken, lighten } from "../palette";

/**
 * Elder Bear — boss variant of Bear.
 * Massive, silver-tipped fur, scarred, glowing eyes, grizzled.
 */
export class ElderBear implements Model {
  readonly id = "elder-bear";
  readonly name = "Elder Bear";
  readonly category = "npc" as const;
  readonly slot = "root" as const;

  private readonly FUR = 0x5a4838;     // darker brown
  private readonly FUR_DK = 0x3a2818;
  private readonly FUR_LT = 0x7a6858;
  private readonly SILVER = 0xa0a0a0;  // silver-tipped
  private readonly SNOUT = 0x8a7868;
  private readonly NOSE = 0x111111;
  private readonly EYE = 0xcc8822;
  private readonly SCAR = 0x884444;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton } = ctx;
    const { iso, bob, walkPhase, wf } = skeleton;
    const faceCam = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;

    const SC = 1.35;
    const lumber = walkPhase !== 0 ? Math.sin(walkPhase) : 0;
    const bodyBob = walkPhase !== 0 ? Math.abs(Math.sin(walkPhase * 2)) * 2 : 0;
    const bodyRoll = walkPhase !== 0 ? Math.sin(walkPhase) * 1 : 0;

    const bodyX = iso.x * 2 + bodyRoll;
    const bodyY = -10 * SC + bob - bodyBob;
    const headX = bodyX + iso.x * 12 * SC + iso.y * 2;
    const headY = bodyY - 2 * SC;

    const calls: DrawCall[] = [];

    // Boss aura
    calls.push({ depth: -1, draw: (g, s) => {
      g.ellipse(bodyX * s, (bodyY - 2) * s, 20 * SC * s, 16 * SC * s);
      g.fill({ color: 0x443322, alpha: 0.04 });
    }});

    // Shadow
    calls.push({ depth: 0, draw: (g, s) => {
      g.ellipse(bodyX * s, 2 * s, 18 * SC * s, 6 * SC * s);
      g.fill({ color: 0x000000, alpha: 0.2 });
    }});

    // Stub tail
    calls.push({ depth: 3, draw: (g, s) => {
      const tx = bodyX - iso.x * 13 * SC;
      const ty = bodyY - 3 * SC;
      g.circle(tx * s, ty * s, 3 * SC * s);
      g.fill(this.FUR);
    }});

    // Back legs
    calls.push({ depth: 6, draw: (g, s) => this.drawLegs(g, bodyX, bodyY, iso, lumber, wf, SC, s, false) });

    // Body
    calls.push({ depth: 20, draw: (g, s) => {
      g.ellipse(bodyX * s, bodyY * s, 16 * wf * SC * s, 10 * SC * s);
      g.fill(this.FUR);

      if (faceCam) {
        g.ellipse(bodyX * s, (bodyY + 4 * SC) * s, 11 * wf * SC * s, 6 * SC * s);
        g.fill({ color: this.FUR_LT, alpha: 0.2 });
      }

      // Massive shoulder hump
      g.ellipse((bodyX + iso.x * 4 * SC) * s, (bodyY - 5 * SC) * s, 9 * wf * SC * s, 6 * SC * s);
      g.fill(this.FUR);

      // Silver-tipped fur on shoulders
      g.ellipse((bodyX + iso.x * 4 * SC) * s, (bodyY - 6 * SC) * s, 7 * wf * SC * s, 3 * SC * s);
      g.fill({ color: this.SILVER, alpha: 0.15 });

      // Battle scars
      g.moveTo((bodyX - 6 * SC) * s, (bodyY - 4 * SC) * s);
      g.quadraticCurveTo(bodyX * s, (bodyY - 2 * SC) * s, (bodyX + 7 * SC) * s, (bodyY - 5 * SC) * s);
      g.stroke({ width: s * 0.8, color: this.SCAR, alpha: 0.25 });
      g.moveTo((bodyX - 3 * SC) * s, (bodyY + 2 * SC) * s);
      g.lineTo((bodyX + 4 * SC) * s, (bodyY - 1 * SC) * s);
      g.stroke({ width: s * 0.6, color: this.SCAR, alpha: 0.2 });

      g.ellipse(bodyX * s, bodyY * s, 16 * wf * SC * s, 10 * SC * s);
      g.stroke({ width: s * 0.6, color: this.FUR_DK, alpha: 0.3 });
    }});

    // Front legs
    calls.push({ depth: 25, draw: (g, s) => this.drawLegs(g, bodyX, bodyY, iso, lumber, wf, SC, s, true) });

    // Head
    calls.push({ depth: 40, draw: (g, s) => {
      // Thick neck
      const neckMidX = (bodyX + headX) / 2 + iso.x * 2;
      const neckMidY = (bodyY + headY) / 2;
      g.moveTo((bodyX + iso.x * 8 * SC) * s, (bodyY - 6 * SC) * s);
      g.quadraticCurveTo(neckMidX * s, (neckMidY - 4) * s, headX * s, (headY + 3 * SC) * s);
      g.quadraticCurveTo(neckMidX * s, (neckMidY + 5) * s, (bodyX + iso.x * 8 * SC) * s, (bodyY + 3 * SC) * s);
      g.closePath();
      g.fill(this.FUR);

      // Silver mane
      g.ellipse(neckMidX * s, (neckMidY - 2) * s, 6 * wf * SC * s, 5 * SC * s);
      g.fill({ color: this.SILVER, alpha: 0.12 });

      // Head
      const headW = 9 * wf * SC;
      const headH = 7 * SC;
      g.ellipse(headX * s, headY * s, headW * s, headH * s);
      g.fill(this.FUR);

      // Muzzle
      const snoutX = headX + iso.x * 5 * SC + iso.y * 1.5;
      const snoutY = headY + 2 * SC;
      g.ellipse(snoutX * s, snoutY * s, 5 * wf * SC * s, 4 * SC * s);
      g.fill(this.SNOUT);

      // Face scar
      g.moveTo((headX - 4 * SC) * s, (headY - 3 * SC) * s);
      g.lineTo((headX + 1 * SC) * s, (headY + 2 * SC) * s);
      g.stroke({ width: s * 0.7, color: this.SCAR, alpha: 0.3 });

      g.ellipse(headX * s, headY * s, headW * s, headH * s);
      g.stroke({ width: s * 0.6, color: this.FUR_DK, alpha: 0.3 });

      // Rounded ears
      for (const side of [-1, 1]) {
        const earX = headX + side * 5 * wf * SC + iso.x * 1;
        const earY = headY - headH + 1.5 * SC;
        g.circle(earX * s, earY * s, 2.5 * SC * s);
        g.fill(this.FUR);
        // Torn ear (boss detail)
        if (side === 1) {
          g.moveTo((earX + 1) * s, (earY - 1.5 * SC) * s);
          g.lineTo((earX + 2) * s, (earY + 0.5 * SC) * s);
          g.stroke({ width: s * 0.5, color: this.SCAR, alpha: 0.3 });
        }
      }

      // Glowing eyes
      if (faceCam || (sideView && iso.y >= -0.1)) {
        const spread = 3.5 * wf * SC;
        const eyeY = headY - 0.5 * SC + iso.y * 0.3;
        const eyeOX = headX + iso.x * 2 * SC;
        g.circle((eyeOX - spread) * s, eyeY * s, 1.5 * SC * s);
        g.fill(this.EYE);
        g.circle((eyeOX + spread) * s, eyeY * s, 1.5 * SC * s);
        g.fill(this.EYE);
        g.circle((eyeOX - spread + 0.3) * s, (eyeY - 0.3) * s, 0.5 * SC * s);
        g.fill({ color: 0xffffff, alpha: 0.3 });
        g.circle((eyeOX + spread + 0.3) * s, (eyeY - 0.3) * s, 0.5 * SC * s);
        g.fill({ color: 0xffffff, alpha: 0.3 });

        // Eye glow
        g.circle((eyeOX - spread) * s, eyeY * s, 2.5 * SC * s);
        g.fill({ color: this.EYE, alpha: 0.08 });
        g.circle((eyeOX + spread) * s, eyeY * s, 2.5 * SC * s);
        g.fill({ color: this.EYE, alpha: 0.08 });
      }

      // Nose + snarl
      if (faceCam || sideView) {
        const noseX = snoutX + iso.x * 2.5 * SC;
        g.ellipse(noseX * s, (snoutY - 0.8) * s, 2 * wf * SC * s, 1.5 * SC * s);
        g.fill(this.NOSE);
      }
    }});

    return calls;
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> { return {}; }

  private drawLegs(g: Graphics, bodyX: number, bodyY: number, iso: V, lumber: number, wf: number, SC: number, s: number, front: boolean): void {
    for (const side of [-1, 1]) {
      const legX = bodyX + side * 7 * wf * SC + iso.x * (front ? 8 : -8) * SC;
      const topY = bodyY + 3 * SC;
      const stride = (front ? 1 : -1) * lumber * side * 3 * SC;

      if (!front) {
        g.ellipse((legX + side * 2.5 * wf * SC) * s, (topY + 1 * SC) * s, 6 * wf * SC * s, 6 * SC * s);
        g.fill(this.FUR);
      }

      const kneeX = legX + iso.x * stride * 0.3;
      const kneeY = topY + 7 * SC;
      g.moveTo(legX * s, (topY + (front ? 0 : 4 * SC)) * s);
      g.lineTo(kneeX * s, kneeY * s);
      g.stroke({ width: s * 6 * SC, color: this.FUR });

      if (!front) {
        const hockX = kneeX - iso.x * 1;
        const hockY = kneeY + 3.5 * SC;
        g.moveTo(kneeX * s, kneeY * s);
        g.lineTo(hockX * s, hockY * s);
        g.stroke({ width: s * 5 * SC, color: this.FUR });
        const pawX = hockX + iso.x * stride * 0.2;
        const pawY = hockY + 3.5 * SC - Math.abs(lumber * side) * 1.5;
        g.moveTo(hockX * s, hockY * s);
        g.lineTo(pawX * s, pawY * s);
        g.stroke({ width: s * 4 * SC, color: this.FUR });
        g.ellipse(pawX * s, (pawY + 1) * s, 3.5 * SC * s, 1.8 * SC * s);
        g.fill(this.FUR_DK);
      } else {
        const pawX = kneeX + iso.x * stride * 0.5;
        const pawY = kneeY + 6 * SC - Math.abs(lumber * side) * 1;
        g.moveTo(kneeX * s, kneeY * s);
        g.lineTo(pawX * s, pawY * s);
        g.stroke({ width: s * 5 * SC, color: this.FUR });
        g.ellipse(pawX * s, (pawY + 1) * s, 3.5 * SC * s, 1.8 * SC * s);
        g.fill(this.FUR_DK);

        // Claws (bigger)
        for (let c = -1; c <= 1; c++) {
          g.moveTo((pawX + c * 1.5 * SC + iso.x * 1) * s, (pawY + 1.2) * s);
          g.lineTo((pawX + c * 1.5 * SC + iso.x * 2) * s, (pawY + 2.5) * s);
          g.stroke({ width: s * 0.6, color: 0x333322 });
        }
      }
    }
  }
}
