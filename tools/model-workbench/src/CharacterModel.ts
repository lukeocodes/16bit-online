import { Graphics } from "pixi.js";

// ─── Types ──────────────────────────────────────────────────────────

export type ArmorType = "none" | "cloth" | "leather" | "mail" | "plate";
export type WeaponType =
  | "none"
  | "sword"
  | "axe"
  | "mace"
  | "spear"
  | "bow"
  | "staff"
  | "wand"
  | "dagger";
export type OffhandType = "none" | "shield" | "tome" | "dagger";

export interface CharacterColors {
  skin: number;
  hair: number;
  eyes: number;
  primary: number;
  secondary: number;
}

export interface CharacterConfig {
  colors: CharacterColors;
  armor: ArmorType;
  weapon: WeaponType;
  offhand: OffhandType;
}

export const DEFAULT_CONFIG: CharacterConfig = {
  colors: {
    skin: 0xf0c8a0,
    hair: 0x5c3a1e,
    eyes: 0x334455,
    primary: 0x4466aa,
    secondary: 0x886633,
  },
  armor: "leather",
  weapon: "sword",
  offhand: "shield",
};

export const DIRECTION_NAMES = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"];
export const DIRECTION_COUNT = 8;
export const FRAME_W = 48;
export const FRAME_H = 64;

// ─── Iso direction offsets ──────────────────────────────────────────

const ISO: Array<{ x: number; y: number }> = [
  { x: 0, y: 0.5 },
  { x: -0.4, y: 0.3 },
  { x: -0.5, y: 0 },
  { x: -0.4, y: -0.3 },
  { x: 0, y: -0.5 },
  { x: 0.4, y: -0.3 },
  { x: 0.5, y: 0 },
  { x: 0.4, y: 0.3 },
];

// ─── Pose ───────────────────────────────────────────────────────────

interface V {
  x: number;
  y: number;
}

interface Pose {
  head: V;
  neckBase: V;
  shoulderL: V;
  shoulderR: V;
  chestL: V;
  chestR: V;
  waistL: V;
  waistR: V;
  hipL: V;
  hipR: V;
  elbowL: V;
  elbowR: V;
  wristL: V;
  wristR: V;
  kneeL: V;
  kneeR: V;
  ankleL: V;
  ankleR: V;
  toeL: V;
  toeR: V;
  /** Pelvis bottom center — where legs visually split */
  crotch: V;
  bob: number;
  wf: number; // width factor (perspective squish)
  iso: { x: number; y: number };
}

function computePose(dir: number, walkPhase: number): Pose {
  const iso = ISO[dir] ?? ISO[0];
  const w = walkPhase !== 0;
  const swing = w ? Math.sin(walkPhase) : 0;
  const bob = w ? -Math.abs(Math.sin(walkPhase * 2)) * 1.6 : 0;

  // Perspective width factor
  const wf = 1 - Math.abs(iso.x) * 0.35;
  // Lean
  const lx = iso.x * 2.5;
  const ly = iso.y * 1.2;

  // Subtle hip rotation during walk — shoulders counter-rotate
  const hipRot = w ? swing * 0.06 : 0;

  // Leg swing along facing direction
  const lsFwd = swing * 4.5;
  const lsBck = -swing * 4.5;
  const armFwd = -swing * 3.5;
  const armBck = swing * 3.5;

  // Forward-to-screen mapping
  const fwdX = iso.y;
  const fwdY = -Math.abs(iso.x) * 0.6;

  // Foot lift for the trailing leg
  const liftL = swing > 0.2 ? -(swing - 0.2) * 2.5 : 0;
  const liftR = swing < -0.2 ? (swing + 0.2) * 2.5 : 0;

  // Elbow bend during swing
  const elbowBendL = w ? Math.max(0, -swing) * 2.5 : 0;
  const elbowBendR = w ? Math.max(0, swing) * 2.5 : 0;

  const p = (bx: number, by: number, offX = 0, offY = 0): V => ({
    x: bx * wf + lx + offX,
    y: by + bob + ly * 0.3 + offY,
  });

  // ── Proportions based on anatomy ratios ──
  // H = 14px (head diameter). Figure is ~3.5H tall.
  // Shoulder width: 2Hw = 17px (±8.5)
  // Hip width: 65% of shoulders = 11px (±5.5)
  // Waist: slightly narrower than hips = 10px (±5)
  // Leg gap: ~12% of hip width = ~1.3px per side
  // Thigh: 8px wide at hip → inner edge at ±1.5 from center
  // Legs angle inward: knees ±3, ankles ±2.5

  return {
    head: p(0, -39),
    neckBase: p(0, -32),
    shoulderL: p(-8.5 - hipRot * 5, -29),
    shoulderR: p(8.5 + hipRot * 5, -29),
    chestL: p(-8, -28),
    chestR: p(8, -28),
    waistL: p(-5, -20),
    waistR: p(5, -20),
    hipL: p(-5.5 + hipRot * 2, -16.5),
    hipR: p(5.5 - hipRot * 2, -16.5),
    crotch: p(0, -15.5),
    // Arms — hang just outside shoulder line
    elbowL: p(-9.5, -23, armFwd * fwdX * 0.5, armFwd * fwdY * 0.5 - elbowBendL),
    elbowR: p(9.5, -23, armBck * fwdX * 0.5, armBck * fwdY * 0.5 - elbowBendR),
    wristL: p(-8.5, -15.5, armFwd * fwdX, armFwd * fwdY),
    wristR: p(8.5, -15.5, armBck * fwdX, armBck * fwdY),
    // Legs — angle inward from hip to ankle
    kneeL: p(-3, -6.5, lsFwd * fwdX * 0.5, lsFwd * fwdY * 0.3),
    kneeR: p(3, -6.5, lsBck * fwdX * 0.5, lsBck * fwdY * 0.3),
    ankleL: p(-2.5, -1.5, lsFwd * fwdX * 0.8, lsFwd * fwdY * 0.5 + liftL),
    ankleR: p(2.5, -1.5, lsBck * fwdX * 0.8, lsBck * fwdY * 0.5 + liftR),
    toeL: p(-2, 1, lsFwd * fwdX * 0.3, lsFwd * fwdY * 0.2 + liftL * 0.5),
    toeR: p(2, 1, lsBck * fwdX * 0.3, lsBck * fwdY * 0.2 + liftR * 0.5),
    bob,
    wf,
    iso,
  };
}

// ─── Color helpers ──────────────────────────────────────────────────

function darken(c: number, a: number): number {
  const r = Math.max(0, ((c >> 16) & 0xff) * (1 - a)) | 0;
  const g = Math.max(0, ((c >> 8) & 0xff) * (1 - a)) | 0;
  const b = Math.max(0, (c & 0xff) * (1 - a)) | 0;
  return (r << 16) | (g << 8) | b;
}

function lighten(c: number, a: number): number {
  const r = Math.min(255, ((c >> 16) & 0xff) + 255 * a) | 0;
  const g = Math.min(255, ((c >> 8) & 0xff) + 255 * a) | 0;
  const b = Math.min(255, (c & 0xff) + 255 * a) | 0;
  return (r << 16) | (g << 8) | b;
}

// ─── Armor palette ──────────────────────────────────────────────────

interface APal {
  body: number;
  bodyDk: number;
  bodyLt: number;
  accent: number;
  accentDk: number;
  outline: number;
}

