// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock tone module
vi.mock("tone", () => {
  class MockSampler {
    urls: Record<string, string>;
    baseUrl: string;
    triggerAttackRelease = vi.fn();
    dispose = vi.fn();
    connect = vi.fn(() => this);
    toDestination = vi.fn(() => this);

    constructor(opts: {
      urls: Record<string, string>;
      baseUrl: string;
      onload?: () => void;
      onerror?: (err: Error) => void;
    }) {
      this.urls = opts.urls;
      this.baseUrl = opts.baseUrl;
      // Call onload synchronously for test simplicity
      if (opts.onload) {
        opts.onload();
      }
    }
  }

  return {
    Sampler: MockSampler,
  };
});

// Import after mocks
import { SampleCache } from "../music/SampleCache";

describe("SampleCache", () => {
  let cache: SampleCache;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new SampleCache(3);
  });

  it("loadInstrument returns an object with triggerAttackRelease method", async () => {
    const sampler = await cache.loadInstrument("flute");
    expect(sampler).toBeDefined();
    expect(typeof sampler.triggerAttackRelease).toBe("function");
  });

  it("loading same instrument twice returns cached instance (no new Sampler)", async () => {
    const first = await cache.loadInstrument("flute");
    const second = await cache.loadInstrument("flute");
    expect(first).toBe(second);
    expect(cache.getLoadedCount()).toBe(1);
  });

  it("loading different instruments creates separate instances", async () => {
    await cache.loadInstrument("flute");
    await cache.loadInstrument("cello");
    await cache.loadInstrument("harp");
    expect(cache.getLoadedCount()).toBe(3);
  });

  it("cache with maxInstruments=3, loading 4th instrument evicts LRU", async () => {
    const first = await cache.loadInstrument("flute");
    await cache.loadInstrument("cello");
    await cache.loadInstrument("harp");
    expect(cache.getLoadedCount()).toBe(3);

    // Loading 4th should evict flute (LRU)
    await cache.loadInstrument("oboe");
    expect(cache.getLoadedCount()).toBe(3);
    expect(cache.isLoaded("flute")).toBe(false);
    expect(cache.isLoaded("oboe")).toBe(true);
  });

  it("evicted instrument has dispose() called", async () => {
    const fluteSampler = await cache.loadInstrument("flute");
    await cache.loadInstrument("cello");
    await cache.loadInstrument("harp");

    // Loading 4th should dispose flute
    await cache.loadInstrument("oboe");
    expect(fluteSampler.dispose).toHaveBeenCalled();
  });

  it("LRU eviction respects access order (recently used survives)", async () => {
    await cache.loadInstrument("flute");
    await cache.loadInstrument("cello");
    await cache.loadInstrument("harp");

    // Re-access flute to make it most recently used
    await cache.loadInstrument("flute");

    // Loading 4th should evict cello (now LRU), not flute
    await cache.loadInstrument("oboe");
    expect(cache.isLoaded("flute")).toBe(true);
    expect(cache.isLoaded("cello")).toBe(false);
    expect(cache.isLoaded("harp")).toBe(true);
    expect(cache.isLoaded("oboe")).toBe(true);
  });

  it("getLoadedCount() returns correct count", async () => {
    expect(cache.getLoadedCount()).toBe(0);
    await cache.loadInstrument("flute");
    expect(cache.getLoadedCount()).toBe(1);
    await cache.loadInstrument("cello");
    expect(cache.getLoadedCount()).toBe(2);
  });

  it("disposeAll() calls dispose on all cached instruments and resets count", async () => {
    const flute = await cache.loadInstrument("flute");
    const cello = await cache.loadInstrument("cello");

    cache.disposeAll();

    expect(flute.dispose).toHaveBeenCalled();
    expect(cello.dispose).toHaveBeenCalled();
    expect(cache.getLoadedCount()).toBe(0);
  });

  it("isLoaded() returns correct state", async () => {
    expect(cache.isLoaded("flute")).toBe(false);
    await cache.loadInstrument("flute");
    expect(cache.isLoaded("flute")).toBe(true);
  });
});
