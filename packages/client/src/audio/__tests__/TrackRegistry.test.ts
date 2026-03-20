// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MusicState } from "../types";
import { TrackRegistry } from "../music/TrackRegistry";
import type { BaseTrack } from "../music/BaseTrack";

// Simple mock track factory for testing
function mockFactory(_ctx: AudioContext): BaseTrack {
  return { id: "mock" } as unknown as BaseTrack;
}

function namedFactory(id: string): (ctx: AudioContext) => BaseTrack {
  return (_ctx: AudioContext) => ({ id } as unknown as BaseTrack);
}

describe("TrackRegistry", () => {
  let registry: TrackRegistry;

  beforeEach(() => {
    registry = new TrackRegistry();
  });

  it("register stores a track entry", () => {
    registry.register("human-town", MusicState.Town, "human", mockFactory);

    expect(registry.getEntryCount()).toBe(1);
    expect(registry.getAllTrackIds()).toContain("human-town");
  });

  it("getTrack with exact state + zoneTag returns the correct factory", () => {
    const humanFactory = namedFactory("human-town");
    registry.register("human-town", MusicState.Town, "human", humanFactory);

    const result = registry.getTrack(MusicState.Town, "human");
    expect(result).toBe(humanFactory);
  });

  it("getTrack with different zoneTag returns correct factory (elf, not human)", () => {
    const humanFactory = namedFactory("human-town");
    const elfFactory = namedFactory("elf-town");
    registry.register("human-town", MusicState.Town, "human", humanFactory);
    registry.register("elf-town", MusicState.Town, "elf", elfFactory);

    const result = registry.getTrack(MusicState.Town, "elf");
    expect(result).toBe(elfFactory);
  });

  it("getTrack with undefined zoneTag returns default town track (first registered)", () => {
    const humanFactory = namedFactory("human-town");
    const elfFactory = namedFactory("elf-town");
    registry.register("human-town", MusicState.Town, "human", humanFactory);
    registry.register("elf-town", MusicState.Town, "elf", elfFactory);

    const result = registry.getTrack(MusicState.Town, undefined);
    // First registered for state becomes the default
    expect(result).toBe(humanFactory);
  });

  it("getTrack for exploring with zoneTag returns correct biome track", () => {
    const grasslandsFactory = namedFactory("grasslands");
    registry.register(
      "grasslands",
      MusicState.Exploring,
      "grasslands",
      grasslandsFactory,
    );

    const result = registry.getTrack(MusicState.Exploring, "grasslands");
    expect(result).toBe(grasslandsFactory);
  });

  it("getTrack for combat with undefined zoneTag returns generic combat track", () => {
    const combatFactory = namedFactory("combat");
    registry.register(
      "combat",
      MusicState.Combat,
      undefined,
      combatFactory,
    );

    const result = registry.getTrack(MusicState.Combat, undefined);
    expect(result).toBe(combatFactory);
  });

  it("getAllTrackIds returns array of all registered track IDs", () => {
    registry.register("human-town", MusicState.Town, "human", mockFactory);
    registry.register("elf-town", MusicState.Town, "elf", mockFactory);
    registry.register("combat", MusicState.Combat, undefined, mockFactory);

    const ids = registry.getAllTrackIds();
    expect(ids).toHaveLength(3);
    expect(ids).toContain("human-town");
    expect(ids).toContain("elf-town");
    expect(ids).toContain("combat");
  });

  it("getTrack for unregistered state returns null", () => {
    registry.register("human-town", MusicState.Town, "human", mockFactory);

    const result = registry.getTrack(MusicState.Dungeon, undefined);
    expect(result).toBeNull();
  });

  it("getTrackId returns the id string for a matching entry", () => {
    registry.register("human-town", MusicState.Town, "human", mockFactory);

    const id = registry.getTrackId(MusicState.Town, "human");
    expect(id).toBe("human-town");
  });

  it("getTrackId returns null for unregistered state", () => {
    const id = registry.getTrackId(MusicState.Boss, undefined);
    expect(id).toBeNull();
  });

  it("clear empties all entries and defaults", () => {
    registry.register("human-town", MusicState.Town, "human", mockFactory);
    registry.register("combat", MusicState.Combat, undefined, mockFactory);

    registry.clear();

    expect(registry.getEntryCount()).toBe(0);
    expect(registry.getAllTrackIds()).toHaveLength(0);
    expect(registry.getTrack(MusicState.Town, "human")).toBeNull();
  });

  it("default fallback works when exact zoneTag has no match", () => {
    const humanFactory = namedFactory("human-town");
    registry.register("human-town", MusicState.Town, "human", humanFactory);

    // Request with a zoneTag that doesn't match any entry
    const result = registry.getTrack(MusicState.Town, "orc");
    // Should fall back to the default for Town state (first registered = human)
    expect(result).toBe(humanFactory);
  });
});