function armorPal(cfg: CharacterConfig): APal {
  const { primary, secondary, skin } = cfg.colors;
  switch (cfg.armor) {
    case "none":
      return {
        body: skin,
        bodyDk: darken(skin, 0.2),
        bodyLt: lighten(skin, 0.1),
        accent: darken(skin, 0.15),
        accentDk: darken(skin, 0.3),
        outline: darken(skin, 0.35),
      };
    case "cloth":
      return {
        body: primary,
        bodyDk: darken(primary, 0.2),
        bodyLt: lighten(primary, 0.12),
        accent: secondary,
        accentDk: darken(secondary, 0.25),
        outline: darken(primary, 0.45),
      };
    case "leather":
      return {
        body: 0x8b6914,
        bodyDk: 0x6b4e0e,
        bodyLt: 0xa07b1a,
        accent: 0x5c4510,
        accentDk: 0x3d2e0a,
        outline: 0x3a2a08,
      };
    case "mail":
      return {
        body: 0x8888a0,
        bodyDk: 0x666680,
        bodyLt: 0xa0a0b8,
        accent: 0x6b4e12,
        accentDk: 0x4a350c,
        outline: 0x44445a,
      };
    case "plate":
      return {
        body: 0xaab0c0,
        bodyDk: 0x7880a0,
        bodyLt: 0xc8d0e0,
        accent: 0x8890a8,
        accentDk: 0x606880,
        outline: 0x505868,
      };
  }
}

// ─── Draw call system ───────────────────────────────────────────────

interface DC {
  d: number;
  fn: () => void;
}

// ─── MAIN RENDER ────────────────────────────────────────────────────

export function renderCharacter(
  g: Graphics,
  cfg: CharacterConfig,
  dir: number,
  walkPhase: number,
  s: number = 1
): void {
  const pose = computePose(dir, walkPhase);
  const ap = armorPal(cfg);
  const iso = pose.iso;
  const leftIsFar = iso.x >= 0;
  const faceCam = iso.y > 0;

  const farSide = leftIsFar ? "L" : "R";
  const nearSide = leftIsFar ? "R" : "L";

  const calls: DC[] = [];

  // Shadow
  calls.push({
    d: 0,
    fn: () => {
      g.ellipse(0, 2 * s, 13 * s, 5 * s);
      g.fill({ color: 0x000000, alpha: 0.2 });
    },
  });

  // Far leg
  calls.push({ d: 10, fn: () => drawLeg(g, pose, cfg, ap, s, farSide) });
  // Far foot
  calls.push({ d: 11, fn: () => drawFoot(g, pose, cfg, ap, s, farSide) });

  // Far arm (behind torso when facing camera)
  calls.push({
    d: faceCam ? 20 : 45,
    fn: () => drawArm(g, pose, cfg, ap, s, farSide),
  });

  // Shield on far arm
  if (cfg.offhand === "shield") {
    calls.push({
      d: faceCam ? 18 : 48,
      fn: () => drawShield(g, pose, cfg, s, farSide),
    });
  }

  // Glutes — round shapes between legs and torso, back views only
  if (!faceCam) {
    calls.push({ d: 25, fn: () => drawGlutes(g, pose, cfg, ap, s) });
  }

  // Torso (includes pelvis bridge to legs)
  calls.push({ d: 30, fn: () => drawTorso(g, pose, cfg, ap, s) });

  // Pelvis/crotch fill — bridges body to legs, covers far leg top
  calls.push({ d: 32, fn: () => drawPelvis(g, pose, cfg, ap, s) });

  // Armor overlay on torso
  calls.push({ d: 33, fn: () => drawArmorOverlay(g, pose, cfg, ap, s) });

  // Near leg — always behind torso
  calls.push({ d: 12, fn: () => drawLeg(g, pose, cfg, ap, s, nearSide) });
  calls.push({ d: 13, fn: () => drawFoot(g, pose, cfg, ap, s, nearSide) });

  // Head
  calls.push({ d: 50, fn: () => drawHead(g, pose, cfg, ap, s) });

  // Near arm (in front when facing camera)
  calls.push({
    d: faceCam ? 55 : 25,
    fn: () => drawArm(g, pose, cfg, ap, s, nearSide),
  });

  // Weapon in near hand
  if (cfg.weapon !== "none") {
    calls.push({
      d: faceCam ? 57 : 23,
      fn: () => drawWeapon(g, pose, cfg, pose.iso, s, nearSide),
    });
  }

  calls.sort((a, b) => a.d - b.d);
  for (const c of calls) c.fn();
}

// ─── TORSO ──────────────────────────────────────────────────────────

function drawTorso(
  g: Graphics,
  p: Pose,
  cfg: CharacterConfig,
  ap: APal,
  s: number
): void {
  // Shaped torso: shoulders → chest curve → waist → hips
  const { chestL, chestR, waistL, waistR, hipL, hipR, neckBase } = p;

  // Main torso shape
  g.moveTo(neckBase.x * s, neckBase.y * s);
  g.quadraticCurveTo(chestR.x * s, (chestR.y - 1) * s, chestR.x * s, chestR.y * s);
  g.quadraticCurveTo(
    (chestR.x + 0.5) * s,
    ((chestR.y + waistR.y) / 2) * s,
    waistR.x * s,
    waistR.y * s
  );
  g.quadraticCurveTo(
    (waistR.x + 1) * s,
    ((waistR.y + hipR.y) / 2) * s,
    hipR.x * s,
    hipR.y * s
  );
  g.lineTo(hipL.x * s, hipL.y * s);
  g.quadraticCurveTo(
    (waistL.x - 1) * s,
    ((waistL.y + hipL.y) / 2) * s,
    waistL.x * s,
    waistL.y * s
  );
  g.quadraticCurveTo(
    (chestL.x - 0.5) * s,
    ((chestL.y + waistL.y) / 2) * s,
    chestL.x * s,
    chestL.y * s
  );
  g.quadraticCurveTo(chestL.x * s, (chestL.y - 1) * s, neckBase.x * s, neckBase.y * s);
  g.closePath();
  g.fill(ap.body);

  // Shadow side (right side darkened for volume)
  g.moveTo(neckBase.x * s, neckBase.y * s);
  g.quadraticCurveTo(chestR.x * s, (chestR.y - 1) * s, chestR.x * s, chestR.y * s);
  g.quadraticCurveTo(
    (chestR.x + 0.5) * s,
    ((chestR.y + waistR.y) / 2) * s,
    waistR.x * s,
    waistR.y * s
  );
  g.quadraticCurveTo(
    (waistR.x + 1) * s,
    ((waistR.y + hipR.y) / 2) * s,
    hipR.x * s,
    hipR.y * s
  );
  g.lineTo(((hipR.x + hipL.x) / 2) * s, hipR.y * s);
  g.lineTo(((waistR.x + neckBase.x) / 2) * s, neckBase.y * s);
  g.closePath();
  g.fill({ color: ap.bodyDk, alpha: 0.3 });

  // Outline
  g.moveTo(neckBase.x * s, neckBase.y * s);
  g.quadraticCurveTo(chestR.x * s, (chestR.y - 1) * s, chestR.x * s, chestR.y * s);
  g.quadraticCurveTo(
    (chestR.x + 0.5) * s,
    ((chestR.y + waistR.y) / 2) * s,
    waistR.x * s,
    waistR.y * s
  );
  g.quadraticCurveTo(
    (waistR.x + 1) * s,
    ((waistR.y + hipR.y) / 2) * s,
    hipR.x * s,
    hipR.y * s
  );
  g.lineTo(hipL.x * s, hipL.y * s);
  g.quadraticCurveTo(
    (waistL.x - 1) * s,
    ((waistL.y + hipL.y) / 2) * s,
    waistL.x * s,
    waistL.y * s
  );
  g.quadraticCurveTo(
    (chestL.x - 0.5) * s,
    ((chestL.y + waistL.y) / 2) * s,
    chestL.x * s,
    chestL.y * s
  );
  g.quadraticCurveTo(chestL.x * s, (chestL.y - 1) * s, neckBase.x * s, neckBase.y * s);
  g.closePath();
  g.stroke({ width: s * 0.7, color: ap.outline, alpha: 0.5 });

  // Neck
  const nw = 3 * p.wf;
  g.roundRect((neckBase.x - nw / 2) * s, (neckBase.y - 2) * s, nw * s, 3 * s, 1.5 * s);
  g.fill(cfg.colors.skin);
}

