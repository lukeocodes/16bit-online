/**
 * Tone.js initialization and shared context access.
 * Tone.js owns the AudioContext; all audio routing uses its raw context.
 */
import * as Tone from "tone";

let initialized = false;

export function initTone(bpm = 120): void {
  if (initialized) return;
  const transport = Tone.getTransport();
  transport.bpm.value = bpm;
  transport.timeSignature = 4;
  initialized = true;
}

export function getToneContext(): AudioContext {
  return Tone.getContext().rawContext as AudioContext;
}

export function getToneTransport(): typeof Tone.Transport {
  return Tone.getTransport() as typeof Tone.Transport;
}

export async function startTone(): Promise<void> {
  await Tone.start();
  if (Tone.getTransport().state !== "started") {
    Tone.getTransport().start();
  }
}

export function isToneReady(): boolean {
  return Tone.getContext().state === "running";
}
