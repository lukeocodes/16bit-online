/**
 * TrackRegistry maps MusicState + zone metadata to the correct track
 * factory function. It supports exact match by (state, zoneTag) with
 * fallback to the default track for a given state (first registered).
 *
 * Ready for Plan 03 to register all 16 tracks.
 */
import { MusicState } from "../types";
import type { BaseTrack } from "./BaseTrack";

export type TrackFactory = (ctx: AudioContext) => BaseTrack;

interface TrackEntry {
  id: string;
  state: MusicState;
  zoneTag?: string;
  factory: TrackFactory;
}

export class TrackRegistry {
  private entries: TrackEntry[] = [];
  private defaultsByState: Map<MusicState, TrackEntry> = new Map();

  /**
   * Register a track factory for a given state and optional zoneTag.
   * The first track registered for a state becomes the default fallback.
   */
  register(
    id: string,
    state: MusicState,
    zoneTag: string | undefined,
    factory: TrackFactory,
  ): void {
    const entry: TrackEntry = { id, state, zoneTag, factory };
    this.entries.push(entry);

    // First registered for a state becomes the default
    if (!this.defaultsByState.has(state)) {
      this.defaultsByState.set(state, entry);
    }
  }

  /**
   * Look up a track factory by state and optional zoneTag.
   *
   * Priority:
   *   1. Exact match: state + zoneTag both match
   *   2. Default fallback: first registered track for that state
   *   3. null if no match at all
   */
  getTrack(state: MusicState, zoneTag?: string): TrackFactory | null {
    // Try exact match first
    if (zoneTag !== undefined) {
      const exact = this.entries.find(
        (e) => e.state === state && e.zoneTag === zoneTag,
      );
      if (exact) {
        return exact.factory;
      }
    }

    // Fall back to default for this state
    const defaultEntry = this.defaultsByState.get(state);
    if (defaultEntry) {
      return defaultEntry.factory;
    }

    return null;
  }

  /**
   * Same lookup as getTrack but returns the track id string.
   */
  getTrackId(state: MusicState, zoneTag?: string): string | null {
    // Try exact match first
    if (zoneTag !== undefined) {
      const exact = this.entries.find(
        (e) => e.state === state && e.zoneTag === zoneTag,
      );
      if (exact) {
        return exact.id;
      }
    }

    // Fall back to default
    const defaultEntry = this.defaultsByState.get(state);
    if (defaultEntry) {
      return defaultEntry.id;
    }

    return null;
  }

  /**
   * Returns all registered track IDs.
   */
  getAllTrackIds(): string[] {
    return this.entries.map((e) => e.id);
  }

  /**
   * Returns the number of registered entries.
   */
  getEntryCount(): number {
    return this.entries.length;
  }

  /**
   * Clear all entries and defaults. Used for testing or full reset.
   */
  clear(): void {
    this.entries = [];
    this.defaultsByState.clear();
  }
}
