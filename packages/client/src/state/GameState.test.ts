import { describe, it, expect, beforeEach } from "vitest";
import { GameState } from "./GameState";

describe("GameState", () => {
  let state: GameState;

  beforeEach(() => {
    state = new GameState();
  });

  describe("set / get", () => {
    it("stores and retrieves a value", () => {
      state.set("hp", 50);
      expect(state.get<number>("hp")).toBe(50);
    });

    it("handles different types", () => {
      state.set("name", "Hero");
      state.set("alive", true);
      state.set("pos", { x: 1, z: 2 });

      expect(state.get<string>("name")).toBe("Hero");
      expect(state.get<boolean>("alive")).toBe(true);
      expect(state.get<{ x: number; z: number }>("pos")).toEqual({ x: 1, z: 2 });
    });

    it("returns undefined for missing keys", () => {
      expect(state.get("nope")).toBeUndefined();
    });

    it("overwrites existing values", () => {
      state.set("hp", 50);
      state.set("hp", 30);
      expect(state.get<number>("hp")).toBe(30);
    });
  });

  describe("has", () => {
    it("returns true for existing keys", () => {
      state.set("key", "val");
      expect(state.has("key")).toBe(true);
    });

    it("returns false for missing keys", () => {
      expect(state.has("missing")).toBe(false);
    });
  });

  describe("delete", () => {
    it("removes a key", () => {
      state.set("hp", 50);
      state.delete("hp");
      expect(state.has("hp")).toBe(false);
      expect(state.get("hp")).toBeUndefined();
    });

    it("is safe for missing keys", () => {
      expect(() => state.delete("nope")).not.toThrow();
    });
  });

  describe("clear", () => {
    it("removes all keys", () => {
      state.set("a", 1);
      state.set("b", 2);
      state.set("c", 3);
      state.clear();
      expect(state.has("a")).toBe(false);
      expect(state.has("b")).toBe(false);
      expect(state.has("c")).toBe(false);
    });
  });
});
