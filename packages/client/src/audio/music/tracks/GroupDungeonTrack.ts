/**
 * Group Dungeon track — epic tension, coordinated danger.
 * Scale: f_sharp_minor (Aeolian) | BPM: 120 | Instruments: trombone + choir aahs
 * Synths: full percussion (kick, snare, hihat), distorted string texture
 * No proximity stems.
 */
import * as Tone from "tone";
import { BaseTrack } from "../BaseTrack";
import { SampleCache } from "../SampleCache";
import { PhraseEngine } from "../PhraseEngine";

/** F# minor Aeolian phrases with chromatic passing tones */
const PHRASE_POOL: (string | null)[][] = [
  ["Gb3", "A3", "B3", "Db4", "D4", "Db4", "B3", "A3"],
  ["A3", "B3", "Db4", "E4", "Db4", "B3", "A3", "Gb3"],
  ["Db4", "D4", "E4", "Gb4", "E4", "D4", "Db4", "B3"],
  ["E4", "Db4", "B3", "A3", "Gb3", "A3", "B3", "Db4"],
];

export class GroupDungeonTrack extends BaseTrack {
  private sampleCache: SampleCache;
  private phraseEngines: PhraseEngine[] = [];

  constructor(ctx: AudioContext, sampleCache: SampleCache) {
    super("group-dungeon", ctx);
    this.sampleCache = sampleCache;
  }

  async start(): Promise<void> {
    if (this.isPlaying) return;

    // Load instruments
    const trombone = await this.sampleCache.loadInstrument("trombone");
    const choirAahs = await this.sampleCache.loadInstrument("choirAahs");
    this.samplers.push(trombone, choirAahs);

    // Stem gain nodes
    const brassStem = this.ctx.createGain();
    brassStem.gain.value = 0.6;
    brassStem.connect(this.output);

    const choirStem = this.ctx.createGain();
    choirStem.gain.value = 0.45;
    choirStem.connect(this.output);

    const percStem = this.ctx.createGain();
    percStem.gain.value = 0.5;
    percStem.connect(this.output);

    const textureStem = this.ctx.createGain();
    textureStem.gain.value = 0.3;
    textureStem.connect(this.output);

    // Low brass (trombone)
    const tromboneEngine = new PhraseEngine(PHRASE_POOL, "8n");
    this.phraseEngines.push(tromboneEngine);
    const tromboneSeq = tromboneEngine.createSequence(trombone, 0.7);
    Tone.connect(trombone, brassStem);
    this.sequences.push(tromboneSeq);

    // Choir stab accents
    const choirEngine = new PhraseEngine(
      [
        ["Gb3", null, null, "Db4", null, null, "E4", null],
        [null, "A3", null, null, "Db4", null, null, "Gb4"],
      ],
      "8n"
    );
    this.phraseEngines.push(choirEngine);
    const choirSeq = choirEngine.createSequence(choirAahs, 0.55);
    Tone.connect(choirAahs, choirStem);
    this.sequences.push(choirSeq);

    // Full percussion: kick, snare, hihat
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 5,
      envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 },
      volume: -8,
    });
    Tone.connect(kick, percStem);
    this.synthNodes.push(kick);

    const snare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
      volume: -12,
    });
    Tone.connect(snare, percStem);
    this.synthNodes.push(snare);

    const hihat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
      volume: -20,
    });
    Tone.connect(hihat, percStem);
    this.synthNodes.push(hihat);

    const percSeq = new Tone.Sequence(
      (time, step) => {
        if (step === 0 || step === 4) kick.triggerAttackRelease("C1", "8n", time);
        if (step === 2 || step === 6) snare.triggerAttackRelease("16n", time);
        hihat.triggerAttackRelease("32n", time);
      },
      [0, 1, 2, 3, 4, 5, 6, 7],
      "8n"
    );
    percSeq.loop = true;
    this.sequences.push(percSeq);

    // Distorted string texture (FMSynth with high modulation index)
    const texture = new Tone.FMSynth({
      harmonicity: 4,
      modulationIndex: 12,
      envelope: { attack: 0.5, decay: 0.3, sustain: 0.6, release: 1.5 },
      volume: -22,
    });
    Tone.connect(texture, textureStem);
    this.synthNodes.push(texture);

    const textureSeq = new Tone.Sequence(
      (time) => {
        texture.triggerAttackRelease("Gb2", "1m", time, 0.3);
      },
      [0],
      "1m"
    );
    textureSeq.loop = true;
    this.sequences.push(textureSeq);

    // No proximity stems
    // hasProximityStems: false

    // Start all sequences
    for (const seq of this.sequences) {
      seq.start(0);
    }

    this.isPlaying = true;
  }
}