// ─── ARMOR OVERLAY (on torso) ───────────────────────────────────────

function drawArmorOverlay(
  g: Graphics,
  p: Pose,
  cfg: CharacterConfig,
  ap: APal,
  s: number
): void {
  const { waistL, waistR, hipL, hipR, chestL, chestR, neckBase, shoulderL, shoulderR } = p;
  const cx = neckBase.x;

  if (cfg.armor === "plate") {
    // Breastplate center ridge
    g.moveTo(cx * s, (neckBase.y + 1) * s);
    g.lineTo(cx * s, ((waistL.y + hipL.y) / 2) * s);
    g.stroke({ width: s * 1.5, color: ap.bodyLt, alpha: 0.5 });

    // Horizontal plate lines
    const my = (chestL.y + waistL.y) / 2;
    g.moveTo((chestL.x + 2) * s, my * s);
    g.lineTo((chestR.x - 2) * s, my * s);
    g.stroke({ width: s * 0.6, color: ap.bodyDk, alpha: 0.4 });

    // Pauldrons
    drawPauldron(g, shoulderL, s, ap, -1);
    drawPauldron(g, shoulderR, s, ap, 1);

    // Rivets
    const rivY = neckBase.y + 3;
    g.circle((cx - 3 * p.wf) * s, rivY * s, 0.8 * s);
    g.circle((cx + 3 * p.wf) * s, rivY * s, 0.8 * s);
    g.fill(ap.bodyLt);

    // Gorget (neck guard)
    g.ellipse(
      neckBase.x * s,
      (neckBase.y + 0.5) * s,
      4 * p.wf * s,
      2 * s
    );
    g.fill(ap.accent);
    g.ellipse(
      neckBase.x * s,
      (neckBase.y + 0.5) * s,
      4 * p.wf * s,
      2 * s
    );
    g.stroke({ width: s * 0.5, color: ap.outline, alpha: 0.5 });
  }

  if (cfg.armor === "mail") {
    // Chain pattern — horizontal dashed lines
    for (let i = 0; i < 5; i++) {
      const ry = chestL.y + 1 + i * 2.5;
      const lerpT = i / 5;
      const lx = chestL.x + (waistL.x - chestL.x) * lerpT + 1.5;
      const rx = chestR.x + (waistR.x - chestR.x) * lerpT - 1.5;
      g.moveTo(lx * s, ry * s);
      g.lineTo(rx * s, ry * s);
    }
    g.stroke({ width: s * 0.4, color: ap.bodyLt, alpha: 0.35 });

    // Mail skirt below waist
    g.moveTo(waistL.x * s, waistL.y * s);
    g.lineTo((hipL.x - 1.5) * s, (hipL.y + 3) * s);
    g.lineTo((hipR.x + 1.5) * s, (hipR.y + 3) * s);
    g.lineTo(waistR.x * s, waistR.y * s);
    g.closePath();
    g.fill(ap.body);
    g.moveTo(waistL.x * s, waistL.y * s);
    g.lineTo((hipL.x - 1.5) * s, (hipL.y + 3) * s);
    g.lineTo((hipR.x + 1.5) * s, (hipR.y + 3) * s);
    g.lineTo(waistR.x * s, waistR.y * s);
    g.closePath();
    g.stroke({ width: s * 0.5, color: ap.outline, alpha: 0.4 });

    // Zigzag hem
    const hemY = hipL.y + 3;
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const hx = (hipL.x - 1.5) + ((hipR.x + 1.5) - (hipL.x - 1.5)) * t;
      g.circle(hx * s, (hemY + (i % 2) * 1) * s, 0.6 * s);
    }
    g.fill(ap.bodyDk);
  }

  if (cfg.armor === "leather") {
    // Stitching lines down the front
    g.moveTo((cx - 2 * p.wf) * s, (neckBase.y + 2) * s);
    g.lineTo((cx - 2 * p.wf) * s, (hipL.y - 1) * s);
    g.moveTo((cx + 2 * p.wf) * s, (neckBase.y + 2) * s);
    g.lineTo((cx + 2 * p.wf) * s, (hipR.y - 1) * s);
    g.stroke({ width: s * 0.5, color: ap.accentDk, alpha: 0.5 });

    // Belt with buckle
    const beltY = waistL.y + 0.5;
    g.rect(
      (waistL.x + 0.5) * s,
      (beltY - 1) * s,
      (waistR.x - waistL.x - 1) * s,
      2.5 * s
    );
    g.fill(ap.accent);
    g.rect(
      (waistL.x + 0.5) * s,
      (beltY - 1) * s,
      (waistR.x - waistL.x - 1) * s,
      2.5 * s
    );
    g.stroke({ width: s * 0.4, color: ap.accentDk, alpha: 0.5 });
    // Buckle
    g.roundRect((cx - 1.5) * s, (beltY - 0.8) * s, 3 * s, 2 * s, 0.5 * s);
    g.fill(0xccaa44);
    g.roundRect((cx - 1.5) * s, (beltY - 0.8) * s, 3 * s, 2 * s, 0.5 * s);
    g.stroke({ width: s * 0.3, color: 0x886622 });

    // Shoulder straps
    g.moveTo(shoulderL.x * s, shoulderL.y * s);
    g.lineTo((cx - 1) * s, (neckBase.y + 1) * s);
    g.moveTo(shoulderR.x * s, shoulderR.y * s);
    g.lineTo((cx + 1) * s, (neckBase.y + 1) * s);
    g.stroke({ width: s * 1.2, color: ap.accent, alpha: 0.7 });
  }

  if (cfg.armor === "cloth") {
    // Collar / neckline
    g.ellipse(
      neckBase.x * s,
      (neckBase.y + 1) * s,
      3.5 * p.wf * s,
      2.5 * s
    );
    g.fill(ap.accent);
    g.ellipse(
      neckBase.x * s,
      (neckBase.y + 1) * s,
      3.5 * p.wf * s,
      2.5 * s
    );
    g.stroke({ width: s * 0.5, color: ap.accentDk, alpha: 0.5 });

    // Robe hem extension below hips
    const hemW = Math.abs(hipR.x - hipL.x) + 5;
    const hemCx = (hipL.x + hipR.x) / 2;
    g.moveTo(hipL.x * s, hipL.y * s);
    g.quadraticCurveTo(
      (hemCx - hemW / 2 - 1) * s,
      (hipL.y + 5) * s,
      (hemCx - hemW * 0.3) * s,
      (hipL.y + 6) * s
    );
    g.lineTo((hemCx + hemW * 0.3) * s, (hipR.y + 6) * s);
    g.quadraticCurveTo(
      (hemCx + hemW / 2 + 1) * s,
      (hipR.y + 5) * s,
      hipR.x * s,
      hipR.y * s
    );
    g.closePath();
    g.fill(ap.body);
    // Hem edge
    g.moveTo((hemCx - hemW * 0.3) * s, (hipL.y + 6) * s);
    g.lineTo((hemCx + hemW * 0.3) * s, (hipR.y + 6) * s);
    g.stroke({ width: s * 0.8, color: ap.accent, alpha: 0.6 });

    // Sash
    g.moveTo(waistL.x * s, waistL.y * s);
    g.lineTo(waistR.x * s, waistR.y * s);
    g.stroke({ width: s * 1.5, color: ap.accent, alpha: 0.7 });
  }
}

