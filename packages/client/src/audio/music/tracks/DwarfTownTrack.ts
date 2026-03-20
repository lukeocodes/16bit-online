/**
 * Dwarf Town track — sturdy, rhythmic, underground warmth.
 * Scale: A Dorian | BPM: 110 | Instruments: tuba + trombone
 * Synths: deep drums, anvil hits, bagpipe-style drone
 * Proximity stems: anvil/industrial (MetalSynth)
 */
import * as Tone from "tone";
import { BaseTrack } from "../BaseTrack";
import { SampleCache } from "../SampleCache";
import { PhraseEngine } from "../PhraseEngine";
import { ProximityMixer } from "../ProximityMixer";

const PHRASE_POOL: (string | null)[][] = [
  ["A3", "E4", "A3", "E4", "G4", "A4", "G4", "E4"],
  ["E4", "A3", "G4", "E4", "A3", "E4", "G4", "A4"],
  ["A4", "G4", "E4", "A3", "E4", "G4", "A4", "E4"],
  ["G4", "A4", "E4", "A3", "G4", "E4", "A3", "E4"],
  ["A3", "G4", "E4", "G4", "A4", "G4", "E4", "A3"],
];

export class DwarfTownTrack extends BaseTrack {
  private sampleCache: SampleCache;
  private phraseEngines: PhraseEngine[] = [];

  constructor(ctx: AudioContext, sampleCache: SampleCache) {
    super("dwarf-town", ctx);
    this.sampleCache = sampleCache;
  }

  async start(): Promise<void> {
    if (this.isPlaying) return;

    // Load instruments
    const tuba = await this.sampleCache.loadInstrument("tuba");
    const trombone = await this.sampleCache.loadInstrument("trombone");
    this.samplers.push(tuba, trombone);

    // Stem gain nodes
    const bassStem = this.ctx.createGain();
    bassStem.gain.value = 0.7;
    bassStem.connect(this.output);

    const melodyStem = this.ctx.createGain();
    melodyStem.gain.value = 0.6;
    melodyStem.connect(this.output);

    const percStem = this.ctx.createGain();
    percStem.gain.value = 0.5;
    percStem.connect(this.output);

    const droneStem = this.ctx.createGain();
    droneStem.gain.value = 0.2;
    droneStem.connect(this.output);

    // Tuba bass stabs
    const tubaEngine = new PhraseEngine(PHRASE_POOL, "8n");
    this.phraseEngines.push(tubaEngine);
    const tubaSeq = tubaEngine.createSequence(tuba, 0.7);
    Tone.connect(tuba, bassStem);
    this.sequences.push(tubaSeq);

    // Trombone melody accents
    const tromboneEngine = new PhraseEngine(PHRASE_POOL, "8n");
    this.phraseEngines.push(tromboneEngine);
    const tromboneSeq = tromboneEngine.createSequence(trombone, 0.55);
    Tone.connect(trombone, melodyStem);
    this.sequences.push(tromboneSeq);

    // Deep drums (MembraneSynth)
    const drum = new Tone.MembraneSynth({
      pitchDecay: 0.08,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.3 },
      volume: -8,
    });
    Tone.connect(drum, percStem);
    this.synthNodes.push(drum);

    // Anvil hits (short white noise burst)
    const anvil = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.03 },
      volume: -14,
    });
    Tone.connect(anvil, percStem);
    this.synthNodes.push(anvil);

    const percSeq = new Tone.Sequence(
      (time, step) => {
        if (step === 0 || step === 4) drum.triggerAttackRelease("C1", "8n", time);
        if (step === 3 || step === 7) anvil.triggerAttackRelease("16n", time);
      },
      [0, 1, 2, 3, 4, 5, 6, 7],
      "8n"
    );
    percSeq.loop = true;
    this.sequences.push(percSeq);

    // Bagpipe-style drone (sawtooth oscillator)
    const drone = new Tone.Synth({
      oscillator: { type: "sawtooth4" },
      envelope: { attack: 2.0, decay: 0, sustain: 1.0, release: 3.0 },
      volume: -22,
    });
    Tone.connect(drone, droneStem);
    this.synthNodes.push(drone);

    const droneSeq = new Tone.Sequence(
      (time) => {
        drone.triggerAttackRelease("A2", "2m", time, 0.3);
      },
      [0],
      "2m"
    );
    droneSeq.loop = true;
    this.sequences.push(droneSeq);

    // Proximity: anvil/industrial stem (MetalSynth)
    this.proximityMixer = new ProximityMixer();
    const anvilStem = this.ctx.createGain();
    anvilStem.connect(this.output);

    const metalSynth = new Tone.MetalSynth({
      frequency: 200,
      envelope: { attack: 0.001, decay: 0.15, release: 0.05 },
      harmonicity: 5.1,
      modulationIndex: 16,
      resonance: 4000,
      octaves: 1.5,
      volume: -16,
    });
    Tone.connect(metalSynth, anvilStem);
    this.synthNodes.push(metalSynth);

    const metalSeq = new Tone.Sequence(
      (time, step) => {
        if (step === 0 || step === 3 || step === 5) {
          metalSynth.triggerAttackRelease("16n", time);
        }
      },
      [0, 1, 2, 3, 4, 5, 6, 7],
      "8n"
    );
    metalSeq.loop = true;
    this.sequences.push(metalSeq);
    this.proximityMixer.addStem("anvil-industrial", anvilStem, {
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
