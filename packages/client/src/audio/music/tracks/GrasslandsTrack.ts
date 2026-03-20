/**
 * Grasslands exploration track — open, free, peaceful adventure.
 * Scale: g_mixolydian | BPM: 90 | Instruments: acoustic guitar + pennywhistle
 * Synths: light kick + hihat pattern
 * No proximity stems.
 */
import * as Tone from "tone";
import { BaseTrack } from "../BaseTrack";
import { SampleCache } from "../SampleCache";
import { PhraseEngine } from "../PhraseEngine";

/** Folk-style pentatonic phrases from G Mixolydian */
const PHRASE_POOL: (string | null)[][] = [
  ["G4", "A4", "B4", "D5", "B4", "A4", "G4", "F4"],
  ["D4", "G4", "A4", "B4", "D5", "B4", "A4", "G4"],
  ["B4", "D5", "F5", "D5", "B4", "A4", "G4", "A4"],
  ["A4", "B4", "D5", "F5", "D5", "B4", "A4", "G4"],
  ["G4", "B4", "D5", "G5", "D5", "B4", "G4", "F4"],
];

export class GrasslandsTrack extends BaseTrack {
  private sampleCache: SampleCache;
  private phraseEngines: PhraseEngine[] = [];

  constructor(ctx: AudioContext, sampleCache: SampleCache) {
    super("grasslands", ctx);
    this.sampleCache = sampleCache;
  }

  async start(): Promise<void> {
    if (this.isPlaying) return;

    // Load instruments
    const guitar = await this.sampleCache.loadInstrument("acousticGuitar");
    const pennywhistle = await this.sampleCache.loadInstrument("pennywhistle");
    this.samplers.push(guitar, pennywhistle);

    // Stem gain nodes
    const melodyStem = this.ctx.createGain();
    melodyStem.gain.value = 0.7;
    melodyStem.connect(this.output);

    const whistleStem = this.ctx.createGain();
    whistleStem.gain.value = 0.5;
    whistleStem.connect(this.output);

    const percStem = this.ctx.createGain();
    percStem.gain.value = 0.25;
    percStem.connect(this.output);

    // Guitar folk picking
    const guitarEngine = new PhraseEngine(PHRASE_POOL, "8n");
    this.phraseEngines.push(guitarEngine);
    const guitarSeq = guitarEngine.createSequence(guitar, 0.65);
    Tone.connect(guitar, melodyStem);
    this.sequences.push(guitarSeq);

    // Penny whistle melody
    const whistleEngine = new PhraseEngine(PHRASE_POOL, "8n");
    this.phraseEngines.push(whistleEngine);
    const whistleSeq = whistleEngine.createSequence(pennywhistle, 0.5);
    Tone.connect(pennywhistle, whistleStem);
    this.sequences.push(whistleSeq);

    // Light percussion: kick + hihat
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 4,
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.15 },
      volume: -14,
    });
    Tone.connect(kick, percStem);
    this.synthNodes.push(kick);

    const hihat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
      volume: -22,
    });
    Tone.connect(hihat, percStem);
    this.synthNodes.push(hihat);

    const percSeq = new Tone.Sequence(
      (time, step) => {
        if (step === 0 || step === 4) kick.triggerAttackRelease("C1", "8n", time);
        if (step % 2 === 0) hihat.triggerAttackRelease("16n", time);
      },
      [0, 1, 2, 3, 4, 5, 6, 7],
      "8n"
    );
    percSeq.loop = true;
    this.sequences.push(percSeq);

    // No proximity stems
    // hasProximityStems: false

    // Start all sequences
    for (const seq of this.sequences) {
      seq.start(0);
    }

    this.isPlaying = true;
  }
}