function drawPauldron(g: Graphics, shoulder: V, s: number, ap: APal, side: number): void {
  const px = shoulder.x + side * 2;
  const py = shoulder.y - 1;
  g.ellipse(px * s, py * s, 5 * s, 3 * s);
  g.fill(ap.accent);
  g.ellipse(px * s, py * s, 5 * s, 3 * s);
  g.stroke({ width: s * 0.6, color: ap.outline });
  // Highlight ridge
  g.ellipse(px * s, (py - 0.8) * s, 3 * s, 1.2 * s);
  g.fill({ color: ap.bodyLt, alpha: 0.4 });
}

// ─── HEAD ───────────────────────────────────────────────────────────

function drawHead(
  g: Graphics,
  p: Pose,
  cfg: CharacterConfig,
  ap: APal,
  s: number
): void {
  const { head, iso, wf } = p;
  const { skin, hair, eyes } = cfg.colors;
  const r = 7;
  const faceCam = iso.y > 0;
  const sideView = Math.abs(iso.x) > 0.3;

  // Back hair (visible when facing away)
  if (!faceCam) {
    g.ellipse(head.x * s, (head.y + 0.5) * s, (r + 0.5) * wf * s, (r + 1) * s);
    g.fill(hair);
  }

  // Ears (visible from side)
  if (sideView) {
    const earSide = iso.x > 0 ? 1 : -1;
    const earX = head.x + earSide * r * wf * 0.85;
    g.ellipse(earX * s, (head.y + 1) * s, 1.8 * s, 2.5 * s);
    g.fill(skin);
    g.ellipse(earX * s, (head.y + 1) * s, 1 * s, 1.5 * s);
    g.fill(darken(skin, 0.15));
  }

  // Head shape (slightly taller than wide for jaw)
  g.ellipse(head.x * s, head.y * s, r * wf * s, r * s);
  g.fill(skin);
  // Jaw (slightly wider at bottom for face shape)
  if (faceCam) {
    g.ellipse(head.x * s, (head.y + 2) * s, (r - 0.5) * wf * s, (r - 2) * s);
    g.fill(skin);
  }
  // Head outline
  g.ellipse(head.x * s, head.y * s, r * wf * s, r * s);
  g.stroke({ width: s * 0.6, color: darken(skin, 0.3), alpha: 0.4 });

  // Hair top
  if (faceCam || sideView) {
    // Bangs
    g.ellipse(
      head.x * s,
      (head.y - r * 0.5) * s,
      r * 0.7 * wf * s,
      r * 0.45 * s
    );
    g.fill(hair);
    // Side hair
    if (sideView) {
      const hx = head.x + iso.x * 2;
      g.ellipse(
        hx * s,
        (head.y - r * 0.2) * s,
        r * 0.5 * wf * s,
        r * 0.7 * s
      );
      g.fill(hair);
    }
  } else {
    // From behind — full hair coverage
    g.ellipse(head.x * s, (head.y - 1) * s, r * wf * s, (r - 0.5) * s);
    g.fill(hair);
  }

  // Helmet (plate)
  if (cfg.armor === "plate") {
    // Helm body
    g.ellipse(
      head.x * s,
      (head.y - 0.5) * s,
      (r + 1.5) * wf * s,
      (r + 1) * s
    );
    g.fill({ color: ap.body, alpha: 0.85 });
    g.ellipse(
      head.x * s,
      (head.y - 0.5) * s,
      (r + 1.5) * wf * s,
      (r + 1) * s
    );
    g.stroke({ width: s * 0.7, color: ap.outline });
    // Nose guard / center ridge
    if (faceCam || sideView) {
      g.moveTo(head.x * s, (head.y - r - 1) * s);
      g.lineTo(head.x * s, (head.y + 1) * s);
      g.stroke({ width: s * 1.2, color: ap.bodyLt, alpha: 0.5 });
    }
    // Eye slit
    if (faceCam || (sideView && iso.y >= -0.1)) {
      const slitW = 6 * wf;
      g.rect(
        (head.x - slitW / 2) * s,
        (head.y + 0.5) * s,
        slitW * s,
        1.8 * s
      );
      g.fill(0x111122);
    }
    return; // no face details with plate helm
  }

  // Mail coif
  if (cfg.armor === "mail") {
    g.ellipse(
      head.x * s,
      (head.y + 1) * s,
      (r + 1) * wf * s,
      (r + 2) * s
    );
    g.fill({ color: ap.body, alpha: 0.45 });
  }

  // Eyes (visible when facing camera or from side)
  if (faceCam || (sideView && iso.y >= -0.1)) {
    const spread = 2.8 * wf;
    const eyeY = head.y + 0.5 + iso.y * 1.2;
    const eyeOX = head.x + iso.x * 1;

    // Whites
    g.ellipse((eyeOX - spread) * s, eyeY * s, 1.8 * s, 1.4 * s);
    g.fill(0xffffff);
    g.ellipse((eyeOX + spread) * s, eyeY * s, 1.8 * s, 1.4 * s);
    g.fill(0xffffff);

    // Iris
    g.circle((eyeOX - spread + iso.x * 0.5) * s, (eyeY + 0.1) * s, 1.1 * s);
    g.fill(eyes);
    g.circle((eyeOX + spread + iso.x * 0.5) * s, (eyeY + 0.1) * s, 1.1 * s);
    g.fill(eyes);

    // Pupil
    g.circle((eyeOX - spread + iso.x * 0.7) * s, (eyeY + 0.15) * s, 0.5 * s);
    g.fill(0x111111);
    g.circle((eyeOX + spread + iso.x * 0.7) * s, (eyeY + 0.15) * s, 0.5 * s);
    g.fill(0x111111);

    // Eyebrow hint
    g.moveTo((eyeOX - spread - 1.2) * s, (eyeY - 2) * s);
    g.lineTo((eyeOX - spread + 1.2) * s, (eyeY - 2.2) * s);
    g.moveTo((eyeOX + spread - 1.2) * s, (eyeY - 2.2) * s);
    g.lineTo((eyeOX + spread + 1.2) * s, (eyeY - 2) * s);
    g.stroke({ width: s * 0.7, color: darken(skin, 0.3), alpha: 0.5 });

    // Mouth hint
    if (faceCam) {
      const mouthY = head.y + 3.5 + iso.y * 0.5;
      g.moveTo((head.x - 1.5 * wf) * s, mouthY * s);
      g.quadraticCurveTo(
        head.x * s,
        (mouthY + 0.5) * s,
        (head.x + 1.5 * wf) * s,
        mouthY * s
      );
      g.stroke({ width: s * 0.5, color: darken(skin, 0.25), alpha: 0.4 });
    }
  }
}

// ─── ARM ────────────────────────────────────────────────────────────

