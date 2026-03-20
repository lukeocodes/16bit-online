/**
 * GainBus wraps a Web Audio API GainNode with volume, mute, and fade helpers.
 * All gain changes use AudioParam automation to avoid clicks/pops.
 */
export class GainBus {
  readonly node: GainNode;
  private ctx: AudioContext;
  private _volume = 1.0;
  private _muted = false;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.node = ctx.createGain();
    this.node.connect(destination);
  }

  get volume(): number {
    return this._volume;
  }

  setVolume(value: number, rampTime = 0.05): void {
    this._volume = Math.max(0, Math.min(1, value));
    if (!this._muted) {
      this.node.gain.setValueAtTime(this.node.gain.value, this.ctx.currentTime);
      this.node.gain.linearRampToValueAtTime(
        this._volume,
        this.ctx.currentTime + rampTime,
      );
    }
  }

  mute(): void {
    this._muted = true;
    this.node.gain.setValueAtTime(this.node.gain.value, this.ctx.currentTime);
    this.node.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.05);
  }

  unmute(): void {
    this._muted = false;
    this.node.gain.setValueAtTime(this.node.gain.value, this.ctx.currentTime);
    this.node.gain.linearRampToValueAtTime(
      this._volume,
      this.ctx.currentTime + 0.05,
    );
  }

  fadeTo(target: number, duration: number): void {
    this._volume = Math.max(0, Math.min(1, target));
    this.node.gain.setValueAtTime(this.node.gain.value, this.ctx.currentTime);
    this.node.gain.linearRampToValueAtTime(
      this._volume,
      this.ctx.currentTime + duration,
    );
  }

  disconnect(): void {
    this.node.disconnect();
  }
}
