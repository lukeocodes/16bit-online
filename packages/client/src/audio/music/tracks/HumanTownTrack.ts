/**
 * Human Town track — warm, busy, grounded folk music.
 * Scale: C Mixolydian | BPM: 95 | Instruments: acoustic guitar + flute
 * Proximity stems: tavern fiddle + market bustle
 */
import * as Tone from "tone";
import { BaseTrack } from "../BaseTrack";
import { SampleCache } from "../SampleCache";
import { PhraseEngine } from "../PhraseEngine";
import { ProximityMixer } from "../ProximityMixer";

const PHRASE_POOL: (string | null)[][] = [
  // Phrase 1: Warm ascending melody with gentle descent
  ["C4", "D4", "E4", "G4", null, "A4", "G4", "E4", "F4", "E4", "D4", "C4", null, "D4", "E4", "D4"],
  // Phrase 2: Flowing folk melody, stepwise with leaps
  ["G4", "A4", "Bb4", "A4", "G4", null, "E4", "F4", "G4", "A4", "G4", "F4", "E4", "D4", null, "C4"],
  // Phrase 3: Rising arc to high point then cascading down
  ["E4", "G4", "A4", "Bb4", "C5", null, "Bb4", "A4", "G4", null, "F4", "E4", "D4", "E4", "F4", "E4"],
  // Phrase 4: Playful rhythm with rests, dance-like
  ["C4", null, "E4", "G4", "A4", null, "G4", "E4", "D4", null, "F4", "E4", "D4", "C4", null, null],
  // Phrase 5: Gentle swaying motion, thirds
  ["E4", "G4", "F4", "A4", "G4", "Bb4", "A4", "G4", null, "F4", "E4", "D4", "E4", "F4", "G4", null],
  // Phrase 6: Descending lullaby with pickup
  ["A4", null, "G4", "F4", "E4", "D4", null, "E4", "F4", "G4", null, "E4", "D4", "C4", "D4", "C4"],
];

export class HumanTownTrack extends BaseTrack {
  private sampleCache: SampleCache;
  private phraseEngines: PhraseEngine[] = [];

  constructor(ctx: AudioContext, sampleCache: SampleCache) {
    super("human-town", ctx);
    this.sampleCache = sampleCache;
  }

  async start(): Promise<void> {
    if (this.isPlaying) return;

    // Load instruments — one melodic (string), one pad (synth), one percussion
    const guitar = await this.sampleCache.loadInstrument("acousticGuitar");
    this.samplers.push(guitar);

    // Stem gain nodes
    const melodyStem = this.ctx.createGain();
    melodyStem.gain.value = 0.7;
    melodyStem.connect(this.output);

    const padStem = this.ctx.createGain();
    padStem.gain.value = 0.25;
    padStem.connect(this.output);

    const percStem = this.ctx.createGain();
    percStem.gain.value = 0.3;
    percStem.connect(this.output);

    // Guitar melody via PhraseEngine (sole melodic voice)
    const guitarEngine = new PhraseEngine(PHRASE_POOL, "8n");
    this.phraseEngines.push(guitarEngine);
    const guitarSeq = guitarEngine.createSequence(guitar, 0.7);
    Tone.connect(guitar, melodyStem);
    this.sequences.push(guitarSeq);

    // Warm pad synth
    const pad = new Tone.FMSynth({
      harmonicity: 2,
      modulationIndex: 1.5,
      envelope: { attack: 1.0, decay: 0.5, sustain: 0.8, release: 2.0 },
      volume: -18,
    });
    Tone.connect(pad, padStem);
    this.synthNodes.push(pad);

    const padSeq = new Tone.Sequence(
      (time) => {
        pad.triggerAttackRelease("C3", "2n", time, 0.3);
      },
      [0],
      "1m"
    );
    padSeq.loop = true;
    this.sequences.push(padSeq);

    // Light percussion: kick + hihat
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 4,
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.2 },
      volume: -12,
    });
    Tone.connect(kick, percStem);
    this.synthNodes.push(kick);

    const hihat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
      volume: -20,
    });
    Tone.connect(hihat, percStem);
    this.synthNodes.push(hihat);

    const percSeq = new Tone.Sequence(
      (time, step) => {
        if (step === 0 || step === 4) kick.triggerAttackRelease("C1", "8n", time);
        if (step % 2 === 0) hihat.triggerAttackRelease("8n", time);
      },
      [0, 1, 2, 3, 4, 5, 6, 7],
      "8n"
    );
    percSeq.loop = true;
    this.sequences.push(percSeq);

    // Proximity stems — ambient layers that fade in near POIs
    this.proximityMixer = new ProximityMixer();

    // Market bustle stem (filtered noise — ambient, not melodic)
    const bustleStem = this.ctx.createGain();
    bustleStem.connect(this.output);
    const bustle = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.5, decay: 0, sustain: 1, release: 0.5 },
      volume: -24,
    });
    Tone.connect(bustle, bustleStem);
    this.synthNodes.push(bustle);
    const bustleSeq = new Tone.Sequence(
      (time) => {
        bustle.triggerAttackRelease("2m", time);
      },
      [0],
      "2m"
    );
    bustleSeq.loop = true;
    this.sequences.push(bustleSeq);
    this.proximityMixer.addStem("market-bustle", bustleStem, {
      triggerDistance: 15,
      fullDistance: 3,
    });

    // Start all sequences
    for (const seq of this.sequences) {
      seq.start(0);
    }

    this.isPlaying = true;
  }
}