function drawArm(
  g: Graphics,
  p: Pose,
  cfg: CharacterConfig,
  ap: APal,
  s: number,
  side: "L" | "R"
): void {
  const shoulder = side === "L" ? p.shoulderL : p.shoulderR;
  const elbow = side === "L" ? p.elbowL : p.elbowR;
  const wrist = side === "L" ? p.wristL : p.wristR;

  const armColor = cfg.armor === "none" ? cfg.colors.skin : ap.body;
  const armDk = cfg.armor === "none" ? darken(cfg.colors.skin, 0.2) : ap.bodyDk;
  const armOutline = cfg.armor === "none" ? darken(cfg.colors.skin, 0.3) : ap.outline;

  // Upper arm
  drawTaperedLimb(g, shoulder, elbow, 3.8, 3.2, armColor, armDk, armOutline, s);

  // Elbow joint
  g.circle(elbow.x * s, elbow.y * s, 2 * s);
  g.fill(armColor);
  g.circle(elbow.x * s, elbow.y * s, 2 * s);
  g.stroke({ width: s * 0.4, color: armOutline, alpha: 0.3 });

  // Forearm
  const foreColor = cfg.armor === "none" ? cfg.colors.skin : ap.body;
  drawTaperedLimb(g, elbow, wrist, 3, 2.5, foreColor, armDk, armOutline, s);

  // Bracer (leather/plate)
  if (cfg.armor === "leather" || cfg.armor === "plate") {
    const mx = (elbow.x + wrist.x) / 2;
    const my = (elbow.y + wrist.y) / 2;
    g.ellipse(mx * s, my * s, 2.8 * s, 3.5 * s);
    g.fill(cfg.armor === "plate" ? ap.accent : ap.accentDk);
    g.ellipse(mx * s, my * s, 2.8 * s, 3.5 * s);
    g.stroke({ width: s * 0.4, color: ap.outline, alpha: 0.5 });
  }

  // Gauntlet / hand
  const handColor = cfg.armor === "plate" ? ap.accent : cfg.colors.skin;
  g.circle(wrist.x * s, wrist.y * s, 2.2 * s);
  g.fill(handColor);
  g.circle(wrist.x * s, wrist.y * s, 2.2 * s);
  g.stroke({ width: s * 0.3, color: darken(handColor, 0.25), alpha: 0.3 });
}

// ─── PELVIS (bridges torso bottom to legs) ──────────────────────────

function drawPelvis(
  g: Graphics,
  p: Pose,
  cfg: CharacterConfig,
  ap: APal,
  s: number
): void {
  const { hipL, hipR, crotch, kneeL, kneeR } = p;
  const legColor = getLegColor(cfg, ap);

  // Pelvis: U-shape from hipL down through crotch to hipR
  // Covers the gap between torso bottom and leg tops
  g.moveTo(hipL.x * s, hipL.y * s);
  g.quadraticCurveTo(
    (hipL.x - 1) * s,
    ((hipL.y + crotch.y) / 2) * s,
    ((hipL.x + crotch.x) / 2 - 0.5) * s,
    crotch.y * s
  );
  g.quadraticCurveTo(
    crotch.x * s,
    (crotch.y + 1.5) * s,
    ((hipR.x + crotch.x) / 2 + 0.5) * s,
    crotch.y * s
  );
  g.quadraticCurveTo(
    (hipR.x + 1) * s,
    ((hipR.y + crotch.y) / 2) * s,
    hipR.x * s,
    hipR.y * s
  );
  g.closePath();
  g.fill(legColor);

  // Shading on inner thighs
  g.moveTo(((hipL.x + crotch.x) / 2 - 0.5) * s, crotch.y * s);
  g.quadraticCurveTo(
    crotch.x * s,
    (crotch.y + 1.5) * s,
    ((hipR.x + crotch.x) / 2 + 0.5) * s,
    crotch.y * s
  );
  g.lineTo(crotch.x * s, (crotch.y - 1) * s);
  g.closePath();
  g.fill({ color: darken(legColor, 0.2), alpha: 0.4 });

}

// ─── GLUTES (between legs and torso, back views only) ────────────────

function drawGlutes(
  g: Graphics,
  p: Pose,
  cfg: CharacterConfig,
  ap: APal,
  s: number
): void {
  const { hipL, hipR, crotch, iso } = p;
  const legColor = getLegColor(cfg, ap);
  const cheekColor = lighten(legColor, 0.05);

  const cheekW = 4.5 * p.wf;
  const cheekH = 4;
  const cheekY = hipL.y + 0.5;
  const cheekLX = hipL.x * 0.4;
  const cheekRX = hipR.x * 0.4;

  // Left cheek — solid round shape
  g.ellipse(cheekLX * s, cheekY * s, cheekW * s, cheekH * s);
  g.fill(cheekColor);
  g.ellipse(cheekLX * s, cheekY * s, cheekW * s, cheekH * s);
  g.stroke({ width: s * 0.5, color: darken(legColor, 0.15), alpha: 0.4 });

  // Right cheek
  g.ellipse(cheekRX * s, cheekY * s, cheekW * s, cheekH * s);
  g.fill(cheekColor);
  g.ellipse(cheekRX * s, cheekY * s, cheekW * s, cheekH * s);
  g.stroke({ width: s * 0.5, color: darken(legColor, 0.15), alpha: 0.4 });

  // Cleft line between cheeks
  g.moveTo(crotch.x * s, (hipL.y - 1.5) * s);
  g.quadraticCurveTo(
    (crotch.x - 0.2) * s, cheekY * s,
    crotch.x * s, (cheekY + cheekH) * s
  );
  g.stroke({ width: s * 0.7, color: darken(legColor, 0.22), alpha: 0.6 });

  // Underglute crease on each cheek
  g.moveTo((cheekLX - cheekW * 0.6) * s, (cheekY + cheekH * 0.65) * s);
  g.quadraticCurveTo(
    cheekLX * s, (cheekY + cheekH * 0.85) * s,
    (cheekLX + cheekW * 0.4) * s, (cheekY + cheekH * 0.55) * s
  );
  g.moveTo((cheekRX + cheekW * 0.6) * s, (cheekY + cheekH * 0.65) * s);
  g.quadraticCurveTo(
    cheekRX * s, (cheekY + cheekH * 0.85) * s,
    (cheekRX - cheekW * 0.4) * s, (cheekY + cheekH * 0.55) * s
  );
  g.stroke({ width: s * 0.5, color: darken(legColor, 0.18), alpha: 0.45 });
}

function getLegColor(cfg: CharacterConfig, ap: APal): number {
  return cfg.armor === "none"
    ? cfg.colors.skin
    : cfg.armor === "cloth"
      ? darken(ap.body, 0.1)
      : darken(ap.body, 0.15);
}

// ─── LEG ────────────────────────────────────────────────────────────

function drawLeg(
  g: Graphics,
  p: Pose,
  cfg: CharacterConfig,
  ap: APal,
  s: number,
  side: "L" | "R"
): void {
  const hip = side === "L" ? p.hipL : p.hipR;
  const knee = side === "L" ? p.kneeL : p.kneeR;
  const ankle = side === "L" ? p.ankleL : p.ankleR;

  // Leg attaches inward from hip — outer edge aligns with torso hip line
  // hip at ±5.5, thigh 5.5px wide → center at ±2.75, outer edge at ±5.5
  const legTop: V = { x: hip.x * 0.5, y: hip.y };

  const legColor = getLegColor(cfg, ap);
  const legDk = darken(legColor, 0.2);
  const legOutline = darken(legColor, 0.35);

  // Thigh — outer edge flush with hip, inner edges overlap at center
  drawTaperedLimb(g, legTop, knee, 5.5, 4, legColor, legDk, legOutline, s);

  // Knee — subtle widening, not a floating circle
  const kneeCap = cfg.armor === "plate" ? ap.accent : legColor;
  g.ellipse(knee.x * s, knee.y * s, 2.8 * s, 1.8 * s);
  g.fill(kneeCap);
  g.ellipse(knee.x * s, knee.y * s, 2.8 * s, 1.8 * s);
  g.stroke({ width: s * 0.3, color: darken(kneeCap, 0.2), alpha: 0.25 });

  // Calf — widest just below knee, tapers to ankle
  const calfColor = cfg.armor === "plate" ? ap.accent : legColor;
  const calfDk = darken(calfColor, 0.2);
  const calfOutline = darken(calfColor, 0.35);
  drawTaperedLimb(g, knee, ankle, 4.5, 3, calfColor, calfDk, calfOutline, s);

  // Plate greaves overlay
  if (cfg.armor === "plate") {
    drawTaperedLimb(g, knee, ankle, 5, 3.5, ap.accent, ap.accentDk, ap.outline, s);
    g.moveTo(knee.x * s, (knee.y + 1) * s);
    g.lineTo(ankle.x * s, (ankle.y - 1) * s);
    g.stroke({ width: s * 0.8, color: ap.bodyLt, alpha: 0.3 });
  }
}

