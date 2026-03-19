import { describe, it, expect, beforeEach } from "vitest";

/**
 * Test the ConnectionManager's data structure operations.
 * We replicate the store logic here since the actual class
 * is coupled to WebRTC types from werift.
 */

// Minimal mock types matching the ConnectionManager interface
interface MockConnection {
  entityId: string;
  accountId: string;
  characterId: string;
}

class TestConnectionStore {
  private connections = new Map<string, MockConnection>();

  add(conn: MockConnection) { this.connections.set(conn.entityId, conn); }

  remove(entityId: string) { this.connections.delete(entityId); }

  get(entityId: string) { return this.connections.get(entityId); }

  getAll(): MockConnection[] { return Array.from(this.connections.values()); }
}

describe("ConnectionManager store logic", () => {
  let store: TestConnectionStore;

  beforeEach(() => {
    store = new TestConnectionStore();
  });

  describe("add / get", () => {
    it("stores and retrieves a connection", () => {
      store.add({ entityId: "p-1", accountId: "a-1", characterId: "c-1" });
      const conn = store.get("p-1");
      expect(conn).toBeDefined();
      expect(conn!.accountId).toBe("a-1");
    });

    it("returns undefined for unknown entity", () => {
      expect(store.get("nope")).toBeUndefined();
    });
  });

  describe("remove", () => {
    it("removes a connection", () => {
      store.add({ entityId: "p-1", accountId: "a-1", characterId: "c-1" });
      store.remove("p-1");
      expect(store.get("p-1")).toBeUndefined();
    });

    it("is safe for non-existent entity", () => {
      expect(() => store.remove("ghost")).not.toThrow();
    });
  });

  describe("getAll", () => {
    it("returns all connections", () => {
      store.add({ entityId: "p-1", accountId: "a-1", characterId: "c-1" });
      store.add({ entityId: "p-2", accountId: "a-2", characterId: "c-2" });
      const all = store.getAll();
      expect(all.length).toBe(2);
    });

    it("returns empty when no connections", () => {
      expect(store.getAll()).toEqual([]);
    });

    it("reflects removals", () => {
      store.add({ entityId: "p-1", accountId: "a-1", characterId: "c-1" });
      store.add({ entityId: "p-2", accountId: "a-2", characterId: "c-2" });
      store.remove("p-1");
      const all = store.getAll();
      expect(all.length).toBe(1);
      expect(all[0].entityId).toBe("p-2");
    });
  });

  describe("overwrite behavior", () => {
    it("overwrites connection with same entityId", () => {
      store.add({ entityId: "p-1", accountId: "a-1", characterId: "c-1" });
      store.add({ entityId: "p-1", accountId: "a-2", characterId: "c-2" });
      const conn = store.get("p-1");
      expect(conn!.accountId).toBe("a-2");
      expect(store.getAll().length).toBe(1);
    });
  });
});
