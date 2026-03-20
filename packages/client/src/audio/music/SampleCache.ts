import * as Tone from "tone";
import { GM_INSTRUMENTS, SOUNDFONT_BASE, type InstrumentKey } from "./types";

interface CacheEntry {
  sampler: Tone.Sampler;
  lastUsed: number;
}

/**
 * LRU cache for Tone.Sampler instances loaded from FluidR3_GM CDN.
 * Fetches the soundfont JS file (contains base64 data URIs for all notes),
 * picks sparse notes for memory efficiency, and creates Tone.Samplers.
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

  async loadInstrument(key: InstrumentKey): Promise<Tone.Sampler> {
    const cached = this.cache.get(key);
    if (cached) {
      cached.lastUsed = ++this.accessCounter;
      return cached.sampler;
    }

    const existing = this.inflight.get(key);
    if (existing) {
      return existing;
    }

    const promise = this.createSampler(key);
    this.inflight.set(key, promise);

    try {
      const sampler = await promise;

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

  getLoadedCount(): number {
    return this.cache.size;
  }

  isLoaded(key: InstrumentKey): boolean {
    return this.cache.has(key);
  }

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

  disposeAll(): void {
    for (const [, entry] of this.cache) {
      entry.sampler.dispose();
    }
    this.cache.clear();
    this.inflight.clear();
  }

  private async createSampler(key: InstrumentKey): Promise<Tone.Sampler> {
    const gmName = GM_INSTRUMENTS[key];
    const jsUrl = `${SOUNDFONT_BASE}${gmName}-mp3.js`;

    // Fetch the soundfont JS file containing base64 data URIs
    const response = await fetch(jsUrl);
    if (!response.ok) {
      throw new Error(`Failed to load soundfont: ${jsUrl} (${response.status})`);
    }
    const jsText = await response.text();

    // Parse the JS: format is MIDI.Soundfont.instrument_name = { "C4": "data:audio/mp3;base64,...", ... }
    const urls = this.parseSoundfontJS(jsText);
    // Load ALL notes from the soundfont. Since it's a single JS file fetch,
    // there's no network cost to loading every note. This avoids Sampler
    // interpolation issues where sparse buffers haven't decoded yet.
    const noteCount = Object.keys(urls).length;
    console.log(`[SampleCache] Parsed ${noteCount} notes for ${gmName}, first keys:`, Object.keys(urls).slice(0, 5));

    return new Promise<Tone.Sampler>((resolve, reject) => {
      const sampler = new Tone.Sampler({
        urls,
        onload: () => {
          console.log(`[SampleCache] Sampler loaded for ${gmName}, loaded=${sampler.loaded}`);
          resolve(sampler);
        },
        onerror: (err: Error) => {
          console.error(`[SampleCache] Sampler error for ${gmName}:`, err);
          reject(err);
        },
      });
    });
  }

  /**
   * Parse the soundfont JS file format:
   * `MIDI.Soundfont.instrument_name = { "C4": "data:audio/...", ... }`
   * Returns a Record<noteName, dataURI>.
   *
   * Uses regex to extract key-value pairs since the base64 data URIs
   * can contain { and } characters that break naive brace matching.
   */
  private parseSoundfontJS(jsText: string): Record<string, string> {
    const result: Record<string, string> = {};

    // Match patterns like: "Ab4": "data:audio/mp3;base64,..."
    // Note names are 1-3 chars + digit, values are data URIs
    const noteRegex = /"([A-Ga-g][b#]?\d)"\s*:\s*"(data:audio[^"]+)"/g;
    let match: RegExpExecArray | null;

    while ((match = noteRegex.exec(jsText)) !== null) {
      result[match[1]] = match[2];
    }

    return result;
  }
}
