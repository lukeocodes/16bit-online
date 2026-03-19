import { describe, it, expect, beforeEach } from "vitest";
import { EntityManager } from "../EntityManager";
import { createPosition } from "../components/Position";
import { InterpolationSystem } from "./InterpolationSystem";

describe("InterpolationSystem", () => {
  let em: EntityManager;
  let system: InterpolationSystem;

  beforeEach(() => {
    em = new EntityManager();
    system = new InterpolationSystem(em);
  });

  function addRemoteEntity(id: string, x: number, z: number, targetX: number, targetZ: number) {
    em.addEntity(id);
    const pos = createPosition(x, 0, z);
    pos.isRemote = true;
    pos.remoteTargetX = targetX;
    pos.remoteTargetZ = targetZ;
    em.addComponent(id, pos);
    return pos;
  }

  describe("lerp toward remote targets", () => {
    it("moves toward remote target", () => {
      const pos = addRemoteEntity("e-1", 0, 0, 10, 10);

      system.update(0.1); // LERP_SPEED=10, t = min(1, 10*0.1) = 1.0
      // With t=1.0, should arrive at target immediately
      expect(pos.x).toBeCloseTo(10, 1);
      expect(pos.z).toBeCloseTo(10, 1);
    });

    it("partially moves with smaller dt", () => {
      const pos = addRemoteEntity("e-1", 0, 0, 10, 0);

      system.update(0.016); // ~60fps, t = min(1, 10*0.016) = 0.16
      // Should move 16% toward target
      expect(pos.x).toBeCloseTo(1.6, 1);
      expect(pos.x).toBeGreaterThan(0);
      expect(pos.x).toBeLessThan(10);
    });

    it("converges over multiple frames", () => {
      const pos = addRemoteEntity("e-1", 0, 0, 10, 0);

      for (let i = 0; i < 30; i++) {
        system.update(0.016);
      }
      // After ~30 frames at 60fps, should be very close to target
      expect(pos.x).toBeCloseTo(10, 0);
    });

    it("skips non-remote entities", () => {
      em.addEntity("local");
      const pos = createPosition(0, 0, 0);
      pos.isRemote = false;
      pos.remoteTargetX = 100;
      em.addComponent("local", pos);

      system.update(0.1);
      expect(pos.x).toBe(0); // Unchanged
    });

    it("does not overshoot target (t clamped to 1)", () => {
      const pos = addRemoteEntity("e-1", 0, 0, 5, 0);

      system.update(1.0); // t = min(1, 10*1.0) = 1.0
      expect(pos.x).toBeCloseTo(5);
      expect(pos.x).not.toBeGreaterThan(5.01);
    });
  });

  describe("Y-axis interpolation", () => {
    it("interpolates Y coordinate", () => {
      em.addEntity("e-1");
      const pos = createPosition(0, 0, 0);
      pos.isRemote = true;
      pos.remoteTargetY = 5;
      em.addComponent("e-1", pos);

      system.update(0.1);
      expect(pos.y).toBeCloseTo(5, 1);
    });
  });

  describe("rotation interpolation", () => {
    it("interpolates rotation normally", () => {
      em.addEntity("e-1");
      const pos = createPosition(0, 0, 0, 0);
      pos.isRemote = true;
      pos.remoteTargetRotation = 1.0;
      em.addComponent("e-1", pos);

      system.update(0.1);
      expect(pos.rotation).toBeCloseTo(1.0, 1);
    });

    it("takes short path across PI boundary (positive wrap)", () => {
      em.addEntity("e-1");
      const pos = createPosition(0, 0, 0, 3.0); // near +PI
      pos.isRemote = true;
      pos.remoteTargetRotation = -3.0; // near -PI
      em.addComponent("e-1", pos);

      // The short path from 3.0 to -3.0 should go through ±PI (~0.28 rad gap)
      // NOT through 0 (~6 rad path)
      system.update(0.016);

      // After one frame, rotation should have moved slightly toward -PI direction
      // (increased past PI or decreased below -PI)
      const moved = Math.abs(pos.rotation - 3.0);
      expect(moved).toBeLessThan(1.0); // Small step, not a large jump through 0
    });

    it("takes short path across negative PI boundary", () => {
      em.addEntity("e-1");
      const pos = createPosition(0, 0, 0, -3.0);
      pos.isRemote = true;
      pos.remoteTargetRotation = 3.0;
      em.addComponent("e-1", pos);

      system.update(0.016);
      const moved = Math.abs(pos.rotation - (-3.0));
      expect(moved).toBeLessThan(1.0);
    });
  });

  describe("multiple entities", () => {
    it("updates all remote entities independently", () => {
      const pos1 = addRemoteEntity("e-1", 0, 0, 10, 0);
      const pos2 = addRemoteEntity("e-2", 0, 0, 0, 20);

      system.update(0.1);
      expect(pos1.x).toBeCloseTo(10);
      expect(pos1.z).toBeCloseTo(0);
      expect(pos2.x).toBeCloseTo(0);
      expect(pos2.z).toBeCloseTo(20);
    });
  });
});
