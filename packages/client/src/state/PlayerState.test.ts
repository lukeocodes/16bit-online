import { describe, it, expect, beforeEach } from "vitest";
import { PlayerState, type PlayerData } from "./PlayerState";

const mockPlayer: PlayerData = {
  characterId: "c-1",
  name: "Hero",
  race: "human",
  gender: "male",
  level: 5,
  str: 10, dex: 10, int: 10,
  hp: 50, maxHp: 50,
  mana: 30, maxMana: 30,
  stamina: 40, maxStamina: 40,
};

describe("PlayerState", () => {
  let state: PlayerState;

  beforeEach(() => {
    state = new PlayerState();
  });

  it("starts empty", () => {
    expect(state.getPlayerData()).toBeNull();
  });

  it("stores and retrieves player data", () => {
    state.setPlayerData(mockPlayer);
    expect(state.getPlayerData()).toEqual(mockPlayer);
  });

  it("clear removes player data", () => {
    state.setPlayerData(mockPlayer);
    state.clear();
    expect(state.getPlayerData()).toBeNull();
  });

  it("overwrites existing data", () => {
    state.setPlayerData(mockPlayer);
    const updated = { ...mockPlayer, hp: 25 };
    state.setPlayerData(updated);
    expect(state.getPlayerData()!.hp).toBe(25);
  });
});
