/**
 * Track index — re-exports all 16 track classes and provides
 * registerAllTracks() to bulk-register them with the TrackRegistry.
 */
import { MusicState } from "../../types";
import type { TrackRegistry } from "../TrackRegistry";
import type { SampleCache } from "../SampleCache";

// Town tracks
import { HumanTownTrack } from "./HumanTownTrack";
import { ElfTownTrack } from "./ElfTownTrack";
import { DwarfTownTrack } from "./DwarfTownTrack";
import { HumanCapitalTrack } from "./HumanCapitalTrack";
import { ElfCapitalTrack } from "./ElfCapitalTrack";
import { DwarfCapitalTrack } from "./DwarfCapitalTrack";

// Dungeon tracks
import { SoloDungeonTrack } from "./SoloDungeonTrack";
import { GroupDungeonTrack } from "./GroupDungeonTrack";

// Exploration tracks
import { GrasslandsTrack } from "./GrasslandsTrack";
import { ForestTrack } from "./ForestTrack";
import { DesertTrack } from "./DesertTrack";
import { MountainsTrack } from "./MountainsTrack";

// Combat / special tracks
import { CombatTrack } from "./CombatTrack";
import { BossFightTrack } from "./BossFightTrack";
import { EnemyNearbyTrack } from "./EnemyNearbyTrack";
import { VictoryStinger } from "./VictoryStinger";

export {
  HumanTownTrack,
  ElfTownTrack,
  DwarfTownTrack,
  HumanCapitalTrack,
  ElfCapitalTrack,
  DwarfCapitalTrack,
  SoloDungeonTrack,
  GroupDungeonTrack,
  GrasslandsTrack,
  ForestTrack,
  DesertTrack,
  MountainsTrack,
  CombatTrack,
  BossFightTrack,
  EnemyNearbyTrack,
  VictoryStinger,
};

/**
 * Register all 16 tracks with the TrackRegistry.
 * Each track is registered with its MusicState and optional zoneTag.
 */
export function registerAllTracks(
  registry: TrackRegistry,
  ctx: AudioContext,
  sampleCache: SampleCache
): void {
  // Town tracks (6)
  registry.register("human-town", MusicState.Town, "human", (ctx) => new HumanTownTrack(ctx, sampleCache));
  registry.register("elf-town", MusicState.Town, "elf", (ctx) => new ElfTownTrack(ctx, sampleCache));
  registry.register("dwarf-town", MusicState.Town, "dwarf", (ctx) => new DwarfTownTrack(ctx, sampleCache));
  registry.register("human-capital", MusicState.Town, "human-capital", (ctx) => new HumanCapitalTrack(ctx, sampleCache));
  registry.register("elf-capital", MusicState.Town, "elf-capital", (ctx) => new ElfCapitalTrack(ctx, sampleCache));
  registry.register("dwarf-capital", MusicState.Town, "dwarf-capital", (ctx) => new DwarfCapitalTrack(ctx, sampleCache));

  // Dungeon tracks (2)
  registry.register("solo-dungeon", MusicState.Dungeon, "solo", (ctx) => new SoloDungeonTrack(ctx, sampleCache));
  registry.register("group-dungeon", MusicState.Dungeon, "group", (ctx) => new GroupDungeonTrack(ctx, sampleCache));

  // Exploration tracks (4)
  registry.register("grasslands", MusicState.Exploring, "grasslands", (ctx) => new GrasslandsTrack(ctx, sampleCache));
  registry.register("forest", MusicState.Exploring, "forest", (ctx) => new ForestTrack(ctx, sampleCache));
  registry.register("desert", MusicState.Exploring, "desert", (ctx) => new DesertTrack(ctx, sampleCache));
  registry.register("mountains", MusicState.Exploring, "mountains", (ctx) => new MountainsTrack(ctx, sampleCache));

  // Combat tracks (2)
  registry.register("combat", MusicState.Combat, undefined, (ctx) => new CombatTrack(ctx, sampleCache));
  registry.register("boss-fight", MusicState.Boss, undefined, (ctx) => new BossFightTrack(ctx, sampleCache));

  // Special tracks (2)
  registry.register("enemy-nearby", MusicState.EnemyNearby, undefined, (ctx) => new EnemyNearbyTrack(ctx));
  registry.register("victory", MusicState.Victory, undefined, (ctx) => new VictoryStinger(ctx));
}
