import type { Skeleton, V, Direction, AttachmentPoint } from "./types";
import { ISO_OFFSETS } from "./types";

/**
 * Compute a humanoid skeleton for the given direction and walk phase.
 * Returns named joints + attachment points that models read from.
 */
export function computeHumanoidSkeleton(
  dir: Direction,
  walkPhase: number
): Skeleton {
  const iso = ISO_OFFSETS[dir] ?? ISO_OFFSETS[0];
  const w = walkPhase !== 0;
  const swing = w ? Math.sin(walkPhase) : 0;
  const bob = w ? -Math.abs(Math.sin(walkPhase * 2)) * 1.6 : 0;

  const wf = 1 - Math.abs(iso.x) * 0.35;
  const lx = iso.x * 2.5;
  const ly = iso.y * 1.2;

  const hipRot = w ? swing * 0.06 : 0;
  const lsFwd = swing * 4.5;
  const lsBck = -swing * 4.5;
  const armFwd = -swing * 3.5;
  const armBck = swing * 3.5;
  const fwdX = iso.y;
  const fwdY = -Math.abs(iso.x) * 0.6;
  const liftL = swing > 0.2 ? -(swing - 0.2) * 2.5 : 0;
  const liftR = swing < -0.2 ? (swing + 0.2) * 2.5 : 0;
  const elbowBendL = w ? Math.max(0, -swing) * 2.5 : 0;
  const elbowBendR = w ? Math.max(0, swing) * 2.5 : 0;

  const p = (bx: number, by: number, offX = 0, offY = 0): V => ({
    x: bx * wf + lx + offX,
    y: by + bob + ly * 0.3 + offY,
  });

  // All joint positions
  const joints: Record<string, V> = {
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
    elbowL: p(-9.5, -23, armFwd * fwdX * 0.5, armFwd * fwdY * 0.5 - elbowBendL),
    elbowR: p(9.5, -23, armBck * fwdX * 0.5, armBck * fwdY * 0.5 - elbowBendR),
    wristL: p(-8.5, -15.5, armFwd * fwdX, armFwd * fwdY),
    wristR: p(8.5, -15.5, armBck * fwdX, armBck * fwdY),
    kneeL: p(-3, -6.5, lsFwd * fwdX * 0.5, lsFwd * fwdY * 0.3),
    kneeR: p(3, -6.5, lsBck * fwdX * 0.5, lsBck * fwdY * 0.3),
    ankleL: p(-2.5, -1.5, lsFwd * fwdX * 0.8, lsFwd * fwdY * 0.5 + liftL),
    ankleR: p(2.5, -1.5, lsBck * fwdX * 0.8, lsBck * fwdY * 0.5 + liftR),
    toeL: p(-2, 1, lsFwd * fwdX * 0.3, lsFwd * fwdY * 0.2 + liftL * 0.5),
    toeR: p(2, 1, lsBck * fwdX * 0.3, lsBck * fwdY * 0.2 + liftR * 0.5),
  };

  // Compute attachment points from joints
  const attachments: Record<string, AttachmentPoint> = {
    "head-top": {
      position: { x: joints.head.x, y: joints.head.y - 8 },
      angle: 0,
      wf,
    },
    "hand-R": {
      position: joints.wristR,
      angle: Math.atan2(
        joints.wristR.y - joints.elbowR.y,
        joints.wristR.x - joints.elbowR.x
      ),
      wf,
    },
    "hand-L": {
      position: joints.wristL,
      angle: Math.atan2(
        joints.wristL.y - joints.elbowL.y,
        joints.wristL.x - joints.elbowL.x
      ),
      wf,
    },
    torso: {
      position: {
        x: (joints.shoulderL.x + joints.shoulderR.x) / 2,
        y: (joints.neckBase.y + joints.hipL.y) / 2,
      },
      angle: 0,
      wf,
    },
    "torso-back": {
      position: {
        x: (joints.shoulderL.x + joints.shoulderR.x) / 2,
        y: (joints.neckBase.y + joints.hipL.y) / 2,
      },
      angle: Math.PI,
      wf,
    },
    shoulders: {
      position: {
        x: (joints.shoulderL.x + joints.shoulderR.x) / 2,
        y: (joints.shoulderL.y + joints.shoulderR.y) / 2,
      },
      angle: 0,
      wf,
    },
    gauntlets: {
      position: {
        x: (joints.elbowL.x + joints.elbowR.x) / 2,
        y: (joints.elbowL.y + joints.elbowR.y) / 2,
      },
      angle: 0,
      wf,
    },
    legs: {
      position: {
        x: (joints.hipL.x + joints.hipR.x) / 2,
        y: joints.hipL.y,
      },
      angle: 0,
      wf,
    },
    "feet-L": {
      position: joints.ankleL,
      angle: Math.atan2(
        joints.toeL.y - joints.ankleL.y,
        joints.toeL.x - joints.ankleL.x
      ),
      wf,
    },
    "feet-R": {
      position: joints.ankleR,
      angle: Math.atan2(
        joints.toeR.y - joints.ankleR.y,
        joints.toeR.x - joints.ankleR.x
      ),
      wf,
    },
  };

  return {
    joints,
    attachments,
    bob,
    wf,
    iso,
    direction: dir,
    walkPhase,
  };
}
