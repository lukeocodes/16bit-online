import * as Tone from "tone";

/**
 * Phrase pool selection and scheduling engine.
 * Selects phrases randomly without immediate repeats and
 * creates Tone.Sequences for playback.
 */
export class PhraseEngine {
  private phrasePool: string[][];
  private subdivision: string;
  private currentPhraseIndex: number;
  private lastPhraseIndex: number;
  private sequence: Tone.Sequence | null = null;

  constructor(phrasePool: string[][], subdivision: string = "8n") {
    this.phrasePool = phrasePool;
    this.subdivision = subdivision;
    this.currentPhraseIndex = Math.floor(Math.random() * phrasePool.length);
    this.lastPhraseIndex = -1;
  }

  /**
   * Select the next phrase from the pool.
   * Re-rolls once if same as last phrase (when pool >= 2).
   * Returns the selected phrase array.
   */
  selectNextPhrase(): string[] {
    if (this.phrasePool.length <= 1) {
      this.currentPhraseIndex = 0;
      return this.phrasePool[0];
    }

    let nextIndex = Math.floor(Math.random() * this.phrasePool.length);

    // Re-roll once if same as last to avoid immediate repeat
    if (nextIndex === this.lastPhraseIndex) {
      nextIndex = Math.floor(Math.random() * this.phrasePool.length);
      // If still same (unlikely with large pools, guaranteed with 2), force different
      if (nextIndex === this.lastPhraseIndex) {
        nextIndex = (nextIndex + 1) % this.phrasePool.length;
      }
    }

    this.lastPhraseIndex = nextIndex;
    this.currentPhraseIndex = nextIndex;
    return this.phrasePool[nextIndex];
  }

  /** Returns the current phrase */
  getCurrentPhrase(): string[] {
    return this.phrasePool[this.currentPhraseIndex];
  }

  /**
   * Creates a Tone.Sequence that plays through the current phrase,
   * selecting a new phrase at the end of each cycle.
   */
  createSequence(
    sampler: Tone.Sampler,
    velocity: number = 0.7
  ): Tone.Sequence {
    // Dispose old sequence if exists
    if (this.sequence) {
      this.sequence.stop();
      this.sequence.dispose();
    }

    const stepCount = this.phrasePool[0].length;
    const steps = Array.from({ length: stepCount }, (_, i) => i);

    const sequence = new Tone.Sequence(
      (time: number, stepIndex: number) => {
        const phrase = this.phrasePool[this.currentPhraseIndex];
        if (stepIndex < phrase.length && phrase[stepIndex] !== null) {
          sampler.triggerAttackRelease(
            phrase[stepIndex],
            this.subdivision,
            time,
            velocity
          );
        }
        // At the last step, select the next phrase
        if (stepIndex === phrase.length - 1) {
          this.selectNextPhrase();
        }
      },
      steps,
      this.subdivision
    );

    sequence.loop = true;
    this.sequence = sequence;
    return sequence;
  }

  /** Stop and dispose the current sequence */
  dispose(): void {
    if (this.sequence) {
      this.sequence.stop();
      this.sequence.dispose();
      this.sequence = null;
    }
  }
}
