/**
 * MusicContentManager orchestrates the track lifecycle between the
 * MusicStateMachine and CrossfadeManager. On each state transition it:
 *   1. Resolves the correct track via TrackRegistry (using current zone metadata)
 *   2. Loads the track onto the inactive CrossFade side
 *   3. Disposes the old track that was on that side
 *   4. Applies session BPM drift for non-combat states
 *   5. Delegates combat/boss/proximity updates to the active track
 */
import * as Tone from "tone";
import { TrackRegistry } from "./TrackRegistry";
import { SampleCache } from "./SampleCache";
import { BaseTrack } from "./BaseTrack";
import { CombatTrack } from "./tracks/CombatTrack";
import { BossFightTrack } from "./tracks/BossFightTrack";
import { EnemyNearbyTrack } from "./tracks/EnemyNearbyTrack";
import { registerAllTracks } from "./tracks/index";
import type { CrossfadeManager } from "../CrossfadeManager";
import type { MusicStateMachine } from "../MusicStateMachine";
import { MusicState } from "../types";

/** Max BPM drift applied on non-combat zone entries */
const SESSION_BPM_DRIFT = 4;

export class MusicContentManager {
  private ctx: AudioContext;
  private musicStateMachine: MusicStateMachine;
  private crossfadeManager: CrossfadeManager;
  private trackRegistry: TrackRegistry;
  private sampleCache: SampleCache;
  private activeTracks: Map<"a" | "b", BaseTrack> = new Map();
  private activeTrackIds: Map<"a" | "b", string> = new Map();
  private currentZoneTag: string | undefined = undefined;
  private baseBPM: number = 120;

  constructor(
    ctx: AudioContext,
    musicStateMachine: MusicStateMachine,
    crossfadeManager: CrossfadeManager,
  ) {
    this.ctx = ctx;
    this.musicStateMachine = musicStateMachine;
    this.crossfadeManager = crossfadeManager;

    this.trackRegistry = new TrackRegistry();
    this.sampleCache = new SampleCache(8);

    registerAllTracks(this.trackRegistry, ctx, this.sampleCache);

    musicStateMachine.onTransition((from, to) => this.handleTransition(from, to));
  }

  /**
   * Handle a music state transition by loading the appropriate track
   * onto the inactive CrossFade side. Samples are loaded before
   * sequences start to prevent "no buffer" errors.
   */
  handleTransition(from: MusicState, to: MusicState): void {
    // Fire the async load — errors are caught and logged
    this.loadAndStartTrack(from, to).catch((err) => {
      console.warn(`[MusicContentManager] Track transition failed:`, err);
    });
  }

  private async loadAndStartTrack(from: MusicState, to: MusicState): Promise<void> {
    const factory = this.trackRegistry.getTrack(to, this.currentZoneTag);
    if (!factory) {
      console.warn(`[MusicContentManager] No track found for state=${to}, zone=${this.currentZoneTag}`);
      return;
    }

    const trackId = this.trackRegistry.getTrackId(to, this.currentZoneTag);

    // Determine inactive side
    const side: "a" | "b" = this.crossfadeManager.getCurrentSide() === "a" ? "b" : "a";

    // Stop and dispose any existing track on the inactive side
    const existing = this.activeTracks.get(side);
    if (existing) {
      existing.dispose();
      this.activeTracks.delete(side);
      this.activeTrackIds.delete(side);
    }

    // Save BPM before combat/boss tracks change it
    if (to === MusicState.Combat || to === MusicState.Boss) {
      this.baseBPM = Tone.getTransport().bpm.value;
    }

    // Create new track
    const track = factory(this.ctx);

    // Connect to CrossFade side
    track.connect(this.crossfadeManager.getCrossFade()[side]);

    // Apply session BPM drift for non-combat/non-boss states
    if (to !== MusicState.Combat && to !== MusicState.Boss) {
      this.applySessionBPMDrift();
    }

    // Await sample loading — sequences don't start until buffers are ready
    console.log(`[MusicContentManager] Loading track ${trackId}...`);
    await track.start();
    console.log(`[MusicContentManager] Track ${trackId} started on side ${side}`);

    // Store
    this.activeTracks.set(side, track);
    if (trackId) {
      this.activeTrackIds.set(side, trackId);
    }

    // Restore BPM when leaving combat/boss
    if (
      (from === MusicState.Combat || from === MusicState.Boss) &&
      to !== MusicState.Combat &&
      to !== MusicState.Boss
    ) {
      Tone.getTransport().bpm.rampTo(this.baseBPM, 2);
    }
  }

  /**
   * Set the current zone metadata tag (e.g., "human", "elf", "dwarf").
   * Subsequent track lookups will use this tag for zone-specific track resolution.
   */
  setZoneMetadata(zoneTag: string | undefined): void {
    this.currentZoneTag = zoneTag;
  }

  /**
   * Update enemy count for active CombatTrack (scales BPM dynamically).
   */
  updateEnemyCount(count: number): void {
    for (const track of this.activeTracks.values()) {
      if (track instanceof CombatTrack) {
        track.updateEnemyCount(count);
        return;
      }
    }
  }

  /**
   * Update boss HP percentage for active BossFightTrack (drives phase transitions).
   */
  updateBossHP(hpPercent: number): void {
    for (const track of this.activeTracks.values()) {
      if (track instanceof BossFightTrack) {
        track.updateBossPhase(hpPercent);
        return;
      }
    }
  }

  /**
   * Update enemy proximity tension for active EnemyNearbyTrack.
   */
  updateEnemyProximity(normalizedDistance: number): void {
    for (const track of this.activeTracks.values()) {
      if (track instanceof EnemyNearbyTrack) {
        track.updateProximityTension(normalizedDistance);
        return;
      }
    }
  }

  /**
   * Update player position for proximity-based stem fading on all active tracks.
   * Uses placeholder POI at origin until settlement system delivers real POIs.
   */
  updatePlayerPosition(playerPos: { x: number; z: number }): void {
    for (const track of this.activeTracks.values()) {
      track.updateProximity(playerPos, { x: 0, z: 0 });
    }
  }

  /**
   * Apply a random session BPM drift within +/-4 BPM range.
   * Called on non-combat/non-boss zone entries for musical variety.
   */
  applySessionBPMDrift(): void {
    const drift = (Math.random() * SESSION_BPM_DRIFT * 2) - SESSION_BPM_DRIFT;
    const transport = Tone.getTransport();
    transport.bpm.value = this.baseBPM + drift;
  }

  /**
   * Get the track ID on a given CrossFade side, or null if none.
   */
  getActiveTrackId(side: "a" | "b"): string | null {
    return this.activeTrackIds.get(side) ?? null;
  }

  /**
   * Returns the internal track registry (for dev API inspection).
   */
  getTrackRegistry(): TrackRegistry {
    return this.trackRegistry;
  }

  /**
   * Dispose all active tracks, sample cache, and clear state.
   */
  dispose(): void {
    for (const track of this.activeTracks.values()) {
      track.dispose();
    }
    this.activeTracks.clear();
    this.activeTrackIds.clear();
    this.sampleCache.disposeAll();
    this.trackRegistry.clear();
  }
}
