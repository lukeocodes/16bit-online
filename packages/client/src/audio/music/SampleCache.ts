import * as Tone from "tone";
import { GM_INSTRUMENTS, SOUNDFONT_BASE, type InstrumentKey } from "./types";

/** Sparse note set for Tone.Sampler (every major 3rd for memory efficiency) */
const SPARSE_NOTES = ["C", "E", "Ab"];
const OCTAVE_RANGE = [2, 3, 4, 5, 6];

/** Generates the URL mapping for sparse note sampling */
function getSamplerUrls(): Record<string, string> {
  const urls: Record<string, string> = {};
  for (const oct of OCTAVE_RANGE) {
    for (const note of SPARSE_NOTES) {
      urls[`${note}${oct}`] = `${note}${oct}.mp3`;
    }
  }
  return urls;
}

interface CacheEntry {
  sampler: Tone.Sampler;
  lastUsed: number;
}

/**
 * LRU cache for Tone.Sampler instances loaded from FluidR3_GM CDN.
 * Evicts least-recently-used instruments when exceeding max count.
 */
export class SampleCache {
  private cache = new Map<string, CacheEntry>();
  private inflight = new Map<string, Promise<Tone.Sampler>>();
  private maxInstruments: number;
  private accessCounter = 0;

  constructor(maxInstruments: number = 8) {
    this.maxInstruments = maxInstruments;
  }

  /**
   * Load an instrument by key. Returns cached instance if available.
   * Creates a new Tone.Sampler if not cached. Evicts LRU if over limit.
   */
  async loadInstrument(key: InstrumentKey): Promise<Tone.Sampler> {
    // Check cache hit — update lastUsed timestamp
    const cached = this.cache.get(key);
    if (cached) {
      cached.lastUsed = ++this.accessCounter;
      return cached.sampler;
    }

    // Check if already loading (prevent duplicate requests)
    const existing = this.inflight.get(key);
    if (existing) {
      return existing;
    }

    // Create new sampler
    const promise = this.createSampler(key);
    this.inflight.set(key, promise);

    try {
      const sampler = await promise;

      // Evict LRU if over limit
      if (this.cache.size >= this.maxInstruments) {
        this.evictLRU();
      }

      this.cache.set(key, {
        sampler,
        lastUsed: ++this.accessCounter,
      });

      return sampler;
    } finally {
      this.inflight.delete(key);
    }
  }

  /** Returns the number of cached instruments */
  getLoadedCount(): number {
    return this.cache.size;
  }

  /** Check if an instrument is currently cached */
  isLoaded(key: InstrumentKey): boolean {
    return this.cache.has(key);
  }

  /** Evict the least recently used instrument */
  evictLRU(): void {
    let oldest: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldest = key;
      }
    }

    if (oldest) {
      const entry = this.cache.get(oldest);
      if (entry) {
        entry.sampler.dispose();
      }
      this.cache.delete(oldest);
    }
  }

  /** Dispose all cached samplers and clear the cache */
  disposeAll(): void {
    for (const [, entry] of this.cache) {
      entry.sampler.dispose();
    }
    this.cache.clear();
    this.inflight.clear();
  }

  private createSampler(key: InstrumentKey): Promise<Tone.Sampler> {
    const gmName = GM_INSTRUMENTS[key];
    const baseUrl = `${SOUNDFONT_BASE}${gmName}-mp3/`;
    const urls = getSamplerUrls();

    // Use a ref object to avoid TDZ when onload fires synchronously (test mocks).
    // The ref is assigned after construction, and onload defers resolve via microtask.
    const ref: { sampler: Tone.Sampler | null } = { sampler: null };

    return new Promise<Tone.Sampler>((resolve, reject) => {
      ref.sampler = new Tone.Sampler({
        urls,
        baseUrl,
        onload: () => {
          // Use queueMicrotask to ensure ref.sampler is assigned
          // (handles both sync mock and async production cases)
          queueMicrotask(() => resolve(ref.sampler!));
        },
        onerror: (err: Error) => {
          queueMicrotask(() => reject(err));
        },
      });
    });
  }
}
