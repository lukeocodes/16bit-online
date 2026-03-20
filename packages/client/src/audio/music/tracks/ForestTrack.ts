/**
 * Forest exploration track — mysterious, alive, slightly magical.
 * Scale: a_dorian (minor pentatonic subset) | BPM: 75
 * Instruments: marimba + flute
 * Synth: soft pad (FMSynth)
 * Stochastic triggering with null entries for silence gaps.
 * No proximity stems.
 */
import * as Tone from "tone";
import { BaseTrack } from "../BaseTrack";
import { SampleCache } from "../SampleCache";
import { PhraseEngine } from "../PhraseEngine";

/** Phrases with intentional null entries for silence gaps (per AUDIO-PLAN) */
const PHRASE_POOL: (string | null)[][] = [
  ["A4", null, "C5", "D5", null, null, "E5", "C5"],
  [null, "A4", "G4", null, "E4", "D4", null, "A3"],
  ["C5", null, null, "A4", null, "G4", "E4", null],
  [null, "D5", "C5", null, null, "A4", null, "G4"],
  ["E4", null, "G4", "A4", null, null, "C5", null],
];

export class ForestTrack extends BaseTrack {
  private sampleCache: SampleCache;
  private phraseEngines: PhraseEngine[] = [];

  constructor(ctx: AudioContext, sampleCache: SampleCache) {
    super("forest", ctx);
    this.sampleCache = sampleCache;
  }

  async start(): Promise<void> {
    if (this.isPlaying) return;

    // Load instruments
    const marimba = await this.sampleCache.loadInstrument("marimba");
    const flute = await this.sampleCache.loadInstrument("flute");
    this.samplers.push(marimba, flute);

    // Stem gain nodes
    const marimbaStem = this.ctx.createGain();
    marimbaStem.gain.value = 0.6;
    marimbaStem.connect(this.output);

    const fluteStem = this.ctx.createGain();
    fluteStem.gain.value = 0.45;
    fluteStem.connect(this.output);

    const padStem = this.ctx.createGain();
    padStem.gain.value = 0.25;
    padStem.connect(this.output);

    // Marimba sparkling fragments (null entries create silence gaps)
    const marimbaEngine = new PhraseEngine(PHRASE_POOL, "8n");
    this.phraseEngines.push(marimbaEngine);
    const marimbaSeq = marimbaEngine.createSequence(marimba, 0.55);
    Tone.connect(marimba, marimbaStem);
    this.sequences.push(marimbaSeq);

    // Flute soft melody (same pool with different velocity)
    const fluteEngine = new PhraseEngine(PHRASE_POOL, "8n");
    this.phraseEngines.push(fluteEngine);
    const fluteSeq = fluteEngine.createSequence(flute, 0.35);
    Tone.connect(flute, fluteStem);
    this.sequences.push(fluteSeq);

    // Soft pad (FMSynth, long attack/release)
    const pad = new Tone.FMSynth({
      harmonicity: 1.5,
      modulationIndex: 0.5,
      envelope: { attack: 2.0, decay: 1.0, sustain: 0.6, release: 3.0 },
      volume: -22,
    });
    Tone.connect(pad, padStem);
    this.synthNodes.push(pad);

    const padSeq = new Tone.Sequence(
      (time) => {
        pad.triggerAttackRelease("A3", "2n", time, 0.25);
      },
      [0],
      "1m"
    );
    padSeq.loop = true;
    this.sequences.push(padSeq);

    // No proximity stems
    // hasProximityStems: false

    // Start all sequences
    for (const seq of this.sequences) {
      seq.start(0);
    }

    this.isPlaying = true;
  }
}
