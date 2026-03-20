/**
 * Dwarf Capital City track — monumental, proud, echoing halls.
 * Scale: D Phrygian dominant | BPM: 90 | Instruments: choir aahs + french horn
 * Synths: war drums (MembraneSynth), deep bass drone
 * Proximity stems: triumphant brass (trumpet + trombone)
 */
import * as Tone from "tone";
import { BaseTrack } from "../BaseTrack";
import { SampleCache } from "../SampleCache";
import { PhraseEngine } from "../PhraseEngine";
import { ProximityMixer } from "../ProximityMixer";

/** Phrases emphasizing minor 2nd and augmented 4th intervals */
const PHRASE_POOL: (string | null)[][] = [
  ["D3", "Eb3", "Gb3", "A3", "D4", "A3", "Gb3", "Eb3"],
  ["A3", "Gb3", "Eb3", "D3", "Eb3", "Gb3", "A3", "D4"],
  ["Eb3", "D3", "Gb3", "A3", "Gb3", "D3", "Eb3", "A3"],
  ["D3", "A3", "Gb3", "Eb3", "D3", "Eb3", "Gb3", "D4"],
];

export class DwarfCapitalTrack extends BaseTrack {
  private sampleCache: SampleCache;
  private phraseEngines: PhraseEngine[] = [];

  constructor(ctx: AudioContext, sampleCache: SampleCache) {
    super("dwarf-capital", ctx);
    this.sampleCache = sampleCache;
  }

  async start(): Promise<void> {
    if (this.isPlaying) return;

    // Load instruments
    const choirAahs = await this.sampleCache.loadInstrument("choirAahs");
    const frenchHorn = await this.sampleCache.loadInstrument("frenchHorn");
    const trumpet = await this.sampleCache.loadInstrument("trumpet");
    const trombone = await this.sampleCache.loadInstrument("trombone");
    this.samplers.push(choirAahs, frenchHorn, trumpet, trombone);

    // Stem gain nodes
    const choirStem = this.ctx.createGain();
    choirStem.gain.value = 0.6;
    choirStem.connect(this.output);

    const hornStem = this.ctx.createGain();
    hornStem.gain.value = 0.55;
    hornStem.connect(this.output);

    const percStem = this.ctx.createGain();
    percStem.gain.value = 0.5;
    percStem.connect(this.output);

    const droneStem = this.ctx.createGain();
    droneStem.gain.value = 0.2;
    droneStem.connect(this.output);

    // Low choir
    const choirEngine = new PhraseEngine(PHRASE_POOL, "8n");
    this.phraseEngines.push(choirEngine);
    const choirSeq = choirEngine.createSequence(choirAahs, 0.6);
    Tone.connect(choirAahs, choirStem);
    this.sequences.push(choirSeq);

    // Deep horns
    const hornEngine = new PhraseEngine(PHRASE_POOL, "8n");
    this.phraseEngines.push(hornEngine);
    const hornSeq = hornEngine.createSequence(frenchHorn, 0.55);
    Tone.connect(frenchHorn, hornStem);
    this.sequences.push(hornSeq);

    // War drums (MembraneSynth)
    const warDrum = new Tone.MembraneSynth({
      pitchDecay: 0.1,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.4 },
      volume: -6,
    });
    Tone.connect(warDrum, percStem);
    this.synthNodes.push(warDrum);

    const drumSeq = new Tone.Sequence(
      (time, step) => {
        if (step === 0 || step === 3 || step === 6) {
          warDrum.triggerAttackRelease("C1", "8n", time);
        }
      },
      [0, 1, 2, 3, 4, 5, 6, 7],
      "8n"
    );
    drumSeq.loop = true;
    this.sequences.push(drumSeq);

    // Deep bass drone
    const drone = new Tone.Synth({
      oscillator: { type: "sawtooth4" },
      envelope: { attack: 3.0, decay: 0, sustain: 1.0, release: 4.0 },
      volume: -24,
    });
    Tone.connect(drone, droneStem);
    this.synthNodes.push(drone);

    const droneSeq = new Tone.Sequence(
      (time) => {
        drone.triggerAttackRelease("D2", "2m", time, 0.25);
      },
      [0],
      "2m"
    );
    droneSeq.loop = true;
    this.sequences.push(droneSeq);

    // Proximity: triumphant brass (trumpet + trombone)
    this.proximityMixer = new ProximityMixer();
    const brassStem = this.ctx.createGain();
    brassStem.connect(this.output);

    const trumpetEngine = new PhraseEngine(
      [["D5", null, "A4", null, "D5", null, "Gb5", null]],
      "8n"
    );
    this.phraseEngines.push(trumpetEngine);
    const trumpetSeq = trumpetEngine.createSequence(trumpet, 0.6);
    Tone.connect(trumpet, brassStem);
    this.sequences.push(trumpetSeq);

    const tromboneEngine = new PhraseEngine(
      [["D3", null, null, "A3", null, null, "D4", null]],
      "8n"
    );
    this.phraseEngines.push(tromboneEngine);
    const tromboneSeq = tromboneEngine.createSequence(trombone, 0.55);
    Tone.connect(trombone, brassStem);
    this.sequences.push(tromboneSeq);

    this.proximityMixer.addStem("triumphant-brass", brassStem, {
      triggerDistance: 20,
      fullDistance: 5,
    });

    // Start all sequences
    for (const seq of this.sequences) {
      seq.start(0);
    }

    this.isPlaying = true;
  }
}
