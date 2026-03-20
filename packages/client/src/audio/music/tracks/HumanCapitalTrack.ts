/**
 * Human Capital City track — grand, regal, cosmopolitan.
 * Scale: G Ionian (G Major) | BPM: 100 | Instruments: violin + oboe + trumpet
 * Synths: snare march pattern
 * Proximity stems: orchestral swell (choir + french horn)
 */
import * as Tone from "tone";
import { BaseTrack } from "../BaseTrack";
import { SampleCache } from "../SampleCache";
import { PhraseEngine } from "../PhraseEngine";
import { ProximityMixer } from "../ProximityMixer";

const PHRASE_POOL: (string | null)[][] = [
  ["G4", "B4", "D5", "G5", "D5", "B4", "A4", "G4"],
  ["D5", "E5", "G5", "A5", "G5", "E5", "D5", "B4"],
  ["B4", "D5", "E5", "G5", "A5", "G5", "E5", "D5"],
  ["G4", "A4", "B4", "D5", "E5", "D5", "B4", "A4"],
  ["E5", "D5", "B4", "G4", "A4", "B4", "D5", "G5"],
];

export class HumanCapitalTrack extends BaseTrack {
  private sampleCache: SampleCache;
  private phraseEngines: PhraseEngine[] = [];

  constructor(ctx: AudioContext, sampleCache: SampleCache) {
    super("human-capital", ctx);
    this.sampleCache = sampleCache;
  }

  async start(): Promise<void> {
    if (this.isPlaying) return;

    // Load instruments
    const violin = await this.sampleCache.loadInstrument("violin");
    const oboe = await this.sampleCache.loadInstrument("oboe");
    const trumpet = await this.sampleCache.loadInstrument("trumpet");
    const choirAahs = await this.sampleCache.loadInstrument("choirAahs");
    const frenchHorn = await this.sampleCache.loadInstrument("frenchHorn");
    this.samplers.push(violin, oboe, trumpet, choirAahs, frenchHorn);

    // Stem gain nodes
    const melodyStem = this.ctx.createGain();
    melodyStem.gain.value = 0.7;
    melodyStem.connect(this.output);

    const counterStem = this.ctx.createGain();
    counterStem.gain.value = 0.5;
    counterStem.connect(this.output);

    const fanfareStem = this.ctx.createGain();
    fanfareStem.gain.value = 0.4;
    fanfareStem.connect(this.output);

    const percStem = this.ctx.createGain();
    percStem.gain.value = 0.3;
    percStem.connect(this.output);

    // Violin melody
    const violinEngine = new PhraseEngine(PHRASE_POOL, "8n");
    this.phraseEngines.push(violinEngine);
    const violinSeq = violinEngine.createSequence(violin, 0.7);
    Tone.connect(violin, melodyStem);
    this.sequences.push(violinSeq);

    // Oboe counter-melody
    const oboeEngine = new PhraseEngine(PHRASE_POOL, "8n");
    this.phraseEngines.push(oboeEngine);
    const oboeSeq = oboeEngine.createSequence(oboe, 0.5);
    Tone.connect(oboe, counterStem);
    this.sequences.push(oboeSeq);

    // Trumpet fanfare accents (sparse)
    const fanfarePool: (string | null)[][] = [
      ["G5", null, null, "D5", null, null, "G5", null],
      [null, null, "B4", null, "D5", null, null, "G5"],
    ];
    const trumpetEngine = new PhraseEngine(fanfarePool, "8n");
    this.phraseEngines.push(trumpetEngine);
    const trumpetSeq = trumpetEngine.createSequence(trumpet, 0.6);
    Tone.connect(trumpet, fanfareStem);
    this.sequences.push(trumpetSeq);

    // Snare march pattern (NoiseSynth)
    const snare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
      volume: -16,
    });
    Tone.connect(snare, percStem);
    this.synthNodes.push(snare);

    const snareSeq = new Tone.Sequence(
      (time, step) => {
        if (step === 2 || step === 6) snare.triggerAttackRelease("16n", time);
      },
      [0, 1, 2, 3, 4, 5, 6, 7],
      "8n"
    );
    snareSeq.loop = true;
    this.sequences.push(snareSeq);

    // Proximity: orchestral swell (choir + french horn)
    this.proximityMixer = new ProximityMixer();
    const orchestralStem = this.ctx.createGain();
    orchestralStem.connect(this.output);

    const choirEngine = new PhraseEngine(
      [["G4", "B4", "D5", "G5", "D5", "B4", "G4", "B4"]],
      "8n"
    );
    this.phraseEngines.push(choirEngine);
    const choirSeq = choirEngine.createSequence(choirAahs, 0.4);
    Tone.connect(choirAahs, orchestralStem);
    this.sequences.push(choirSeq);

    const hornEngine = new PhraseEngine(
      [["G3", null, "D4", null, "G3", null, "B3", null]],
      "8n"
    );
    this.phraseEngines.push(hornEngine);
    const hornSeq = hornEngine.createSequence(frenchHorn, 0.5);
    Tone.connect(frenchHorn, orchestralStem);
    this.sequences.push(hornSeq);

    this.proximityMixer.addStem("orchestral-swell", orchestralStem, {
      triggerDistance: 30,
      fullDistance: 10,
    });

    // Start all sequences
    for (const seq of this.sequences) {
      seq.start(0);
    }

    this.isPlaying = true;
  }
}
