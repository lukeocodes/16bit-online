/**
 * Victory stinger — short celebratory fanfare, one-shot (not looping).
 * Ascending C Major arpeggio on trumpet + held chord on PolySynth pad.
 * Duration: ~3 seconds, auto-stops after Part completes.
 * Extends BaseTrack for lifecycle consistency.
 * Uses Tone.Part (not Sequence) for one-shot scheduling.
 */
import * as Tone from "tone";
import { BaseTrack } from "../BaseTrack";

export class VictoryStinger extends BaseTrack {
  constructor(ctx: AudioContext) {
    super("victory", ctx);
  }

  async start(): Promise<void> {
    if (this.isPlaying) return;

    // Fanfare stem
    const fanfareGain = this.ctx.createGain();
    fanfareGain.gain.value = 0.8;
    fanfareGain.connect(this.output);

    // Pad chord stem
    const padGain = this.ctx.createGain();
    padGain.gain.value = 0.5;
    padGain.connect(this.output);

    // Trumpet-like synth for arpeggio
    const trumpet = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.5 },
      volume: -6,
    });
    Tone.connect(trumpet, fanfareGain);
    this.synthNodes.push(trumpet);

    // PolySynth pad for final held chord
    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.1, decay: 0.5, sustain: 0.7, release: 1.5 },
      volume: -10,
    });
    Tone.connect(pad, padGain);
    this.synthNodes.push(pad);

    // One-shot ascending C Major arpeggio using Tone.Part
    const arpeggio = new Tone.Part(
      (time, event: { note: string; type: string }) => {
        if (event.type === "arpeggio") {
          trumpet.triggerAttackRelease(event.note, "8n", time, 0.8);
        } else if (event.type === "chord") {
          pad.triggerAttackRelease(
            ["C5", "E5", "G5", "C6"],
            "2n",
            time,
            0.6
          );
        }
      },
      [
        { time: 0, note: "C5", type: "arpeggio" },
        { time: 0.3, note: "E5", type: "arpeggio" },
        { time: 0.6, note: "G5", type: "arpeggio" },
        { time: 0.9, note: "C6", type: "arpeggio" },
        { time: 1.2, note: "C5", type: "chord" },
      ]
    );

    arpeggio.loop = false;
    arpeggio.start(0);

    // Store as sequence for cleanup (cast for lifecycle compatibility)
    this.sequences.push(arpeggio as unknown as Tone.Sequence);

    // Auto-stop after ~3 seconds
    setTimeout(() => {
      this.stop();
    }, 3000);

    this.isPlaying = true;
  }
}
