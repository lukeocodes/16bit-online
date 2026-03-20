import { MusicState, MUSIC_STATE_PRIORITY, VICTORY_TIMEOUT_MS } from "./types";

export type TransitionCallback = (from: MusicState, to: MusicState) => void;

export class MusicStateMachine {
  private currentState: MusicState = MusicState.Exploring;
  private ambientState: MusicState = MusicState.Exploring; // last non-combat/non-transient
  private bossOverride = false;
  private victoryTimer: ReturnType<typeof setTimeout> | null = null;
  private onTransitionCb: TransitionCallback | null = null;

  getState(): MusicState {
    return this.currentState;
  }

  getAmbientState(): MusicState {
    return this.ambientState;
  }

  isBossOverride(): boolean {
    return this.bossOverride;
  }

  onTransition(cb: TransitionCallback): void {
    this.onTransitionCb = cb;
  }

  requestState(newState: MusicState): boolean {
    // Boss override blocks all non-boss requests
    if (this.bossOverride && newState !== MusicState.Boss) return false;

    // Priority check: only transition if new state has higher or equal priority
    const currentPriority = MUSIC_STATE_PRIORITY[this.currentState];
    const newPriority = MUSIC_STATE_PRIORITY[newState];
    if (newPriority < currentPriority) return false;

    // Same state = no-op
    if (newState === this.currentState) return false;

    this.doTransition(newState);
    return true;
  }

  forceState(newState: MusicState): void {
    if (newState === this.currentState) return;
    if (this.bossOverride && newState !== MusicState.Boss) {
      this.bossOverride = false;
    }
    this.doTransition(newState);
  }

  exitBoss(): void {
    if (!this.bossOverride) return;
    this.bossOverride = false;
    this.doTransition(this.ambientState);
  }

  dispose(): void {
    if (this.victoryTimer) {
      clearTimeout(this.victoryTimer);
      this.victoryTimer = null;
    }
    this.onTransitionCb = null;
  }

  private doTransition(newState: MusicState): void {
    const from = this.currentState;

    // Clear any pending victory timer
    if (this.victoryTimer) {
      clearTimeout(this.victoryTimer);
      this.victoryTimer = null;
    }

    // Track ambient state (Exploring, Town, Dungeon)
    if (
      newState === MusicState.Exploring ||
      newState === MusicState.Town ||
      newState === MusicState.Dungeon
    ) {
      this.ambientState = newState;
    }

    // Boss sets override flag
    if (newState === MusicState.Boss) {
      this.bossOverride = true;
    }

    this.currentState = newState;

    // Fire transition callback
    if (this.onTransitionCb) {
      this.onTransitionCb(from, newState);
    }

    // Victory auto-transitions back to ambient after timeout
    if (newState === MusicState.Victory) {
      this.victoryTimer = setTimeout(() => {
        this.victoryTimer = null;
        // Transition back to ambient, bypassing priority check
        this.doTransition(this.ambientState);
      }, VICTORY_TIMEOUT_MS);
    }
  }
}