// ─── FOOT ───────────────────────────────────────────────────────────

function drawFoot(
  g: Graphics,
  p: Pose,
  cfg: CharacterConfig,
  ap: APal,
  s: number,
  side: "L" | "R"
): void {
  const ankle = side === "L" ? p.ankleL : p.ankleR;
  const toe = side === "L" ? p.toeL : p.toeR;

  const bootColor =
    cfg.armor === "none"
      ? darken(cfg.colors.skin, 0.2)
      : cfg.armor === "plate"
        ? ap.accentDk
        : cfg.armor === "leather"
          ? ap.accent
          : darken(ap.body, 0.25);

  const { iso } = p;

  // Foot extends in the facing direction along the ground plane
  // In isometric: forward = (iso.x, iso.y * 0.5) in screen space
  const footLen = 4;
  const fwdX = iso.x * footLen;
  const fwdY = iso.y * footLen * 0.5;
  // If facing straight at camera (S), foot extends slightly downward
  // If facing side (E/W), foot extends sideways
  const tipX = ankle.x + fwdX;
  const tipY = ankle.y + fwdY + 1.5; // +1.5 baseline: foot always slightly below ankle

  // Perpendicular for foot width
  const fdx = tipX - ankle.x;
  const fdy = tipY - ankle.y;
  const flen = Math.sqrt(fdx * fdx + fdy * fdy);
  const pnx = flen > 0.3 ? -fdy / flen : 1;
  const pny = flen > 0.3 ? fdx / flen : 0;
  const hw = 2; // half-width at ankle
  const tw = 1.2; // half-width at toe

  // Boot shape
  g.moveTo((ankle.x + pnx * hw) * s, (ankle.y + pny * hw) * s);
  g.lineTo((tipX + pnx * tw) * s, (tipY + pny * tw) * s);
  g.quadraticCurveTo(
    (tipX + fdx / flen * 1.5) * s,
    (tipY + fdy / flen * 1) * s,
    (tipX - pnx * tw) * s,
    (tipY - pny * tw) * s
  );
  g.lineTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
  g.closePath();
  g.fill(bootColor);

  // Outline
  g.moveTo((ankle.x + pnx * hw) * s, (ankle.y + pny * hw) * s);
  g.lineTo((tipX + pnx * tw) * s, (tipY + pny * tw) * s);
  g.quadraticCurveTo(
    (tipX + fdx / flen * 1.5) * s,
    (tipY + fdy / flen * 1) * s,
    (tipX - pnx * tw) * s,
    (tipY - pny * tw) * s
  );
  g.lineTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
  g.closePath();
  g.stroke({ width: s * 0.4, color: darken(bootColor, 0.3), alpha: 0.4 });

  // Sole line (bottom edge)
  g.moveTo((ankle.x - pnx * hw) * s, (ankle.y - pny * hw) * s);
  g.lineTo((tipX - pnx * tw) * s, (tipY - pny * tw) * s);
  g.stroke({ width: s * 0.5, color: darken(bootColor, 0.35), alpha: 0.5 });

  // Ankle cuff
  if (cfg.armor === "leather" || cfg.armor === "plate") {
    g.moveTo((ankle.x + pnx * (hw + 0.3)) * s, (ankle.y + pny * (hw + 0.3)) * s);
    g.lineTo((ankle.x - pnx * (hw + 0.3)) * s, (ankle.y - pny * (hw + 0.3)) * s);
    g.stroke({
      width: s * 1.5,
      color: cfg.armor === "plate" ? ap.accent : ap.accentDk,
    });
  }
}

// ─── TAPERED LIMB HELPER ────────────────────────────────────────────

function drawTaperedLimb(
  g: Graphics,
  from: V,
  to: V,
  widthFrom: number,
  widthTo: number,
  color: number,
  shadowColor: number,
  outlineColor: number,
  s: number
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.3) return;

  const nx = -dy / len;
  const ny = dx / len;

  const wf = widthFrom * 0.5;
  const wt = widthTo * 0.5;

  // Four corners of the limb shape
  const x1l = from.x + nx * wf;
  const y1l = from.y + ny * wf;
  const x1r = from.x - nx * wf;
  const y1r = from.y - ny * wf;
  const x2l = to.x + nx * wt;
  const y2l = to.y + ny * wt;
  const x2r = to.x - nx * wt;
  const y2r = to.y - ny * wt;

  // Muscle bulge control points (at ~35% and ~65% along the limb)
  const bulgeOuter = 1.0;
  const bulgeInner = 0.3;

  const m1x = from.x + dx * 0.35;
  const m1y = from.y + dy * 0.35;
  const m2x = from.x + dx * 0.65;
  const m2y = from.y + dy * 0.65;
  // Left side (outer): slight outward bulge
  const wm1 = wf + (wt - wf) * 0.35;
  const m1xl = m1x + nx * (wm1 + bulgeOuter);
  const m1yl = m1y + ny * (wm1 + bulgeOuter);
  // Right side (inner): slight inward curve
  const m1xr = m1x - nx * (wm1 + bulgeInner);
  const m1yr = m1y - ny * (wm1 + bulgeInner);

  // Shape with organic curves on both sides
  g.moveTo(x1l * s, y1l * s);
  g.quadraticCurveTo(m1xl * s, m1yl * s, x2l * s, y2l * s);
  g.lineTo(x2r * s, y2r * s);
  g.quadraticCurveTo(m1xr * s, m1yr * s, x1r * s, y1r * s);
  g.closePath();
  g.fill(color);

  // Shadow stripe along one side for volume
  g.moveTo(x1r * s, y1r * s);
  g.quadraticCurveTo(m1xr * s, m1yr * s, x2r * s, y2r * s);
  const cx2 = (x2r + x2l) / 2;
  const cy2 = (y2r + y2l) / 2;
  const cx1 = (x1r + x1l) / 2;
  const cy1 = (y1r + y1l) / 2;
  g.lineTo(cx2 * s, cy2 * s);
  g.lineTo(cx1 * s, cy1 * s);
  g.closePath();
  g.fill({ color: shadowColor, alpha: 0.2 });

  // Subtle highlight on the other side
  g.moveTo(x1l * s, y1l * s);
  g.quadraticCurveTo(m1xl * s, m1yl * s, x2l * s, y2l * s);
  g.lineTo(cx2 * s, cy2 * s);
  g.lineTo(cx1 * s, cy1 * s);
  g.closePath();
  g.fill({ color: 0xffffff, alpha: 0.06 });

  // Outline
  g.moveTo(x1l * s, y1l * s);
  g.quadraticCurveTo(m1xl * s, m1yl * s, x2l * s, y2l * s);
  g.lineTo(x2r * s, y2r * s);
  g.quadraticCurveTo(m1xr * s, m1yr * s, x1r * s, y1r * s);
  g.closePath();
  g.stroke({ width: s * 0.45, color: outlineColor, alpha: 0.3 });
}

// ─── WEAPONS ────────────────────────────────────────────────────────

