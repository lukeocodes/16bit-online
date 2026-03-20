/**
 * Solo Dungeon track — tense, lonely, creeping dread.
 * Scale: B diminished | BPM: 60 | Instruments: cello (solo melody)
 * Synths: low drone, sparse piano-like stabs (FMSynth)
 * No proximity stems.
 */
import * as Tone from "tone";
import { BaseTrack } from "../BaseTrack";
import { SampleCache } from "../SampleCache";
import { PhraseEngine } from "../PhraseEngine";

/** Random-walk-style phrases over diminished scale with silence gaps */
const PHRASE_POOL: (string | null)[][] = [
  ["B3", null, "Db4", "D4", null, "F4", null, "Gb4"],
  [null, "Ab4", null, "A4", "B4", null, "Db5", null],
  ["Gb4", "F4", null, null, "D4", "Db4", null, "B3"],
  [null, "B3", "D4", null, "F4", "Ab4", null, null],
];

export class SoloDungeonTrack extends BaseTrack {
  private sampleCache: SampleCache;
  private phraseEngines: PhraseEngine[] = [];

  constructor(ctx: AudioContext, sampleCache: SampleCache) {
    super("solo-dungeon", ctx);
    this.sampleCache = sampleCache;
  }

  async start(): Promise<void> {
    if (this.isPlaying) return;

    // Load instruments
    const cello = await this.sampleCache.loadInstrument("cello");
    this.samplers.push(cello);

    // Stem gain nodes
    const melodyStem = this.ctx.createGain();
    melodyStem.gain.value = 0.6;
    melodyStem.connect(this.output);

    const droneStem = this.ctx.createGain();
    droneStem.gain.value = 0.2;
    droneStem.connect(this.output);

    const stabStem = this.ctx.createGain();
    stabStem.gain.value = 0.35;
    stabStem.connect(this.output);

    // Cello solo melody (sparse)
    const celloEngine = new PhraseEngine(PHRASE_POOL, "8n");
    this.phraseEngines.push(celloEngine);
    const celloSeq = celloEngine.createSequence(cello, 0.55);
    Tone.connect(cello, melodyStem);
    this.sequences.push(celloSeq);

    // Low drone synth (sustained note)
    const drone = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 3.0, decay: 0, sustain: 1.0, release: 4.0 },
      volume: -26,
    });
    Tone.connect(drone, droneStem);
    this.synthNodes.push(drone);

    const droneSeq = new Tone.Sequence(
      (time) => {
        drone.triggerAttackRelease("B1", "2m", time, 0.2);
      },
      [0],
      "2m"
    );
    droneSeq.loop = true;
    this.sequences.push(droneSeq);

    // Sparse piano-like stabs (FMSynth with short decay)
    const stab = new Tone.FMSynth({
      harmonicity: 3,
      modulationIndex: 2,
      envelope: { attack: 0.005, decay: 0.3, sustain: 0, release: 0.2 },
      volume: -18,
    });
    Tone.connect(stab, stabStem);
    this.synthNodes.push(stab);

    const stabPool: (string | null)[] = [null, "Db4", null, null, "F4", null, null, "Ab4"];
    const stabSeq = new Tone.Sequence(
      (time, step) => {
        const note = stabPool[step];
        if (note) stab.triggerAttackRelease(note, "16n", time, 0.4);
      },
      [0, 1, 2, 3, 4, 5, 6, 7],
      "8n"
    );
    stabSeq.loop = true;
    this.sequences.push(stabSeq);

    // No proximity stems
    // hasProximityStems: false

    // Start all sequences
    for (const seq of this.sequences) {
      seq.start(0);
    }

    this.isPlaying = true;
  }
}
