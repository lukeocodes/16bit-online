/**
 * Elf Town track — ethereal, natural, unhurried.
 * Scale: D Dorian | BPM: 80 | Instruments: dulcimer + pan flute
 * Variable phrase length: 7 bars (14 eighth-notes)
 * Proximity stems: choral pad
 */
import * as Tone from "tone";
import { BaseTrack } from "../BaseTrack";
import { SampleCache } from "../SampleCache";
import { PhraseEngine } from "../PhraseEngine";
import { ProximityMixer } from "../ProximityMixer";

/** 7-bar phrases: 14 eighth-notes from D Dorian pentatonic subset */
const PHRASE_POOL: (string | null)[][] = [
  ["D4", "F4", "A4", "G4", "F4", "D4", "E4", "G4", "A4", "B4", "A4", "G4", "F4", "D4"],
  ["E4", "G4", "A4", "B4", "A4", "G4", "F4", "D4", "E4", "F4", "G4", "A4", "G4", "E4"],
  ["A4", "G4", "F4", "E4", "D4", "F4", "G4", "A4", "B4", "A4", "G4", "F4", "E4", "D4"],
  ["D4", "E4", "G4", "A4", "G4", "F4", "E4", "D4", "F4", "A4", "G4", "E4", "F4", "D4"],
  ["G4", "A4", "B4", "A4", "G4", "E4", "D4", "F4", "G4", "A4", "G4", "F4", "E4", "D4"],
];

export class ElfTownTrack extends BaseTrack {
  private sampleCache: SampleCache;
  private phraseEngines: PhraseEngine[] = [];

  constructor(ctx: AudioContext, sampleCache: SampleCache) {
    super("elf-town", ctx);
    this.sampleCache = sampleCache;
  }

  async start(): Promise<void> {
    if (this.isPlaying) return;

    // Load instruments
    const dulcimer = await this.sampleCache.loadInstrument("dulcimer");
    const panFlute = await this.sampleCache.loadInstrument("panFlute");
    const choirAahs = await this.sampleCache.loadInstrument("choirAahs");
    this.samplers.push(dulcimer, panFlute, choirAahs);

    // Stem gain nodes
    const melodyStem = this.ctx.createGain();
    melodyStem.gain.value = 0.7;
    melodyStem.connect(this.output);

    const counterStem = this.ctx.createGain();
    counterStem.gain.value = 0.45;
    counterStem.connect(this.output);

    const padStem = this.ctx.createGain();
    padStem.gain.value = 0.3;
    padStem.connect(this.output);

    // Dulcimer arpeggiated melody (14-note phrases for 7-bar length)
    const dulcimerEngine = new PhraseEngine(PHRASE_POOL, "8n");
    this.phraseEngines.push(dulcimerEngine);
    const dulcimerSeq = dulcimerEngine.createSequence(dulcimer, 0.65);
    Tone.connect(dulcimer, melodyStem);
    this.sequences.push(dulcimerSeq);

    // Pan flute breathy counter-melody
    const fluteEngine = new PhraseEngine(PHRASE_POOL, "8n");
    this.phraseEngines.push(fluteEngine);
    const fluteSeq = fluteEngine.createSequence(panFlute, 0.4);
    Tone.connect(panFlute, counterStem);
    this.sequences.push(fluteSeq);

    // Soft string pad (PolySynth with FMSynth voice)
    const pad = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1.5,
      modulationIndex: 0.8,
      envelope: { attack: 1.5, decay: 0.5, sustain: 0.7, release: 2.5 },
      volume: -20,
    });
    Tone.connect(pad, padStem);
    this.synthNodes.push(pad);

    const padSeq = new Tone.Sequence(
      (time) => {
        pad.triggerAttackRelease(["D3", "F3", "A3"], "2n", time, 0.25);
      },
      [0],
      "1m"
    );
    padSeq.loop = true;
    this.sequences.push(padSeq);

    // Proximity: choral aah pad
    this.proximityMixer = new ProximityMixer();
    const choralStem = this.ctx.createGain();
    choralStem.connect(this.output);
    Tone.connect(choirAahs, choralStem);

    const choralEngine = new PhraseEngine(
      [["D4", "F4", "A4", "D5", "A4", "F4", "D4", "F4", "A4", "D5", "A4", "F4", "D4", "E4"]],
      "8n"
    );
    this.phraseEngines.push(choralEngine);
    const choralSeq = choralEngine.createSequence(choirAahs, 0.4);
    this.sequences.push(choralSeq);
    this.proximityMixer.addStem("choral-pad", choralStem, {
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