function drawWeapon(
  g: Graphics,
  p: Pose,
  cfg: CharacterConfig,
  iso: { x: number; y: number },
  s: number,
  side: "L" | "R"
): void {
  const wrist = side === "L" ? p.wristL : p.wristR;
  const elbow = side === "L" ? p.elbowL : p.elbowR;

  // Weapon angle follows arm direction
  const armDx = wrist.x - elbow.x;
  const armDy = wrist.y - elbow.y;
  const armAngle = Math.atan2(armDy, armDx);

  switch (cfg.weapon) {
    case "sword":   drawSword(g, wrist, armAngle, s); break;
    case "axe":     drawAxe(g, wrist, armAngle, s); break;
    case "mace":    drawMace(g, wrist, armAngle, s); break;
    case "spear":   drawSpear(g, wrist, armAngle, s); break;
    case "bow":     drawBow(g, wrist, p.iso, s); break;
    case "staff":   drawStaff(g, wrist, s); break;
    case "wand":    drawWand(g, wrist, armAngle, s); break;
    case "dagger":  drawDagger(g, wrist, armAngle, s); break;
  }
}

function drawSword(g: Graphics, hand: V, angle: number, s: number): void {
  const len = 18;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);

  // Blade
  const tipX = hand.x + ca * len;
  const tipY = hand.y + sa * len;
  drawBlade(g, hand.x, hand.y + 1, tipX, tipY, 2, 0xd0d0e0, s);

  // Crossguard
  const cgX = hand.x + ca * 2;
  const cgY = hand.y + sa * 2;
  const cpx = -sa * 3.5;
  const cpy = ca * 3.5;
  g.moveTo((cgX - cpx) * s, (cgY - cpy) * s);
  g.lineTo((cgX + cpx) * s, (cgY + cpy) * s);
  g.stroke({ width: 2.5 * s, color: 0x886633 });
  // Guard ends
  g.circle((cgX - cpx) * s, (cgY - cpy) * s, 1 * s);
  g.circle((cgX + cpx) * s, (cgY + cpy) * s, 1 * s);
  g.fill(0xaa8844);

  // Grip
  g.moveTo(hand.x * s, hand.y * s);
  g.lineTo((hand.x - ca * 3) * s, (hand.y - sa * 3) * s);
  g.stroke({ width: 2 * s, color: 0x664422 });

  // Pommel
  g.circle((hand.x - ca * 3.5) * s, (hand.y - sa * 3.5) * s, 1.5 * s);
  g.fill(0xaa8844);
}

function drawAxe(g: Graphics, hand: V, angle: number, s: number): void {
  const len = 14;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const topX = hand.x + ca * len;
  const topY = hand.y + sa * len;

  // Handle
  g.moveTo(hand.x * s, hand.y * s);
  g.lineTo(topX * s, topY * s);
  g.stroke({ width: 2 * s, color: 0x886633 });

  // Axe head
  const px = -sa * 6;
  const py = ca * 6;
  g.moveTo((topX - ca * 3) * s, (topY - sa * 3) * s);
  g.quadraticCurveTo(
    (topX + px) * s,
    (topY + py) * s,
    (topX + ca * 2) * s,
    (topY + sa * 2) * s
  );
  g.closePath();
  g.fill(0xaab0c0);
  g.moveTo((topX - ca * 3) * s, (topY - sa * 3) * s);
  g.quadraticCurveTo(
    (topX + px) * s,
    (topY + py) * s,
    (topX + ca * 2) * s,
    (topY + sa * 2) * s
  );
  g.closePath();
  g.stroke({ width: s * 0.6, color: 0x555566 });

  // Edge highlight
  g.moveTo((topX - ca * 2 + px * 0.7) * s, (topY - sa * 2 + py * 0.7) * s);
  g.lineTo((topX + ca * 1 + px * 0.7) * s, (topY + sa * 1 + py * 0.7) * s);
  g.stroke({ width: s * 0.5, color: 0xd0d8e8, alpha: 0.6 });
}

function drawMace(g: Graphics, hand: V, angle: number, s: number): void {
  const len = 13;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const topX = hand.x + ca * len;
  const topY = hand.y + sa * len;

  // Handle
  g.moveTo(hand.x * s, hand.y * s);
  g.lineTo(topX * s, topY * s);
  g.stroke({ width: 2 * s, color: 0x886633 });

  // Mace head
  g.circle(topX * s, topY * s, 4 * s);
  g.fill(0x888899);
  g.circle(topX * s, topY * s, 4 * s);
  g.stroke({ width: s * 0.7, color: 0x444455 });

  // Flanges
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + angle;
    const fx = topX + Math.cos(a) * 4;
    const fy = topY + Math.sin(a) * 4;
    g.moveTo(topX * s, topY * s);
    g.lineTo(fx * s, fy * s);
  }
  g.stroke({ width: s * 1.5, color: 0x777788 });

  // Center boss
  g.circle(topX * s, topY * s, 1.5 * s);
  g.fill(0xaaaabc);
}

function drawSpear(g: Graphics, hand: V, angle: number, s: number): void {
  const len = 28;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const tipX = hand.x + ca * len;
  const tipY = hand.y + sa * len;

  // Shaft
  g.moveTo((hand.x - ca * 6) * s, (hand.y - sa * 6) * s);
  g.lineTo(tipX * s, tipY * s);
  g.stroke({ width: 1.8 * s, color: 0x886633 });

  // Spear head
  const px = -sa * 2.5;
  const py = ca * 2.5;
  g.poly([
    tipX * s, tipY * s,
    (tipX - ca * 6 + px) * s, (tipY - sa * 6 + py) * s,
    (tipX - ca * 6 - px) * s, (tipY - sa * 6 - py) * s,
  ]);
  g.fill(0xc0c0d0);
  g.poly([
    tipX * s, tipY * s,
    (tipX - ca * 6 + px) * s, (tipY - sa * 6 + py) * s,
    (tipX - ca * 6 - px) * s, (tipY - sa * 6 - py) * s,
  ]);
  g.stroke({ width: s * 0.5, color: 0x555566 });
  // Center line
  g.moveTo((tipX - ca * 6) * s, (tipY - sa * 6) * s);
  g.lineTo(tipX * s, tipY * s);
  g.stroke({ width: s * 0.4, color: 0xe0e0f0, alpha: 0.5 });
}

function drawBow(g: Graphics, hand: V, iso: { x: number; y: number }, s: number): void {
  const bowH = 16;
  const curve = 5 * (iso.x !== 0 ? Math.sign(iso.x) : 1);

  // Stave
  g.moveTo(hand.x * s, (hand.y - bowH / 2) * s);
  g.quadraticCurveTo(
    (hand.x + curve) * s,
    hand.y * s,
    hand.x * s,
    (hand.y + bowH / 2) * s
  );
  g.stroke({ width: 2.5 * s, color: 0x886633 });

  // Stave tips
  g.circle(hand.x * s, (hand.y - bowH / 2) * s, 0.8 * s);
  g.circle(hand.x * s, (hand.y + bowH / 2) * s, 0.8 * s);
  g.fill(0xaa8844);

  // String
  g.moveTo(hand.x * s, (hand.y - bowH / 2) * s);
  g.lineTo(hand.x * s, (hand.y + bowH / 2) * s);
  g.stroke({ width: 0.5 * s, color: 0xccccaa });

  // Grip wrap
  g.rect((hand.x - 1) * s, (hand.y - 2) * s, 2 * s, 4 * s);
  g.fill(0x664422);
}

