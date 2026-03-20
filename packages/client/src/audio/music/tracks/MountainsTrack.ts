/**
 * Mountains exploration track — imposing, cold, majestic.
 * Scale: e_minor (Aeolian) | BPM: 70 | Instruments: frenchHorn + cello
 * Synths: low E drone, cold pad texture
 * Wide intervals (5ths, octaves), horn calls with silence.
 * No proximity stems.
 */
import * as Tone from "tone";
import { BaseTrack } from "../BaseTrack";
import { SampleCache } from "../SampleCache";
import { PhraseEngine } from "../PhraseEngine";

/** Wide-interval phrases with silence between horn calls */
const PHRASE_POOL: (string | null)[][] = [
  ["E3", null, null, "B3", null, null, "E4", null],
  [null, null, "E4", "D4", "B3", null, null, "E3"],
  ["B3", null, "E4", null, null, "D4", null, "B3"],
  [null, "E3", null, null, "B3", null, "E4", null],
];

export class MountainsTrack extends BaseTrack {
  private sampleCache: SampleCache;
  private phraseEngines: PhraseEngine[] = [];

  constructor(ctx: AudioContext, sampleCache: SampleCache) {
    super("mountains", ctx);
    this.sampleCache = sampleCache;
  }

  async start(): Promise<void> {
    if (this.isPlaying) return;

    // Load instruments
    const frenchHorn = await this.sampleCache.loadInstrument("frenchHorn");
    const cello = await this.sampleCache.loadInstrument("cello");
    this.samplers.push(frenchHorn, cello);

    // Stem gain nodes
    const hornStem = this.ctx.createGain();
    hornStem.gain.value = 0.6;
    hornStem.connect(this.output);

    const celloStem = this.ctx.createGain();
    celloStem.gain.value = 0.45;
    celloStem.connect(this.output);

    const droneStem = this.ctx.createGain();
    droneStem.gain.value = 0.2;
    droneStem.connect(this.output);

    const padStem = this.ctx.createGain();
    padStem.gain.value = 0.2;
    padStem.connect(this.output);

    // French horn distant horn calls
    const hornEngine = new PhraseEngine(PHRASE_POOL, "8n");
    this.phraseEngines.push(hornEngine);
    const hornSeq = hornEngine.createSequence(frenchHorn, 0.55);
    Tone.connect(frenchHorn, hornStem);
    this.sequences.push(hornSeq);

    // Cello drone bowing
    const celloEngine = new PhraseEngine(
      [["E3", null, null, null, "E3", null, null, null]],
      "8n"
    );
    this.phraseEngines.push(celloEngine);
    const celloSeq = celloEngine.createSequence(cello, 0.5);
    Tone.connect(cello, celloStem);
    this.sequences.push(celloSeq);

    // Low E drone synth (sustained)
    const drone = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 4.0, decay: 0, sustain: 1.0, release: 5.0 },
      volume: -26,
    });
    Tone.connect(drone, droneStem);
    this.synthNodes.push(drone);

    const droneSeq = new Tone.Sequence(
      (time) => {
        drone.triggerAttackRelease("E2", "2m", time, 0.2);
      },
      [0],
      "2m"
    );
    droneSeq.loop = true;
    this.sequences.push(droneSeq);

    // Cold texture pad
    const pad = new Tone.FMSynth({
      harmonicity: 2,
      modulationIndex: 1,
      envelope: { attack: 3.0, decay: 1.0, sustain: 0.5, release: 4.0 },
      volume: -24,
    });
    Tone.connect(pad, padStem);
    this.synthNodes.push(pad);

    const padSeq = new Tone.Sequence(
      (time) => {
        pad.triggerAttackRelease("E3", "1m", time, 0.15);
      },
      [0],
      "2m"
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
