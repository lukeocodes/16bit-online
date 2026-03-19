import { describe, it, expect, beforeEach, vi } from "vitest";
import { AssetCache } from "./AssetCache";

// Mock Mesh with dispose()
function mockMesh(id = "mesh") {
  return { dispose: vi.fn(), name: id } as any;
}

describe("AssetCache", () => {
  let cache: AssetCache;

  beforeEach(() => {
    cache = new AssetCache();
  });

  describe("get / set", () => {
    it("stores and retrieves a mesh", () => {
      const mesh = mockMesh();
      cache.set("player-1", mesh);
      expect(cache.get("player-1")).toBe(mesh);
    });

    it("returns null for missing key", () => {
      expect(cache.get("nope")).toBeNull();
    });

    it("overwrites existing entry", () => {
      const mesh1 = mockMesh("a");
      const mesh2 = mockMesh("b");
      cache.set("key", mesh1);
      cache.set("key", mesh2);
      expect(cache.get("key")).toBe(mesh2);
    });
  });

  describe("dispose", () => {
    it("disposes mesh and removes from cache", () => {
      const mesh = mockMesh();
      cache.set("key", mesh);
      cache.dispose("key");
      expect(mesh.dispose).toHaveBeenCalled();
      expect(cache.get("key")).toBeNull();
    });

    it("is safe for missing key", () => {
      expect(() => cache.dispose("nope")).not.toThrow();
    });
  });

  describe("clear", () => {
    it("disposes all meshes", () => {
      const m1 = mockMesh();
      const m2 = mockMesh();
      cache.set("a", m1);
      cache.set("b", m2);

      cache.clear();
      expect(m1.dispose).toHaveBeenCalled();
      expect(m2.dispose).toHaveBeenCalled();
      expect(cache.get("a")).toBeNull();
      expect(cache.get("b")).toBeNull();
    });
  });

  describe("LRU eviction", () => {
    it("evicts oldest entry when cache is full", () => {
      vi.useFakeTimers();
      const localCache = new AssetCache();

      // Add oldest entry at t=0
      const oldest = mockMesh("oldest");
      localCache.set("oldest-key", oldest);

      // Add 199 more at t=100
      vi.advanceTimersByTime(100);
      for (let i = 1; i < 200; i++) {
        localCache.set(`key-${i}`, mockMesh(`mesh-${i}`));
      }

      // Access oldest to refresh its timestamp to t=200
      vi.advanceTimersByTime(100);
      localCache.get("oldest-key");

      // Add one more — should evict key-1 (oldest lastAccess at t=100)
      const newMesh = mockMesh("new");
      localCache.set("key-200", newMesh);

      // oldest-key should survive (accessed at t=200)
      expect(localCache.get("oldest-key")).not.toBeNull();
      // new entry should exist
      expect(localCache.get("key-200")).toBe(newMesh);
      // One mesh should have been disposed via eviction
      expect(oldest.dispose).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("disposes the evicted mesh", () => {
      vi.useFakeTimers();
      const localCache = new AssetCache();

      // Add entry that will be evicted
      const victim = mockMesh("victim");
      localCache.set("victim", victim);

      // Fill the rest at a later time
      vi.advanceTimersByTime(100);
      for (let i = 1; i < 200; i++) {
        localCache.set(`key-${i}`, mockMesh());
      }

      // Add 201st — victim (oldest at t=0) should be evicted
      localCache.set("overflow", mockMesh());
      expect(victim.dispose).toHaveBeenCalled();
      expect(localCache.get("victim")).toBeNull();

      vi.useRealTimers();
    });
  });
});
