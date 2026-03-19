import { describe, it, expect, beforeEach, vi } from "vitest";
import { Loop } from "./Loop";

// Mock requestAnimationFrame and performance.now
let rafCallbacks: Array<(time: number) => void> = [];
let currentTime = 0;

vi.stubGlobal("performance", { now: () => currentTime });
vi.stubGlobal("requestAnimationFrame", (cb: (time: number) => void) => {
  rafCallbacks.push(cb);
  return rafCallbacks.length;
});

function advanceFrame(ms: number) {
  currentTime += ms;
  const cbs = rafCallbacks;
  rafCallbacks = [];
  for (const cb of cbs) cb(currentTime);
}

describe("Loop", () => {
  let loop: Loop;

  beforeEach(() => {
    rafCallbacks = [];
    currentTime = 0;
    loop = new Loop();
  });

  describe("start / stop", () => {
    it("starts the loop", () => {
      loop.start();
      expect(rafCallbacks.length).toBe(1); // Queued first frame
    });

    it("stop prevents further frames", () => {
      const ticks: number[] = [];
      loop.onTick((dt) => ticks.push(dt));
      loop.start();
      loop.stop();

      advanceFrame(100);
      expect(ticks.length).toBe(0); // No ticks after stop
    });

    it("double start does not queue extra frames", () => {
      loop.start();
      loop.start();
      expect(rafCallbacks.length).toBe(1);
    });
  });

  describe("fixed timestep ticks", () => {
    it("fires tick callback at 20Hz (50ms intervals)", () => {
      const ticks: number[] = [];
      loop.onTick((dt) => ticks.push(dt));
      loop.start();

      // Advance 100ms = 2 ticks
      advanceFrame(100);
      expect(ticks.length).toBe(2);
      expect(ticks[0]).toBeCloseTo(0.05); // 50ms in seconds
    });

    it("accumulates partial frames", () => {
      const ticks: number[] = [];
      loop.onTick((dt) => ticks.push(dt));
      loop.start();

      // Advance 30ms — not enough for a tick
      advanceFrame(30);
      expect(ticks.length).toBe(0);

      // Advance 30ms more — total 60ms, one tick fires (50ms threshold)
      advanceFrame(30);
      expect(ticks.length).toBe(1);
    });

    it("handles large frame gaps with multiple ticks", () => {
      const ticks: number[] = [];
      loop.onTick((dt) => ticks.push(dt));
      loop.start();

      // 200ms = 4 ticks (capped at 200ms to prevent spiral)
      advanceFrame(200);
      expect(ticks.length).toBe(4);
    });

    it("caps accumulator at 200ms to prevent spiral of death", () => {
      const ticks: number[] = [];
      loop.onTick((dt) => ticks.push(dt));
      loop.start();

      // 500ms elapsed but should cap at 200ms = 4 ticks
      advanceFrame(500);
      expect(ticks.length).toBe(4);
    });
  });

  describe("render callbacks", () => {
    it("fires render callback every frame with frame delta", () => {
      const renders: number[] = [];
      loop.onRender((dt) => renders.push(dt));
      loop.start();

      advanceFrame(16); // ~60fps
      expect(renders.length).toBe(1);
      expect(renders[0]).toBeCloseTo(0.016);
    });

    it("render fires even when no tick occurs", () => {
      const ticks: number[] = [];
      const renders: number[] = [];
      loop.onTick((dt) => ticks.push(dt));
      loop.onRender((dt) => renders.push(dt));
      loop.start();

      advanceFrame(20); // Less than 50ms tick threshold
      expect(ticks.length).toBe(0);
      expect(renders.length).toBe(1);
    });
  });

  describe("multiple callbacks", () => {
    it("calls all registered tick callbacks", () => {
      let a = 0, b = 0;
      loop.onTick(() => a++);
      loop.onTick(() => b++);
      loop.start();

      advanceFrame(50);
      expect(a).toBe(1);
      expect(b).toBe(1);
    });

    it("calls all registered render callbacks", () => {
      let a = 0, b = 0;
      loop.onRender(() => a++);
      loop.onRender(() => b++);
      loop.start();

      advanceFrame(16);
      expect(a).toBe(1);
      expect(b).toBe(1);
    });
  });
});
