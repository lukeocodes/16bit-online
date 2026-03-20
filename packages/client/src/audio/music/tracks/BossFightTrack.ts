/**
 * Boss Fight track — cinematic dread, escalating intensity.
 * Scale: c_sharp_minor (Locrian accents) | BPM: 135
 * 3 HP-threshold phases that add/remove stem layers:
 *   Phase 1 (HP > 60%): orchestra + drums
 *   Phase 2 (HP 30-60%): + choir + distortion
 *   Phase 3 (HP < 30%): all max + enrage tempo 160 BPM
 * Special: bass drop stinger at fight start
 */
import * as Tone from "tone";
import { BaseTrack } from "../BaseTrack";
import { SampleCache } from "../SampleCache";
import { PhraseEngine } from "../PhraseEngine";

/** C# minor ostinato phrases */
const PHRASE_POOL: (string | null)[][] = [
  ["Db4", "E4", "Gb4", "Ab4", "Gb4", "E4", "Db4", "B3"],
  ["Ab4", "Gb4", "E4", "Db4", "E4", "Gb4", "Ab4", "B4"],
  ["E4", "Gb4", "Ab4", "B4", "Ab4", "Gb4", "E4", "Db4"],
  ["Gb4", "E4", "Db4", "B3", "Db4", "E4", "Gb4", "Ab4"],
];

const RAMP_DURATION = 3; // seconds for phase transitions
const ENRAGE_BPM = 160;

interface PhaseState {
  currentPhase: number;
  choirGain: number;
  distortionGain: number;
  rampDuration: number;
}

export class BossFightTrack extends BaseTrack {
  private sampleCache: SampleCache;
  private phraseEngines: PhraseEngine[] = [];
  private savedBPM: number = 0;

  // Phase stem gain nodes
  private choirGainNode: GainNode | null = null;
  private distortionGainNode: GainNode | null = null;
  private currentPhase: number = 1;

  // Target gain values for reporting phase state
  private choirTargetGain: number = 0;
  private distortionTargetGain: number = 0;

  constructor(ctx: AudioContext, sampleCache: SampleCache) {
    super("boss-fight", ctx);
    this.sampleCache = sampleCache;
  }

