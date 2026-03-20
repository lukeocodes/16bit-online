/**
 * Enemy Nearby track — suspense, heartbeat tension.
 * Scale: atonal_tension | BPM: 100 | All synthesis (no sampled instruments)
 * Synths: low strings tremolo (FMSynth + LFO), heartbeat bass (MembraneSynth),
 *         high bowed metal (MetalSynth)
 * Special: updateProximityTension(normalizedDistance) scales heartbeat rate,
 *          volume, and tremolo depth by distance (0=close, 1=far).
 * No proximity stems.
 */
import * as Tone from "tone";
import { BaseTrack } from "../BaseTrack";

export class EnemyNearbyTrack extends BaseTrack {
  private heartbeatInterval: number = 2000; // ms
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatSynth: Tone.MembraneSynth | null = null;
  private tremoloSynth: Tone.FMSynth | null = null;
  private metalSynth: Tone.MetalSynth | null = null;

  constructor(ctx: AudioContext) {
    super("enemy-nearby", ctx);
  }

  async start(): Promise<void> {
    if (this.isPlaying) return;

    // Low strings tremolo (FMSynth with fast modulation)
    this.tremoloSynth = new Tone.FMSynth({
      harmonicity: 1,
      modulationIndex: 8,
      envelope: { attack: 0.5, decay: 0, sustain: 1.0, release: 1.0 },
      modulation: { type: "sine" },
      volume: -16,
    });
    const tremoloGain = this.ctx.createGain();
    tremoloGain.gain.value = 0.5;
    tremoloGain.connect(this.output);
    Tone.connect(this.tremoloSynth, tremoloGain);
    this.synthNodes.push(this.tremoloSynth);

    const tremoloSeq = new Tone.Sequence(
      (time) => {
        this.tremoloSynth?.triggerAttackRelease("C2", "1m", time, 0.4);
      },
      [0],
      "1m"
    );
    tremoloSeq.loop = true;
    this.sequences.push(tremoloSeq);

    // Heartbeat bass pulse (MembraneSynth, repeating)
    this.heartbeatSynth = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 4,
      envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 },
      volume: -8,
    });
    const heartbeatGain = this.ctx.createGain();
    heartbeatGain.gain.value = 0.6;
    heartbeatGain.connect(this.output);
    Tone.connect(this.heartbeatSynth, heartbeatGain);
    this.synthNodes.push(this.heartbeatSynth);

    // Start heartbeat using interval timer
    this.startHeartbeat();

    // High bowed metal (MetalSynth, quiet)
    this.metalSynth = new Tone.MetalSynth({
      frequency: 800,
      envelope: { attack: 0.5, decay: 2.0, release: 1.0 },
      harmonicity: 3.1,
      modulationIndex: 8,
      resonance: 2000,
      octaves: 0.5,
      volume: -28,
    });
    const metalGain = this.ctx.createGain();
    metalGain.gain.value = 0.3;
    metalGain.connect(this.output);
    Tone.connect(this.metalSynth, metalGain);
    this.synthNodes.push(this.metalSynth);

    const metalSeq = new Tone.Sequence(
      (time) => {
        this.metalSynth?.triggerAttackRelease("4n", time, 0.2);
      },
      [0],
      "2m"
    );
    metalSeq.loop = true;
    this.sequences.push(metalSeq);

    // Start sequences
    for (const seq of this.sequences) {
      seq.start(0);
    }

    this.isPlaying = true;
  }

  /**
   * Update tension level based on normalized distance to enemy.
   * @param normalizedDistance 0.0 = very close, 1.0 = far away
   *
   * Scales:
   *   - Heartbeat interval: 500ms (close) to 2000ms (far)
   *   - Overall volume: 0.9 (close) to 0.3 (far)
   *   - Tremolo depth: increases as distance decreases
   */
  updateProximityTension(normalizedDistance: number): void {
    const d = Math.max(0, Math.min(1, normalizedDistance));

    // Heartbeat rate: 0.5s (close) to 2s (far)
    this.heartbeatInterval = 500 + d * 1500;
    this.restartHeartbeat();

    // Overall volume: 0.9 (close) to 0.3 (far)
    const targetVolume = 0.9 - d * 0.6;
    const now = this.ctx.currentTime;
    this.output.gain.setValueAtTime(this.output.gain.value, now);
    this.output.gain.linearRampToValueAtTime(targetVolume, now + 0.3);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.heartbeatSynth && this.isPlaying) {
        this.heartbeatSynth.triggerAttackRelease("C1", "8n");
      }
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private restartHeartbeat(): void {
    if (this.isPlaying) {
      this.startHeartbeat();
    }
  }

  stop(): void {
    this.stopHeartbeat();
    super.stop();
  }

  dispose(): void {
    this.stopHeartbeat();
    super.dispose();
  }
}
