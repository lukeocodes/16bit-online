/**
 * Top-level audio manager.
 * Creates AudioContext via Tone.js, sets up 4 gain buses routed through
 * a master gain, handles visibility ducking, master intensity, and
 * AudioContext resume on user interaction.
 */
import { GainBus } from "./GainBus";
import { initTone, getToneContext, startTone } from "./ToneSetup";
import { initHowlerBridge } from "./HowlerBridge";
import { MusicStateMachine } from "./MusicStateMachine";
import { CrossfadeManager } from "./CrossfadeManager";
import type { BusName, AudioPreferences } from "./types";
import { DEFAULT_AUDIO_PREFERENCES } from "./types";

export class AudioSystem {
  private ctx!: AudioContext;
  private masterGain!: GainNode;
  private buses = new Map<BusName, GainBus>();
  private _intensity = 0.5;
  private _preferences: AudioPreferences = { ...DEFAULT_AUDIO_PREFERENCES };
  private _resumed = false;
  private _disposed = false;
  private visibilityHandler: (() => void) | null = null;
  private resumeClickHandler: (() => void) | null = null;
  private resumeKeyHandler: (() => void) | null = null;
  private musicStateMachine: MusicStateMachine | null = null;
  private crossfadeManager: CrossfadeManager | null = null;

  init(): void {
    initTone(120);
    this.ctx = getToneContext();

    // Master gain -> destination
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this._preferences.masterVolume;
    this.masterGain.connect(this.ctx.destination);

    // Create 4 buses -> master
    this.buses.set("music", new GainBus(this.ctx, this.masterGain));
    this.buses.set("sfx", new GainBus(this.ctx, this.masterGain));
    this.buses.set("weather", new GainBus(this.ctx, this.masterGain));
    this.buses.set("ambient", new GainBus(this.ctx, this.masterGain));

    // Apply initial preferences
    this.buses.get("music")!.setVolume(this._preferences.musicVolume);
    this.buses.get("sfx")!.setVolume(this._preferences.sfxVolume);

    // Wire Howler to SFX bus
    const sfxNode = this.buses.get("sfx")!.node;
    initHowlerBridge(sfxNode);

    // Create music state machine and crossfade manager
    this.musicStateMachine = new MusicStateMachine();
    this.crossfadeManager = new CrossfadeManager(this.buses.get("music")!);

    // Wire state transitions to crossfade
    this.musicStateMachine.onTransition((from, to) => {
      console.log(`[Audio] Music: ${from} -> ${to}`);
      if (this.crossfadeManager) {
        this.crossfadeManager.transition(from, to);
      }
    });

    // Setup tab visibility ducking
    this.setupVisibilityDucking();

    // Setup AudioContext resume on first user interaction
    this.setupResumeOnInteraction();
  }

  getBus(name: BusName): GainBus {
    const bus = this.buses.get(name);
    if (!bus) throw new Error(`Unknown bus: ${name}`);
    return bus;
  }

  getMasterGain(): GainNode {
    return this.masterGain;
  }

  getContext(): AudioContext {
    return this.ctx;
  }

  getMusicStateMachine(): MusicStateMachine | null {
    return this.musicStateMachine;
  }

  getCrossfadeManager(): CrossfadeManager | null {
    return this.crossfadeManager;
  }

  isResumed(): boolean {
    return this._resumed;
  }

  get intensity(): number {
    return this._intensity;
  }

  set intensity(value: number) {
    this._intensity = Math.max(0, Math.min(1, value));
    const now = this.ctx.currentTime;

    // Music scales fully with intensity
    const musicBus = this.buses.get("music")!;
    musicBus.node.gain.setValueAtTime(musicBus.node.gain.value, now);
    musicBus.node.gain.linearRampToValueAtTime(
      musicBus.volume * this._intensity,
      now + 0.3,
    );

    // Weather scales fully with intensity
    const weatherBus = this.buses.get("weather")!;
    weatherBus.node.gain.setValueAtTime(weatherBus.node.gain.value, now);
    weatherBus.node.gain.linearRampToValueAtTime(
      weatherBus.volume * this._intensity,
      now + 0.3,
    );

    // SFX is less affected: 50% base + 50% intensity-scaled
    const sfxBus = this.buses.get("sfx")!;
    sfxBus.node.gain.setValueAtTime(sfxBus.node.gain.value, now);
    sfxBus.node.gain.linearRampToValueAtTime(
      sfxBus.volume * (0.5 + 0.5 * this._intensity),
      now + 0.3,
    );
  }

  setPreferences(prefs: Partial<AudioPreferences>): void {
    if (prefs.masterVolume !== undefined) {
      this._preferences.masterVolume = prefs.masterVolume;
      const now = this.ctx.currentTime;
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(prefs.masterVolume, now + 0.05);
    }
    if (prefs.musicVolume !== undefined) {
      this._preferences.musicVolume = prefs.musicVolume;
      this.buses.get("music")!.setVolume(prefs.musicVolume);
    }
    if (prefs.sfxVolume !== undefined) {
      this._preferences.sfxVolume = prefs.sfxVolume;
      this.buses.get("sfx")!.setVolume(prefs.sfxVolume);
    }
  }

  getPreferences(): AudioPreferences {
    return { ...this._preferences };
  }

  async resume(): Promise<void> {
    if (this._resumed) return;
    await startTone();
    this._resumed = true;
    console.log("[AudioSystem] AudioContext resumed");
  }

  update(_dt: number): void {
    // Reserved for future per-frame audio updates (intensity interpolation, etc.)
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    if (this.musicStateMachine) {
      this.musicStateMachine.dispose();
      this.musicStateMachine = null;
    }
    if (this.crossfadeManager) {
      this.crossfadeManager.dispose();
      this.crossfadeManager = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
    }
    if (this.resumeClickHandler) {
      document.removeEventListener("click", this.resumeClickHandler);
    }
    if (this.resumeKeyHandler) {
      document.removeEventListener("keydown", this.resumeKeyHandler);
    }
    for (const bus of this.buses.values()) {
      bus.disconnect();
    }
    this.masterGain.disconnect();
    this.buses.clear();
  }

  private setupVisibilityDucking(): void {
    this.visibilityHandler = () => {
      const now = this.ctx.currentTime;
      if (document.hidden) {
        // Duck to 10% over 100ms
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.linearRampToValueAtTime(
          this._preferences.masterVolume * 0.1,
          now + 0.1,
        );
      } else {
        // Instant restore (~10ms)
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.linearRampToValueAtTime(
          this._preferences.masterVolume,
          now + 0.01,
        );
      }
    };
    document.addEventListener("visibilitychange", this.visibilityHandler);
  }

  private setupResumeOnInteraction(): void {
    const tryResume = async () => {
      if (!this._resumed) {
        await this.resume();
        // Remove listeners after first successful resume
        if (this.resumeClickHandler) {
          document.removeEventListener("click", this.resumeClickHandler);
        }
        if (this.resumeKeyHandler) {
          document.removeEventListener("keydown", this.resumeKeyHandler);
        }
      }
    };
    this.resumeClickHandler = () => {
      tryResume();
    };
    this.resumeKeyHandler = () => {
      tryResume();
    };
    document.addEventListener("click", this.resumeClickHandler);
    document.addEventListener("keydown", this.resumeKeyHandler);
  }
}