  async start(): Promise<void> {
    if (this.isPlaying) return;

    // Save original BPM to restore on stop
    this.savedBPM = Tone.getTransport().bpm.value;

    // Load instruments
    const violin = await this.sampleCache.loadInstrument("violin");
    const cello = await this.sampleCache.loadInstrument("cello");
    const choirAahs = await this.sampleCache.loadInstrument("choirAahs");
    this.samplers.push(violin, cello, choirAahs);

    // Phase 1 stems: orchestra + drums (always on)
    const orchestraStem = this.ctx.createGain();
    orchestraStem.gain.value = 0.7;
    orchestraStem.connect(this.output);

    const drumStem = this.ctx.createGain();
    drumStem.gain.value = 0.6;
    drumStem.connect(this.output);

    // Phase 2 stems: choir + distortion (start at 0)
    this.choirGainNode = this.ctx.createGain();
    this.choirGainNode.gain.value = 0;
    this.choirGainNode.connect(this.output);

    this.distortionGainNode = this.ctx.createGain();
    this.distortionGainNode.gain.value = 0;
    this.distortionGainNode.connect(this.output);

    // Full orchestra (violin)
    const violinEngine = new PhraseEngine(PHRASE_POOL, "8n");
    this.phraseEngines.push(violinEngine);
    const violinSeq = violinEngine.createSequence(violin, 0.75);
    Tone.connect(violin, orchestraStem);
    this.sequences.push(violinSeq);

    // Low strings (cello)
    const celloEngine = new PhraseEngine(
      [["Db3", null, "E3", null, "Gb3", null, "Ab3", null]],
      "8n"
    );
    this.phraseEngines.push(celloEngine);
    const celloSeq = celloEngine.createSequence(cello, 0.6);
    Tone.connect(cello, orchestraStem);
    this.sequences.push(celloSeq);

    // 808-style deep kick (MembraneSynth)
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.08,
      octaves: 8,
      envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.3 },
      volume: -4,
    });
    Tone.connect(kick, drumStem);
    this.synthNodes.push(kick);

    // Heavy snare (NoiseSynth)
    const snare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.06 },
      volume: -8,
    });
    Tone.connect(snare, drumStem);
    this.synthNodes.push(snare);

    const drumSeq = new Tone.Sequence(
      (time, step) => {
        if (step === 0 || step === 4) kick.triggerAttackRelease("C1", "8n", time);
        if (step === 2 || step === 6) snare.triggerAttackRelease("16n", time);
      },
      [0, 1, 2, 3, 4, 5, 6, 7],
      "8n"
    );
    drumSeq.loop = true;
    this.sequences.push(drumSeq);

    // Epic choir (Phase 2+ stem)
    const choirEngine = new PhraseEngine(PHRASE_POOL, "8n");
    this.phraseEngines.push(choirEngine);
    const choirSeq = choirEngine.createSequence(choirAahs, 0.65);
    Tone.connect(choirAahs, this.choirGainNode);
    this.sequences.push(choirSeq);

    // Distorted synth undertone (Phase 2+ stem)
    const distortion = new Tone.FMSynth({
      harmonicity: 5,
      modulationIndex: 15,
      envelope: { attack: 0.5, decay: 0.3, sustain: 0.6, release: 1.0 },
      volume: -18,
    });
    Tone.connect(distortion, this.distortionGainNode);
    this.synthNodes.push(distortion);

    const distortionSeq = new Tone.Sequence(
      (time) => {
        distortion.triggerAttackRelease("Db2", "1m", time, 0.4);
      },
      [0],
      "1m"
    );
    distortionSeq.loop = true;
    this.sequences.push(distortionSeq);

    // Bass drop stinger at fight start
    const bassDropKick = new Tone.MembraneSynth({
      pitchDecay: 0.15,
      octaves: 10,
      envelope: { attack: 0.001, decay: 1.0, sustain: 0, release: 0.5 },
      volume: -2,
    });
    Tone.connect(bassDropKick, this.output);
    this.synthNodes.push(bassDropKick);

    // Schedule bass drop at 0.5s after start
    const bassDropPart = new Tone.Part(
      (time) => {
        bassDropKick.triggerAttackRelease("C1", "2n", time);
      },
      [{ time: 0.5 }]
    );
    bassDropPart.start(0);
    this.sequences.push(bassDropPart as unknown as Tone.Sequence);

    // Start all sequences
    for (const seq of this.sequences) {
      seq.start(0);
    }

    // Default phase 1 state
    this.currentPhase = 1;
    this.choirTargetGain = 0;
    this.distortionTargetGain = 0;

    this.isPlaying = true;
  }

  /**
   * Update boss phase based on HP percentage (0.0 - 1.0).
   * Phase 1 (HP > 60%): orchestra + drums only
   * Phase 2 (HP 30-60%): add choir + distortion (fade in 3s)
   * Phase 3 (HP < 30%): all max + tempo ramp to 160 BPM
   */
  updateBossPhase(hpPercent: number): void {
    let newPhase: number;
    if (hpPercent > 0.6) {
      newPhase = 1;
    } else if (hpPercent > 0.3) {
      newPhase = 2;
    } else {
      newPhase = 3;
    }

    this.currentPhase = newPhase;

    if (this.choirGainNode && this.distortionGainNode) {
      const now = this.ctx.currentTime;

      if (newPhase === 1) {
        // Phase 1: choir + distortion off
        this.choirTargetGain = 0;
        this.distortionTargetGain = 0;
        this.choirGainNode.gain.setValueAtTime(this.choirGainNode.gain.value, now);
        this.choirGainNode.gain.linearRampToValueAtTime(0, now + RAMP_DURATION);
        this.distortionGainNode.gain.setValueAtTime(this.distortionGainNode.gain.value, now);
        this.distortionGainNode.gain.linearRampToValueAtTime(0, now + RAMP_DURATION);
      } else if (newPhase === 2) {
        // Phase 2: add choir + distortion
        this.choirTargetGain = 0.7;
        this.distortionTargetGain = 0.5;
        this.choirGainNode.gain.setValueAtTime(this.choirGainNode.gain.value, now);
        this.choirGainNode.gain.linearRampToValueAtTime(0.7, now + RAMP_DURATION);
        this.distortionGainNode.gain.setValueAtTime(this.distortionGainNode.gain.value, now);
        this.distortionGainNode.gain.linearRampToValueAtTime(0.5, now + RAMP_DURATION);
      } else {
        // Phase 3 / Enrage: all max + tempo shift
        this.choirTargetGain = 1.0;
        this.distortionTargetGain = 0.8;
        this.choirGainNode.gain.setValueAtTime(this.choirGainNode.gain.value, now);
        this.choirGainNode.gain.linearRampToValueAtTime(1.0, now + RAMP_DURATION);
        this.distortionGainNode.gain.setValueAtTime(this.distortionGainNode.gain.value, now);
        this.distortionGainNode.gain.linearRampToValueAtTime(0.8, now + RAMP_DURATION);
        Tone.getTransport().bpm.rampTo(ENRAGE_BPM, RAMP_DURATION);
      }
    }
  }

  /**
   * Get current phase state for testing/debugging.
   */
  getPhaseState(): PhaseState {
    return {
      currentPhase: this.currentPhase,
      choirGain: this.choirTargetGain,
      distortionGain: this.distortionTargetGain,
      rampDuration: RAMP_DURATION,
    };
  }

  /**
   * Override stop to restore original Transport BPM.
   */
  stop(): void {
    super.stop();
    if (this.savedBPM > 0) {
      Tone.getTransport().bpm.rampTo(this.savedBPM, 1);
    }
    this.currentPhase = 1;
    this.choirTargetGain = 0;
    this.distortionTargetGain = 0;
  }
}
