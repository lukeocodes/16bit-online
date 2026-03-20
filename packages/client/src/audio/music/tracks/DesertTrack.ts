/**
 * Desert exploration track — vast, lonely, ancient.
 * Scale: d_phrygian_dominant (Arabic feel) | BPM: 85
 * Instruments: shanai (duduk/ney approximation) + sitar (sparse plucks)
 * Synth: hand percussion MembraneSynth (darbuka-style)
 * Extra null entries per AUDIO-PLAN ("silence between phrases increases").
 * No proximity stems.
 */
import * as Tone from "tone";
import { BaseTrack } from "../BaseTrack";
import { SampleCache } from "../SampleCache";
import { PhraseEngine } from "../PhraseEngine";

/** D Phrygian dominant phrases with ornamental tones and silence gaps */
const PHRASE_POOL: (string | null)[][] = [
  ["D4", "Eb4", "Gb4", "A4", null, "A4", "G4", "D4"],
  [null, null, "D4", "Eb4", "Gb4", null, "A4", null],
  ["A4", "G4", null, "Eb4", "D4", null, null, "D4"],
  ["Gb4", null, "A4", "G4", null, "Eb4", null, "D4"],
];

export class DesertTrack extends BaseTrack {
  private sampleCache: SampleCache;
  private phraseEngines: PhraseEngine[] = [];

  constructor(ctx: AudioContext, sampleCache: SampleCache) {
    super("desert", ctx);
    this.sampleCache = sampleCache;
  }

  async start(): Promise<void> {
    if (this.isPlaying) return;

    // Load instruments
    const shanai = await this.sampleCache.loadInstrument("shanai");
    const sitar = await this.sampleCache.loadInstrument("sitar");
    this.samplers.push(shanai, sitar);

    // Stem gain nodes
    const shanaiStem = this.ctx.createGain();
    shanaiStem.gain.value = 0.65;
    shanaiStem.connect(this.output);

    const sitarStem = this.ctx.createGain();
    sitarStem.gain.value = 0.45;
    sitarStem.connect(this.output);

    const percStem = this.ctx.createGain();
    percStem.gain.value = 0.35;
    percStem.connect(this.output);

    // Shanai melody
    const shanaiEngine = new PhraseEngine(PHRASE_POOL, "8n");
    this.phraseEngines.push(shanaiEngine);
    const shanaiSeq = shanaiEngine.createSequence(shanai, 0.6);
    Tone.connect(shanai, shanaiStem);
    this.sequences.push(shanaiSeq);

    // Sitar sparse plucks
    const sitarPool: (string | null)[][] = [
      [null, "D3", null, null, "A3", null, null, "D4"],
      ["A3", null, null, "D3", null, null, "Gb3", null],
    ];
    const sitarEngine = new PhraseEngine(sitarPool, "8n");
    this.phraseEngines.push(sitarEngine);
    const sitarSeq = sitarEngine.createSequence(sitar, 0.5);
    Tone.connect(sitar, sitarStem);
    this.sequences.push(sitarSeq);

    // Hand percussion — darbuka-style (higher pitch, shorter decay)
    const darbuka = new Tone.MembraneSynth({
      pitchDecay: 0.02,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
      volume: -10,
    });
    Tone.connect(darbuka, percStem);
    this.synthNodes.push(darbuka);

    const percSeq = new Tone.Sequence(
      (time, step) => {
        if (step === 0 || step === 3 || step === 5 || step === 7) {
          darbuka.triggerAttackRelease("G3", "16n", time);
        }
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
