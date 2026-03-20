/**
 * Howler.js SFX bus bridge.
 * Disconnects Howler's default output and routes through the SFX gain bus.
 */
import { Howler } from "howler";

let bridged = false;

export function initHowlerBridge(sfxBusNode: GainNode): void {
  if (bridged) return;

  // Force Howler to initialize its AudioContext by accessing ctx
  const _ctx = Howler.ctx;
  if (!_ctx) {
    console.warn(
      "[HowlerBridge] Howler.ctx not available yet; deferring bridge",
    );
    return;
  }

  // Disconnect Howler's default output and route through SFX bus
  if (Howler.masterGain) {
    try {
      Howler.masterGain.disconnect();
    } catch {
      // May already be disconnected
    }
    Howler.masterGain.connect(sfxBusNode);
    bridged = true;
    console.log("[HowlerBridge] Howler.masterGain routed to SFX bus");
  }
}

export function isHowlerBridged(): boolean {
  return bridged;
}
