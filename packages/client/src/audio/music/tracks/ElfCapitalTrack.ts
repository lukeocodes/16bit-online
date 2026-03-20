/**
 * Elf Capital City track — ancient, celestial, vast.
 * Scale: E Lydian | BPM: 72 | Instruments: harp + choir aahs
 * Variable phrase length: 9 bars (19 eighth-notes for floating feel)
 * Proximity stems: full choir (higher velocity)
 */
import * as Tone from "tone";
import { BaseTrack } from "../BaseTrack";
import { SampleCache } from "../SampleCache";
import { PhraseEngine } from "../PhraseEngine";
import { ProximityMixer } from "../ProximityMixer";

/** 9-bar phrases: 19 eighth-notes from E Lydian */
const PHRASE_POOL: (string | null)[][] = [
  ["E4", "Gb4", "Ab4", "B4", "Db5", "E5", "Db5", "B4", "Ab4", "Gb4", "E4", "B4", "Db5", "E5", "Db5", "B4", "Ab4", "Gb4", "E4"],
  ["B4", "Db5", "E5", "Gb5", "E5", "Db5", "B4", "Ab4", "E4", "Gb4", "Ab4", "B4", "Db5", "E5", "Db5", "B4", "Ab4", "E4", "Gb4"],
  ["Gb4", "Ab4", "B4", "E5", "Db5", "B4", "Ab4", "Gb4", "E4", "B4", "Ab4", "Gb4", "E4", "Gb4", "Ab4", "B4", "Db5", "E5", "B4"],
  ["E5", "Db5", "B4", "Ab4", "Gb4", "E4", "Gb4", "Ab4", "B4", "Db5", "E5", "Gb5", "E5", "Db5", "B4", "Ab4", "Gb4", "E4", "B4"],
];

export class ElfCapitalTrack extends BaseTrack {
  private sampleCache: SampleCache;
  private phraseEngines: PhraseEngine[] = [];

  constructor(ctx: AudioContext, sampleCache: SampleCache) {
    super("elf-capital", ctx);
    this.sampleCache = sampleCache;
  }

  async start(): Promise<void> {
    if (this.isPlaying) return;

    // Load instruments
    const harp = await this.sampleCache.loadInstrument("harp");
    const choirAahs = await this.sampleCache.loadInstrument("choirAahs");
    this.samplers.push(harp, choirAahs);

    // Stem gain nodes
    const melodyStem = this.ctx.createGain();
    melodyStem.gain.value = 0.7;
    melodyStem.connect(this.output);

    const choirStem = this.ctx.createGain();
    choirStem.gain.value = 0.45;
    choirStem.connect(this.output);

    const padStem = this.ctx.createGain();
    padStem.gain.value = 0.25;
    padStem.connect(this.output);

    // Harp main melody / arpeggios (19-note phrases for 9-bar length)
    const harpEngine = new PhraseEngine(PHRASE_POOL, "8n");
    this.phraseEngines.push(harpEngine);
    const harpSeq = harpEngine.createSequence(harp, 0.65);
    Tone.connect(harp, melodyStem);
    this.sequences.push(harpSeq);

    // Choir wordless soprano line
    const choirEngine = new PhraseEngine(PHRASE_POOL, "8n");
    this.phraseEngines.push(choirEngine);
    const choirSeq = choirEngine.createSequence(choirAahs, 0.35);
    Tone.connect(choirAahs, choirStem);
    this.sequences.push(choirSeq);

    // Whole-tone cluster shimmer pad (PolySynth)
    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 2.0, decay: 1.0, sustain: 0.6, release: 3.0 },
      volume: -24,
    });
    Tone.connect(pad, padStem);
    this.synthNodes.push(pad);

    const padSeq = new Tone.Sequence(
      (time) => {
        pad.triggerAttackRelease(["E3", "Gb3", "Ab3", "B3"], "2n", time, 0.2);
      },
      [0],
      "1m"
    );
    padSeq.loop = true;
    this.sequences.push(padSeq);

    // Proximity: full choir at higher velocity
    this.proximityMixer = new ProximityMixer();
    const fullChoirStem = this.ctx.createGain();
    fullChoirStem.connect(this.output);

    // Re-use choirAahs sampler with separate sequence at higher velocity
    const fullChoirEngine = new PhraseEngine(PHRASE_POOL, "8n");
    this.phraseEngines.push(fullChoirEngine);
    const fullChoirSeq = fullChoirEngine.createSequence(choirAahs, 0.7);
    this.sequences.push(fullChoirSeq);
    Tone.connect(choirAahs, fullChoirStem);

    this.proximityMixer.addStem("full-choir", fullChoirStem, {
      triggerDistance: 25,
      fullDistance: 8,
    });

    // Start all sequences
    for (const seq of this.sequences) {
      seq.start(0);
    }

    this.isPlaying = true;
  }
}
