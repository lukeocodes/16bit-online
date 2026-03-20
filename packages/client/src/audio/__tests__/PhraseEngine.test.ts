// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock tone module
vi.mock("tone", () => {
  class MockSequence {
    callback: (time: number, stepIndex: number) => void;
    events: number[];
    subdivision: string;
    loop = false;
    start = vi.fn(() => this);
    stop = vi.fn(() => this);
    dispose = vi.fn();

    constructor(
      callback: (time: number, stepIndex: number) => void,
      events: number[],
      subdivision: string
    ) {
      this.callback = callback;
      this.events = events;
      this.subdivision = subdivision;
    }
  }

  return {
    Sequence: MockSequence,
  };
});

// Import after mocks
import { PhraseEngine } from "../music/PhraseEngine";

describe("PhraseEngine", () => {
  const phrasePool = [
    ["C4", "D4", "E4", "F4"],
    ["G4", "A4", "B4", "C5"],
    ["E4", "F4", "G4", "A4"],
    ["D4", "E4", "F4", "G4"],
  ];

  let engine: PhraseEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new PhraseEngine(phrasePool);
  });

  it("selectNextPhrase() returns a phrase from the provided pool", () => {
    const phrase = engine.selectNextPhrase();
    expect(phrasePool).toContainEqual(phrase);
  });

  it("selectNextPhrase() does not return the same phrase twice consecutively", () => {
    // Run many iterations to check no immediate repeat
    let lastPhrase = engine.selectNextPhrase();
    let noRepeatViolation = true;
    for (let i = 0; i < 50; i++) {
      const nextPhrase = engine.selectNextPhrase();
      if (nextPhrase === lastPhrase) {
        noRepeatViolation = false;
        break;
      }
      lastPhrase = nextPhrase;
    }
    expect(noRepeatViolation).toBe(true);
  });

  it("creating a PhraseEngine stores all phrases", () => {
    const currentPhrase = engine.getCurrentPhrase();
    expect(phrasePool).toContainEqual(currentPhrase);
  });

  it("createSequence() returns a Tone.Sequence instance", () => {
    const mockSampler = {
      triggerAttackRelease: vi.fn(),
    } as any;

    const sequence = engine.createSequence(mockSampler);
    expect(sequence).toBeDefined();
    expect(sequence.loop).toBe(true);
    expect(typeof sequence.start).toBe("function");
    expect(typeof sequence.stop).toBe("function");
    expect(typeof sequence.dispose).toBe("function");
  });

  it("dispose() cleans up the sequence", () => {
    const mockSampler = {
      triggerAttackRelease: vi.fn(),
    } as any;

    engine.createSequence(mockSampler);
    engine.dispose();

    // After dispose, creating a new sequence should work (old one cleaned up)
    const newSequence = engine.createSequence(mockSampler);
    expect(newSequence).toBeDefined();
  });

  it("works with single-phrase pool", () => {
    const singlePool = [["C4", "D4", "E4"]];
    const singleEngine = new PhraseEngine(singlePool);

    // With a single phrase, it should always return that phrase
    const phrase = singleEngine.selectNextPhrase();
    expect(phrase).toEqual(["C4", "D4", "E4"]);
  });

  it("works with two-phrase pool and still avoids repeats", () => {
    const twoPool = [
      ["C4", "D4"],
      ["E4", "F4"],
    ];
    const twoEngine = new PhraseEngine(twoPool);

    // With two phrases, consecutive calls should always alternate
    const first = twoEngine.selectNextPhrase();
    const second = twoEngine.selectNextPhrase();
    expect(first).not.toBe(second);
  });
});
