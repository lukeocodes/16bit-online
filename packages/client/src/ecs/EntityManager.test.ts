import { describe, it, expect, beforeEach, vi } from "vitest";
import { EntityManager } from "./EntityManager";
import { createPosition } from "./components/Position";
import { createMovement } from "./components/Movement";
import { createRenderable } from "./components/Renderable";
import { createStats } from "./components/Stats";
import { createCombat } from "./components/Combat";

describe("EntityManager", () => {
  let em: EntityManager;

  beforeEach(() => {
    em = new EntityManager();
  });

  describe("addEntity / getEntity / removeEntity", () => {
    it("creates and retrieves an entity", () => {
      em.addEntity("e-1");
      expect(em.getEntity("e-1")).toBeDefined();
      expect(em.getEntity("e-1")!.id).toBe("e-1");
    });

    it("returns undefined for unknown entity", () => {
      expect(em.getEntity("nope")).toBeUndefined();
    });

    it("removes an entity", () => {
      em.addEntity("e-1");
      em.removeEntity("e-1");
      expect(em.getEntity("e-1")).toBeUndefined();
    });

    it("remove is safe for non-existent entity", () => {
      expect(() => em.removeEntity("ghost")).not.toThrow();
    });

    it("disposes mesh on removal when renderable has a mesh", () => {
      em.addEntity("e-mesh");
      const renderable = createRenderable();
      renderable.mesh = { dispose: vi.fn() } as any; // Mock Babylon mesh
      em.addComponent("e-mesh", renderable);

      em.removeEntity("e-mesh");
      expect(renderable.mesh!.dispose).toHaveBeenCalled();
    });

    it("handles removal with renderable but no mesh", () => {
      em.addEntity("e-no-mesh");
      em.addComponent("e-no-mesh", createRenderable()); // mesh is null by default

      expect(() => em.removeEntity("e-no-mesh")).not.toThrow();
    });

    it("tracks entity count", () => {
      expect(em.getEntityCount()).toBe(0);
      em.addEntity("a");
      em.addEntity("b");
      expect(em.getEntityCount()).toBe(2);
      em.removeEntity("a");
      expect(em.getEntityCount()).toBe(1);
    });
  });

  describe("addComponent / getComponent", () => {
    it("adds and retrieves a component", () => {
      em.addEntity("e-1");
      em.addComponent("e-1", createPosition(5, 0, 10));
      const pos = em.getComponent("e-1", "position");
      expect(pos).toBeDefined();
      expect(pos!.type).toBe("position");
    });

    it("returns undefined for missing component", () => {
      em.addEntity("e-1");
      expect(em.getComponent("e-1", "stats")).toBeUndefined();
    });

    it("ignores add for non-existent entity", () => {
      expect(() => em.addComponent("nope", createPosition())).not.toThrow();
    });

    it("replaces component of same type", () => {
      em.addEntity("e-1");
      em.addComponent("e-1", createStats(5, 5, 20));
      em.addComponent("e-1", createStats(15, 10, 5));
      const stats = em.getComponent("e-1", "stats");
      expect(stats!.str).toBe(15);
    });
  });

  describe("getEntitiesWithComponents", () => {
    it("filters by single component type", () => {
      em.addEntity("e-1");
      em.addComponent("e-1", createPosition());
      em.addEntity("e-2"); // no position

      const result = em.getEntitiesWithComponents("position");
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("e-1");
    });

    it("filters by multiple component types", () => {
      em.addEntity("e-1");
      em.addComponent("e-1", createPosition());
      em.addComponent("e-1", createMovement());

      em.addEntity("e-2");
      em.addComponent("e-2", createPosition()); // no movement

      const result = em.getEntitiesWithComponents("position", "movement");
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("e-1");
    });

    it("returns empty when no matches", () => {
      em.addEntity("e-1");
      expect(em.getEntitiesWithComponents("combat")).toEqual([]);
    });
  });

  describe("spatial grid", () => {
    it("finds entity in radius", () => {
      em.addEntity("e-1");
      em.addComponent("e-1", createPosition(5, 0, 5));

      const results = em.getEntitiesInRadius(5, 5, 10);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("e-1");
    });

    it("excludes entities outside radius", () => {
      em.addEntity("e-1");
      em.addComponent("e-1", createPosition(100, 0, 100));

      const results = em.getEntitiesInRadius(0, 0, 10);
      expect(results.length).toBe(0);
    });

    it("handles entities in different cells", () => {
      // Cell size is 16, so these are in different cells
      em.addEntity("e-1");
      em.addComponent("e-1", createPosition(0, 0, 0));
      em.addEntity("e-2");
      em.addComponent("e-2", createPosition(20, 0, 20));

      // Large radius should find both
      const results = em.getEntitiesInRadius(10, 10, 30);
      expect(results.length).toBe(2);
    });

    it("cleans up spatial grid on entity removal", () => {
      em.addEntity("e-1");
      em.addComponent("e-1", createPosition(5, 0, 5));

      em.removeEntity("e-1");
      const results = em.getEntitiesInRadius(5, 5, 10);
      expect(results.length).toBe(0);
    });

    it("updateSpatialIndex moves entity between cells", () => {
      em.addEntity("e-1");
      em.addComponent("e-1", createPosition(0, 0, 0));

      // Move from cell (0,0) to cell (2,0) — crosses 16-tile boundary
      em.updateSpatialIndex("e-1", 0, 0, 40, 0);

      // Old position should not find it
      const oldResults = em.getEntitiesInRadius(0, 0, 5);
      expect(oldResults.length).toBe(0);

      // Need to also update the position component for getEntitiesInRadius to find it
      const pos = em.getComponent("e-1", "position");
      if (pos) {
        (pos as any).x = 40;
      }
      const newResults = em.getEntitiesInRadius(40, 0, 5);
      expect(newResults.length).toBe(1);
    });

    it("handles same-cell moves without breaking", () => {
      em.addEntity("e-1");
      em.addComponent("e-1", createPosition(1, 0, 1));

      // Move within same cell (both in cell 0,0)
      em.updateSpatialIndex("e-1", 1, 1, 5, 5);

      const results = em.getEntitiesInRadius(3, 3, 10);
      expect(results.length).toBe(1);
    });

    it("cleans up empty old cell on cross-cell move", () => {
      // Only entity in cell 0,0 — moving it should delete that cell
      em.addEntity("solo");
      em.addComponent("solo", createPosition(0, 0, 0));

      // Move to a different cell (cell size = 16)
      em.updateSpatialIndex("solo", 0, 0, 20, 0);
      const pos = em.getComponent("solo", "position") as any;
      pos.x = 20;

      // Old cell should be cleaned up — query at origin finds nothing
      expect(em.getEntitiesInRadius(0, 0, 5)).toEqual([]);
      // New cell has the entity
      expect(em.getEntitiesInRadius(20, 0, 5).length).toBe(1);
    });

    it("does not clean old cell if other entities remain", () => {
      em.addEntity("a");
      em.addComponent("a", createPosition(1, 0, 1));
      em.addEntity("b");
      em.addComponent("b", createPosition(2, 0, 2)); // Same cell as "a"

      // Move "a" to different cell, "b" stays
      em.updateSpatialIndex("a", 1, 1, 20, 0);
      const posA = em.getComponent("a", "position") as any;
      posA.x = 20;

      // "b" should still be findable at origin
      expect(em.getEntitiesInRadius(2, 2, 5).length).toBe(1);
      expect(em.getEntitiesInRadius(2, 2, 5)[0].id).toBe("b");
    });

    it("updateSpatialIndex with unknown entity does not crash", () => {
      expect(() => em.updateSpatialIndex("nope", 0, 0, 10, 10)).not.toThrow();
    });

    it("getEntitiesInRadius skips entities removed from Map but still in grid", () => {
      em.addEntity("temp");
      em.addComponent("temp", createPosition(5, 0, 5));

      // Directly delete from entities Map to simulate inconsistency
      // (This tests the `if (!entity) continue` guard in getEntitiesInRadius)
      (em as any).entities.delete("temp");

      const results = em.getEntitiesInRadius(5, 5, 10);
      expect(results.length).toBe(0);
    });
  });

  describe("getAllEntities", () => {
    it("iterates all entities", () => {
      em.addEntity("a");
      em.addEntity("b");
      em.addEntity("c");

      const ids = [...em.getAllEntities()].map(e => e.id);
      expect(ids).toContain("a");
      expect(ids).toContain("b");
      expect(ids).toContain("c");
    });
  });
});
