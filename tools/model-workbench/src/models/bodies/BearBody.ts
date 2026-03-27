import type { Graphics } from "pixi.js";
import type {
  Model,
  RenderContext,
  DrawCall,
  AttachmentPoint,
  V,
} from "../types";
import { darken, lighten } from "../palette";

/**
 * Bear NPC — large four-legged predator.
 * Broad shoulders, heavy build, thick fur, small rounded ears.
 * Bigger and bulkier than wolf. Lumbering gait.
 * CANNOT hold weapons.
 */
export class BearBody implements Model {
  readonly id = "bear-body";
  readonly name = "Bear";
  readonly category = "npc" as const;
  readonly slot = "root" as const;

  private readonly FUR = 0x6a5040;     // brown
  private readonly FUR_DK = 0x4a3020;  // dark brown
  private readonly FUR_LT = 0x8a7060;  // light brown
  private readonly SNOUT = 0x9a8070;   // lighter muzzle
  private readonly NOSE = 0x1a1a1a;
  private readonly EYE = 0x221100;     // very dark

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton } = ctx;
    const { iso, bob, walkPhase, wf } = skeleton;
    const faceCam = iso.y > 0;
    const sideView = Math.abs(iso.x) > 0.3;

    const lumber = walkPhase !== 0 ? Math.sin(walkPhase) : 0;
    const bodyBob = walkPhase !== 0 ? Math.abs(Math.sin(walkPhase * 2)) * 2 : 0;
    const bodyRoll = walkPhase !== 0 ? Math.sin(walkPhase) * 0.8 : 0;

    const bodyX = iso.x * 2 + bodyRoll;
    const bodyY = -10 + bob - bodyBob;
    const headX = bodyX + iso.x * 12 + iso.y * 2;
    const headY = bodyY - 2;

    const calls: DrawCall[] = [];

    // Shadow (large)
    calls.push({
      depth: 0,
      draw: (g, s) => {
        g.ellipse(bodyX * s, 2 * s, 16 * s, 5.5 * s);
        g.fill({ color: 0x000000, alpha: 0.18 });
      },
    });

    // Stub tail
    calls.push({
      depth: 3,
      draw: (g, s) => {
        const tx = bodyX - iso.x * 12;
        const ty = bodyY - 3;
        g.circle(tx * s, ty * s, 2.5 * s);
        g.fill(this.FUR);
        g.circle(tx * s, ty * s, 2.5 * s);
        g.stroke({ width: s * 0.3, color: this.FUR_DK, alpha: 0.2 });
      },
    });

    // Back legs
    calls.push({
      depth: 6,
      draw: (g, s) => this.drawBackLegs(g, bodyX, bodyY, iso, lumber, wf, s),
    });

    // Body (massive)
    calls.push({
      depth: 20,
      draw: (g, s) => {
        // Large barrel body
        g.ellipse(bodyX * s, bodyY * s, 15 * wf * s, 9 * s);
        g.fill(this.FUR);

        // Underbelly
        if (faceCam) {
          g.ellipse(bodyX * s, (bodyY + 4) * s, 10 * wf * s, 5 * s);
          g.fill({ color: this.FUR_LT, alpha: 0.25 });
        }

        // Shoulder hump (bears have a distinctive hump)
        g.ellipse((bodyX + iso.x * 4) * s, (bodyY - 4) * s, 8 * wf * s, 5 * s);
        g.fill(this.FUR);
        g.ellipse((bodyX + iso.x * 4) * s, (bodyY - 4) * s, 8 * wf * s, 5 * s);
        g.stroke({ width: s * 0.3, color: this.FUR_DK, alpha: 0.15 });

        // Fur texture lines
        for (let i = 0; i < 4; i++) {
          const fx = bodyX + (i - 1.5) * 4 * wf;
          g.moveTo(fx * s, (bodyY - 5) * s);
          g.quadraticCurveTo((fx + 0.5) * s, bodyY * s, (fx - 0.3) * s, (bodyY + 4) * s);
          g.stroke({ width: s * 0.3, color: this.FUR_DK, alpha: 0.08 });
        }

        // Outline
        g.ellipse(bodyX * s, bodyY * s, 15 * wf * s, 9 * s);
        g.stroke({ width: s * 0.5, color: this.FUR_DK, alpha: 0.3 });
      },
    });

    // Front legs
    calls.push({
      depth: 25,
      draw: (g, s) => this.drawFrontLegs(g, bodyX, bodyY, iso, lumber, wf, s),
    });

    // Head
    calls.push({
      depth: 40,
      draw: (g, s) => {
        // Thick neck
        const neckMidX = (bodyX + headX) / 2 + iso.x * 2;
        const neckMidY = (bodyY + headY) / 2;
        g.moveTo((bodyX + iso.x * 8) * s, (bodyY - 5) * s);
        g.quadraticCurveTo(neckMidX * s, (neckMidY - 3) * s, headX * s, (headY + 3) * s);
        g.quadraticCurveTo(neckMidX * s, (neckMidY + 4) * s, (bodyX + iso.x * 8) * s, (bodyY + 2) * s);
        g.closePath();
        g.fill(this.FUR);

        // Head (broad, rounded)
        const headW = 8 * wf;
        const headH = 6.5;
        g.ellipse(headX * s, headY * s, headW * s, headH * s);
        g.fill(this.FUR);
        g.ellipse(headX * s, headY * s, headW * s, headH * s);
        g.stroke({ width: s * 0.5, color: this.FUR_DK, alpha: 0.3 });

        // Muzzle
        const muzzleX = headX + iso.x * 5 + iso.y * 1.5;
        const muzzleY = headY + 2;
        g.ellipse(muzzleX * s, muzzleY * s, 4.5 * wf * s, 3.5 * s);
        g.fill(this.SNOUT);
        g.ellipse(muzzleX * s, muzzleY * s, 4.5 * wf * s, 3.5 * s);
        g.stroke({ width: s * 0.4, color: this.FUR_DK, alpha: 0.25 });

        // Rounded ears
        this.drawEars(g, headX, headY, iso, wf, headH, s);

        // Eyes (small, dark)
        if (faceCam || (sideView && iso.y >= -0.1)) {
          const spread = 3 * wf;
          const eyeY = headY - 0.5 + iso.y * 0.3;
          const eyeOX = headX + iso.x * 2;

          g.circle((eyeOX - spread) * s, eyeY * s, 1.2 * s);
          g.fill(this.EYE);
          g.circle((eyeOX + spread) * s, eyeY * s, 1.2 * s);
          g.fill(this.EYE);

          // Eye highlight
          g.circle((eyeOX - spread + 0.3) * s, (eyeY - 0.3) * s, 0.4 * s);
          g.fill({ color: 0xffffff, alpha: 0.3 });
          g.circle((eyeOX + spread + 0.3) * s, (eyeY - 0.3) * s, 0.4 * s);
          g.fill({ color: 0xffffff, alpha: 0.3 });
        }

        // Nose
        if (faceCam || sideView) {
          const noseX = muzzleX + iso.x * 2.5;
          const noseY = muzzleY - 0.8;
          g.ellipse(noseX * s, noseY * s, 1.8 * wf * s, 1.2 * s);
          g.fill(this.NOSE);
        }

        // Mouth
        if (faceCam) {
          g.moveTo((muzzleX - 2 * wf) * s, (muzzleY + 1.5) * s);
          g.quadraticCurveTo(muzzleX * s, (muzzleY + 2.2) * s, (muzzleX + 2 * wf) * s, (muzzleY + 1.5) * s);
          g.stroke({ width: s * 0.5, color: this.FUR_DK, alpha: 0.35 });
        }
      },
    });

    return calls;
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }

  // ─── EARS ────────────────────────────────────────────────────────

  private drawEars(g: Graphics, headX: number, headY: number, iso: V, wf: number, headH: number, s: number): void {
    for (const side of [-1, 1]) {
      const earX = headX + side * 4.5 * wf + iso.x * 1;
      const earY = headY - headH + 1;

      // Rounded bear ears
      g.circle(earX * s, earY * s, 2.2 * s);
      g.fill(this.FUR);
      g.circle(earX * s, earY * s, 2.2 * s);
      g.stroke({ width: s * 0.3, color: this.FUR_DK, alpha: 0.25 });

      // Inner ear
      g.circle(earX * s, earY * s, 1.3 * s);
      g.fill(darken(this.FUR, 0.1));
    }
  }

  // ─── FRONT LEGS ──────────────────────────────────────────────────

  private drawFrontLegs(g: Graphics, bodyX: number, bodyY: number, iso: V, lumber: number, wf: number, s: number): void {
    for (const side of [-1, 1]) {
      const legX = bodyX + side * 6 * wf + iso.x * 7;
      const shoulderY = bodyY + 3;
      const stride = lumber * side * 2.5;

      // Thick upper leg
      const kneeX = legX + iso.x * stride * 0.3;
      const kneeY = shoulderY + 7;
      g.moveTo(legX * s, shoulderY * s);
      g.lineTo(kneeX * s, kneeY * s);
      g.stroke({ width: s * 5, color: this.FUR });
      g.moveTo(legX * s, shoulderY * s);
      g.lineTo(kneeX * s, kneeY * s);
      g.stroke({ width: s * 0.8, color: this.FUR_DK, alpha: 0.15 });

      // Lower leg
      const pawX = kneeX + iso.x * stride * 0.4;
      const pawY = kneeY + 5 - Math.abs(lumber * side) * 1;
      g.moveTo(kneeX * s, kneeY * s);
      g.lineTo(pawX * s, pawY * s);
      g.stroke({ width: s * 4, color: this.FUR });

      // Big paw
      g.ellipse(pawX * s, (pawY + 0.8) * s, 3 * s, 1.5 * s);
      g.fill(this.FUR_DK);

      // Claws
      for (let c = -1; c <= 1; c++) {
        const clawX = pawX + c * 1.2 + iso.x * 1;
        g.moveTo(clawX * s, (pawY + 1) * s);
        g.lineTo((clawX + iso.x * 0.8) * s, (pawY + 2) * s);
        g.stroke({ width: s * 0.5, color: 0x333322 });
      }
    }
  }

  // ─── BACK LEGS ───────────────────────────────────────────────────

  private drawBackLegs(g: Graphics, bodyX: number, bodyY: number, iso: V, lumber: number, wf: number, s: number): void {
    for (const side of [-1, 1]) {
      const legX = bodyX + side * 6 * wf - iso.x * 7;
      const hipY = bodyY + 3;
      const stride = -lumber * side * 2.5;

      // Haunch (big)
      g.ellipse((legX + side * 2 * wf) * s, (hipY + 1) * s, 5.5 * wf * s, 5.5 * s);
      g.fill(this.FUR);
      g.ellipse((legX + side * 2 * wf) * s, (hipY + 1) * s, 5.5 * wf * s, 5.5 * s);
      g.stroke({ width: s * 0.3, color: this.FUR_DK, alpha: 0.12 });

      // Upper back leg
      const kneeX = legX + iso.x * stride * 0.3;
      const kneeY = hipY + 7;
      g.moveTo(legX * s, (hipY + 4) * s);
      g.lineTo(kneeX * s, kneeY * s);
      g.stroke({ width: s * 5, color: this.FUR });

      // Hock
      const hockX = kneeX - iso.x * 0.8;
      const hockY = kneeY + 3;
      g.moveTo(kneeX * s, kneeY * s);
      g.lineTo(hockX * s, hockY * s);
      g.stroke({ width: s * 4, color: this.FUR });

      // Lower + paw
      const pawX = hockX + iso.x * stride * 0.3;
      const pawY = hockY + 3 - Math.abs(lumber * side) * 1.5;
      g.moveTo(hockX * s, hockY * s);
      g.lineTo(pawX * s, pawY * s);
      g.stroke({ width: s * 3.5, color: this.FUR });

      g.ellipse(pawX * s, (pawY + 0.8) * s, 3 * s, 1.5 * s);
      g.fill(this.FUR_DK);

      // Claws
      for (let c = -1; c <= 1; c++) {
        const clawX = pawX + c * 1.2 + iso.x * 0.8;
        g.moveTo(clawX * s, (pawY + 1) * s);
        g.lineTo((clawX + iso.x * 0.8) * s, (pawY + 2) * s);
        g.stroke({ width: s * 0.5, color: 0x333322 });
      }
    }
  }
}