function drawStaff(g: Graphics, hand: V, s: number): void {
  const topY = hand.y - 28;
  const botY = hand.y + 5;

  // Shaft
  g.moveTo(hand.x * s, topY * s);
  g.lineTo(hand.x * s, botY * s);
  g.stroke({ width: 2.2 * s, color: 0x664422 });

  // Shaft wrapping
  for (let i = 0; i < 3; i++) {
    const wy = hand.y - 5 + i * 3;
    g.moveTo((hand.x - 1.5) * s, wy * s);
    g.lineTo((hand.x + 1.5) * s, (wy + 1) * s);
  }
  g.stroke({ width: s * 0.5, color: 0x886633 });

  // Crystal/orb at top
  g.circle(hand.x * s, (topY + 2) * s, 3.5 * s);
  g.fill({ color: 0x44aaff, alpha: 0.85 });
  g.circle(hand.x * s, (topY + 2) * s, 3.5 * s);
  g.stroke({ width: s * 0.6, color: 0x2266aa });

  // Inner glow
  g.circle((hand.x - 0.5) * s, (topY + 1.5) * s, 1.5 * s);
  g.fill({ color: 0xaaddff, alpha: 0.6 });

  // Prongs holding the orb
  g.moveTo((hand.x - 2) * s, (topY + 5) * s);
  g.quadraticCurveTo((hand.x - 3) * s, (topY + 2) * s, (hand.x - 1) * s, (topY - 0.5) * s);
  g.moveTo((hand.x + 2) * s, (topY + 5) * s);
  g.quadraticCurveTo((hand.x + 3) * s, (topY + 2) * s, (hand.x + 1) * s, (topY - 0.5) * s);
  g.stroke({ width: s * 0.8, color: 0x664422 });
}

function drawWand(g: Graphics, hand: V, angle: number, s: number): void {
  const len = 11;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const tipX = hand.x + ca * len;
  const tipY = hand.y + sa * len;

  // Shaft
  g.moveTo(hand.x * s, hand.y * s);
  g.lineTo(tipX * s, tipY * s);
  g.stroke({ width: 1.8 * s, color: 0x664422 });

  // Glowing tip
  g.circle(tipX * s, tipY * s, 2.5 * s);
  g.fill({ color: 0xff6644, alpha: 0.85 });
  g.circle(tipX * s, tipY * s, 1.2 * s);
  g.fill({ color: 0xffcc88, alpha: 0.7 });

  // Grip
  g.rect((hand.x - ca * 1 - 0.8) * s, (hand.y - sa * 1 - 0.8) * s, 1.6 * s, 1.6 * s);
  g.fill(0x886633);
}

function drawDagger(g: Graphics, hand: V, angle: number, s: number): void {
  const len = 9;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const tipX = hand.x + ca * len;
  const tipY = hand.y + sa * len;

  drawBlade(g, hand.x, hand.y, tipX, tipY, 1.5, 0xd0d0e0, s);

  // Crossguard
  const cgX = hand.x + ca * 1.5;
  const cgY = hand.y + sa * 1.5;
  const cpx = -sa * 2.5;
  const cpy = ca * 2.5;
  g.moveTo((cgX - cpx) * s, (cgY - cpy) * s);
  g.lineTo((cgX + cpx) * s, (cgY + cpy) * s);
  g.stroke({ width: 2 * s, color: 0x886633 });

  // Grip
  g.moveTo(hand.x * s, hand.y * s);
  g.lineTo((hand.x - ca * 2) * s, (hand.y - sa * 2) * s);
  g.stroke({ width: 1.5 * s, color: 0x664422 });
}

function drawBlade(
  g: Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w: number,
  color: number,
  s: number
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.1) return;
  const px = (-dy / len) * w;
  const py = (dx / len) * w;

  // Tapered blade
  g.poly([
    (x1 + px) * s, (y1 + py) * s,
    x2 * s, y2 * s,
    (x1 - px) * s, (y1 - py) * s,
  ]);
  g.fill(color);
  g.poly([
    (x1 + px) * s, (y1 + py) * s,
    x2 * s, y2 * s,
    (x1 - px) * s, (y1 - py) * s,
  ]);
  g.stroke({ width: s * 0.4, color: darken(color, 0.3), alpha: 0.4 });

  // Edge highlight
  g.moveTo(x1 * s, y1 * s);
  g.lineTo(x2 * s, y2 * s);
  g.stroke({ width: s * 0.3, color: lighten(color, 0.3), alpha: 0.6 });

  // Fuller (blood groove)
  const fStart = 0.2;
  const fEnd = 0.7;
  g.moveTo(
    (x1 + dx * fStart + px * 0.3) * s,
    (y1 + dy * fStart + py * 0.3) * s
  );
  g.lineTo(
    (x1 + dx * fEnd + px * 0.15) * s,
    (y1 + dy * fEnd + py * 0.15) * s
  );
  g.stroke({ width: s * 0.3, color: darken(color, 0.15), alpha: 0.4 });
}

// ─── SHIELD ─────────────────────────────────────────────────────────

function drawShield(
  g: Graphics,
  p: Pose,
  cfg: CharacterConfig,
  s: number,
  side: "L" | "R"
): void {
  const wrist = side === "L" ? p.wristL : p.wristR;
  const iso = p.iso;

  const ox = iso.x * 4;
  const oy = iso.y * 2;
  const cx = wrist.x + ox;
  const cy = wrist.y - 4 + oy;
  const sw = 7 * p.wf;
  const sh = 9;

  // Shield body (kite shape)
  g.moveTo(cx * s, (cy - sh) * s);
  g.quadraticCurveTo((cx + sw) * s, (cy - sh * 0.3) * s, (cx + sw * 0.8) * s, cy * s);
  g.quadraticCurveTo((cx + sw * 0.3) * s, (cy + sh * 0.6) * s, cx * s, (cy + sh) * s);
  g.quadraticCurveTo((cx - sw * 0.3) * s, (cy + sh * 0.6) * s, (cx - sw * 0.8) * s, cy * s);
  g.quadraticCurveTo((cx - sw) * s, (cy - sh * 0.3) * s, cx * s, (cy - sh) * s);
  g.closePath();
  g.fill(cfg.colors.secondary);

  // Outline
  g.moveTo(cx * s, (cy - sh) * s);
  g.quadraticCurveTo((cx + sw) * s, (cy - sh * 0.3) * s, (cx + sw * 0.8) * s, cy * s);
  g.quadraticCurveTo((cx + sw * 0.3) * s, (cy + sh * 0.6) * s, cx * s, (cy + sh) * s);
  g.quadraticCurveTo((cx - sw * 0.3) * s, (cy + sh * 0.6) * s, (cx - sw * 0.8) * s, cy * s);
  g.quadraticCurveTo((cx - sw) * s, (cy - sh * 0.3) * s, cx * s, (cy - sh) * s);
  g.closePath();
  g.stroke({ width: s * 0.8, color: darken(cfg.colors.secondary, 0.45) });

  // Rim highlight
  g.moveTo(cx * s, (cy - sh + 0.5) * s);
  g.quadraticCurveTo((cx - sw + 0.5) * s, (cy - sh * 0.3) * s, (cx - sw * 0.8 + 0.5) * s, cy * s);
  g.stroke({ width: s * 0.5, color: lighten(cfg.colors.secondary, 0.2), alpha: 0.5 });

  // Boss
  g.circle(cx * s, (cy - 1) * s, 2.5 * s);
  g.fill(0xccaa44);
  g.circle(cx * s, (cy - 1) * s, 2.5 * s);
  g.stroke({ width: s * 0.5, color: 0x886622 });

  // Decorative cross
  g.moveTo(cx * s, (cy - sh * 0.6) * s);
  g.lineTo(cx * s, (cy + sh * 0.4) * s);
  g.moveTo((cx - sw * 0.5) * s, (cy - 1) * s);
  g.lineTo((cx + sw * 0.5) * s, (cy - 1) * s);
  g.stroke({
    width: s * 0.7,
    color: darken(cfg.colors.secondary, 0.2),
    alpha: 0.4,
  });
}
