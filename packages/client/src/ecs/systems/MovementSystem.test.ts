import { describe, it, expect, beforeEach } from "vitest";
import { EntityManager } from "../EntityManager";
import { createPosition } from "../components/Position";
import { createMovement } from "../components/Movement";
import { MovementSystem } from "./MovementSystem";

describe("MovementSystem", () => {
  let em: EntityManager;
  let system: MovementSystem;

  beforeEach(() => {
    em = new EntityManager();
    system = new MovementSystem(em);
  });

  function addMovableEntity(id: string, tileX = 0, tileZ = 0, speed = 5.0) {
    em.addEntity(id);
    em.addComponent(id, createPosition(tileX, 0, tileZ));
    const mov = createMovement(speed, tileX, tileZ);
    em.addComponent(id, mov);
    return mov;
  }

  describe("idle state", () => {
    it("does not move when idle (no queued direction)", () => {
      addMovableEntity("e-1", 5, 5);
      const pos = em.getComponent("e-1", "position")!;

      system.update(0.05);
      expect(pos.x).toBe(5);
      expect(pos.z).toBe(5);
    });

    it("starts queued move when idle", () => {
      const mov = addMovableEntity("e-1", 0, 0);
      mov.queuedDx = 1;
      mov.queuedDz = 0;

      system.update(0.05);
      expect(mov.moving).toBe(true);
      expect(mov.targetX).toBe(1);
      expect(mov.queuedDx).toBe(0); // Queue consumed
    });
  });

  describe("tile-to-tile movement", () => {
    it("progresses toward target tile", () => {
      const mov = addMovableEntity("e-1", 0, 0, 5.0);
      mov.moving = true;
      mov.targetX = 1;
      mov.targetZ = 0;
      mov.progress = 0;

      system.update(0.05); // speed=5, progress += 5*0.05 = 0.25
      expect(mov.progress).toBeCloseTo(0.25);
      expect(mov.moving).toBe(true);
    });

    it("interpolates position between tiles", () => {
      const mov = addMovableEntity("e-1", 0, 0, 5.0);
      const pos = em.getComponent("e-1", "position")!;
      mov.moving = true;
      mov.targetX = 1;
      mov.targetZ = 0;
      mov.progress = 0;

      system.update(0.1); // progress = 0.5
      expect(pos.x).toBeCloseTo(0.5);
      expect(pos.z).toBe(0);
    });

    it("snaps to target when progress >= 1", () => {
      const mov = addMovableEntity("e-1", 0, 0, 5.0);
      const pos = em.getComponent("e-1", "position")!;
      mov.moving = true;
      mov.targetX = 1;
      mov.targetZ = 0;
      mov.progress = 0;

      system.update(0.3); // progress = 1.5, capped
      expect(mov.progress).toBe(1);
      expect(mov.moving).toBe(false);
      expect(mov.tileX).toBe(1);
      expect(mov.tileZ).toBe(0);
      expect(pos.x).toBe(1);
      expect(pos.z).toBe(0);
    });
  });

  describe("queued direction chaining", () => {
    it("chains queued move on arrival", () => {
      const mov = addMovableEntity("e-1", 0, 0, 5.0);
      mov.moving = true;
      mov.targetX = 1;
      mov.targetZ = 0;
      mov.progress = 0.9;

      // Queue a move in Z direction
      mov.queuedDx = 0;
      mov.queuedDz = 1;

      system.update(0.1); // progress = 0.9 + 0.5 = 1.4, arrives at (1,0)

      // Should immediately start queued move
      expect(mov.tileX).toBe(1);
      expect(mov.tileZ).toBe(0);
      expect(mov.targetX).toBe(1);
      expect(mov.targetZ).toBe(1);
      expect(mov.moving).toBe(true);
      expect(mov.queuedDz).toBe(0); // Queue consumed
    });

    it("does not chain if no queued direction", () => {
      const mov = addMovableEntity("e-1", 0, 0, 5.0);
      mov.moving = true;
      mov.targetX = 1;
      mov.targetZ = 0;
      mov.progress = 0.9;

      system.update(0.1);
      expect(mov.moving).toBe(false); // Stopped
    });
  });

  describe("diagonal and negative movement", () => {
    it("moves in negative X direction", () => {
      const mov = addMovableEntity("e-1", 5, 5, 5.0);
      mov.moving = true;
      mov.targetX = 4;
      mov.targetZ = 5;
      mov.progress = 0;

      system.update(0.3); // Arrives
      expect(mov.tileX).toBe(4);
      expect(mov.tileZ).toBe(5);
    });

    it("moves in negative Z direction", () => {
      const mov = addMovableEntity("e-1", 0, 5, 5.0);
      mov.moving = true;
      mov.targetX = 0;
      mov.targetZ = 4;
      mov.progress = 0;

      system.update(0.3);
      expect(mov.tileZ).toBe(4);
    });
  });

  describe("multiple entities", () => {
    it("updates all movable entities independently", () => {
      const mov1 = addMovableEntity("e-1", 0, 0, 5.0);
      const mov2 = addMovableEntity("e-2", 10, 10, 10.0);

      mov1.moving = true;
      mov1.targetX = 1;
      mov1.progress = 0;

      mov2.moving = true;
      mov2.targetZ = 11;
      mov2.progress = 0;

      system.update(0.05);
      expect(mov1.progress).toBeCloseTo(0.25);
      expect(mov2.progress).toBeCloseTo(0.5); // Faster speed
    });
  });

  describe("entities without movement component", () => {
    it("skips entities without movement", () => {
      em.addEntity("static");
      em.addComponent("static", createPosition(5, 0, 5));
      // No movement component

      expect(() => system.update(0.05)).not.toThrow();
    });
  });
});
