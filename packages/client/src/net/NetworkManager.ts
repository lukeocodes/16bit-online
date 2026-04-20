// NetworkManager — WebRTC connection to the game server.
// Two DataChannels:
//   "position"  — unreliable binary, 24-byte position updates
//   "reliable"  — reliable, JSON (game events) + some binary (combat)

export type BinaryHandler = (data: ArrayBuffer) => void;
export type TextHandler = (msg: string) => void;

export interface SpawnPosition {
  x: number;
  y: number;
  z: number;
}

/** Populated from the server's WORLD_READY + ZONE_CHANGE messages. */
export interface ZoneInfo {
  zoneId:   string;
  zoneName: string;
  /** URL-decoded path relative to /maps/, e.g. "test-zones/summer-forest/map.tmx" */
  mapFile:  string;
  musicTag: string;
}

export const Opcode = {
  POSITION_UPDATE: 1,
  ENTITY_SPAWN: 2,
  ENTITY_DESPAWN: 3,
  TARGET_SELECT: 40,
  AUTO_ATTACK_TOGGLE: 41,
  CHAT_MESSAGE: 20,
  DAMAGE_EVENT: 50,
  ENTITY_DEATH: 51,
  ENTITY_STATE: 52,
  COMBAT_STATE: 53,
  XP_GAIN: 80,
  LEVEL_UP: 81,
  PLAYER_RESPAWN: 82,
  CHUNK_DATA: 11,
  ZONE_CHANGE_REQUEST: 90,
  ZONE_CHANGE:         91,
  WORLD_READY: 100,
  // --- World builder ---
  BUILDER_NEW_MAP:      200,
  BUILDER_PLACE_TILE:   201,
  BUILDER_REMOVE_TILE:  202,
  BUILDER_MAP_SNAPSHOT: 203,
  BUILDER_TILE_PLACED:  204,
  BUILDER_TILE_REMOVED: 205,
  BUILDER_LIST_MAPS:    206,
  BUILDER_MAPS_LIST:    207,
  BUILDER_GOTO_MAP:     208,
  BUILDER_ERROR:        209,
  BUILDER_PLACE_BLOCK:  210,
  BUILDER_REMOVE_BLOCK: 211,
  BUILDER_BLOCK_PLACED: 212,
  BUILDER_BLOCK_REMOVED:213,
  PING: 253,
  PONG: 254,
} as const;

export class NetworkManager {
  private pc: RTCPeerConnection | null = null;
  private positionChannel: RTCDataChannel | null = null;
  private reliableChannel: RTCDataChannel | null = null;
  public connected = false;

  public spawn: SpawnPosition = { x: 0, y: 0, z: 0 };
  public zone:  ZoneInfo = { zoneId: "", zoneName: "", mapFile: "", musicTag: "" };

  private onPosition: BinaryHandler | null = null;
  private onEvent: TextHandler | null = null;
  private onBinaryEvent: BinaryHandler | null = null;
  private onDisconnect: ((reason: string) => void) | null = null;
  private worldReadyResolve: (() => void) | null = null;

  /** Events buffered while no `onEvent` handler is registered. Flushed on setOnEvent(). */
  private queuedEvents: string[] = [];
  private queuedBinaryEvents: ArrayBuffer[] = [];

  setOnPosition(h: BinaryHandler) { this.onPosition = h; }
  setOnEvent(h: TextHandler) {
    this.onEvent = h;
    // Flush anything that arrived before the scene attached.
    if (this.queuedEvents.length > 0) {
      const q = this.queuedEvents;
      this.queuedEvents = [];
      for (const msg of q) h(msg);
    }
  }
  setOnBinaryEvent(h: BinaryHandler) {
    this.onBinaryEvent = h;
    if (this.queuedBinaryEvents.length > 0) {
      const q = this.queuedBinaryEvents;
      this.queuedBinaryEvents = [];
      for (const msg of q) h(msg);
    }
  }
  setOnDisconnect(h: (reason: string) => void) { this.onDisconnect = h; }

  async connect(token: string, characterId: string): Promise<void> {
    // Phase 1: Server creates offer + DataChannels
    const offerRes = await fetch("/api/rtc/offer", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ characterId }),
    });
    if (!offerRes.ok) {
      const err = await offerRes.json().catch(() => ({ detail: "offer failed" }));
      throw new Error(err.detail ?? "RTC offer failed");
    }
    const offer = await offerRes.json();

    const iceServers = offer.iceServers ?? [{ urls: "stun:stun.l.google.com:19302" }];
    this.pc = new RTCPeerConnection({ iceServers });

    // Phase 2: Wire up DataChannels that the server will push
    const channelsReady = new Promise<void>((resolve) => {
      let posOpen = false;
      let relOpen = false;
      const check = () => { if (posOpen && relOpen) resolve(); };

      this.pc!.ondatachannel = (ev) => {
        const ch = ev.channel;

        if (ch.label === "position") {
          this.positionChannel = ch;
          ch.binaryType = "arraybuffer";
          ch.onmessage = (e) => { if (this.onPosition) this.onPosition(e.data as ArrayBuffer); };
          ch.onopen = () => { posOpen = true; check(); };

        } else if (ch.label === "reliable") {
          this.reliableChannel = ch;
          ch.binaryType = "arraybuffer";
          ch.onmessage = (e) => {
            const raw = e.data;
            // Binary frames route by first byte opcode
            if (raw instanceof ArrayBuffer && raw.byteLength >= 1) {
              const op = new Uint8Array(raw)[0];
              if (op === Opcode.CHUNK_DATA) return; // ignore for now
              // Binary combat / state messages
              if ([50, 51, 52, 53, 70, 32, 80, 81, 82].includes(op)) {
                if (this.onBinaryEvent) this.onBinaryEvent(raw);
                else this.queuedBinaryEvents.push(raw);
                return;
              }
            }
            // JSON frame
            const str = typeof raw === "string" ? raw : new TextDecoder().decode(raw as ArrayBuffer);
            try {
              const msg = JSON.parse(str);
              if (msg.op === Opcode.WORLD_READY) {
                if (msg.spawnX != null) {
                  this.spawn = { x: msg.spawnX, y: msg.spawnY ?? 0, z: msg.spawnZ };
                }
                this.zone = {
                  zoneId:   msg.zoneId   ?? "",
                  zoneName: msg.zoneName ?? "",
                  mapFile:  msg.mapFile  ?? "",
                  musicTag: msg.musicTag ?? "",
                };
                if (this.worldReadyResolve) this.worldReadyResolve();
                return;
              }
            } catch { /* not JSON */ }
            if (this.onEvent) this.onEvent(str);
            else this.queuedEvents.push(str);
          };
          ch.onopen = () => { relOpen = true; check(); };
        }
      };
    });

    this.pc.onconnectionstatechange = () => {
      const s = this.pc?.connectionState;
      if (s === "failed" || s === "closed" || s === "disconnected") {
        this.connected = false;
        if (this.onDisconnect) this.onDisconnect(s);
      }
    };

    // Gather ICE
    const iceDone = new Promise<void>((resolve) => {
      this.pc!.onicecandidate = (ev) => { if (!ev.candidate) resolve(); };
      setTimeout(resolve, 3000);
    });

    await this.pc.setRemoteDescription(new RTCSessionDescription({ sdp: offer.sdp, type: offer.type }));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await iceDone;

    // Phase 3: Send answer
    const answerRes = await fetch("/api/rtc/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ characterId, sdp: this.pc.localDescription!.sdp }),
    });
    if (!answerRes.ok) throw new Error("Failed to send answer");

    // Wait for both DataChannels to open (10s timeout)
    await Promise.race([
      channelsReady,
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error("DataChannel timeout")), 10000)),
    ]);

    // Wait for WORLD_READY from server
    await Promise.race([
      new Promise<void>((resolve) => { this.worldReadyResolve = resolve; }),
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error("WORLD_READY timeout")), 15000)),
    ]);

    this.connected = true;
  }

  // Send binary position update to server (24-byte packet)
  sendPosition(x: number, y: number, z: number, rotation: number): void {
    if (!this.positionChannel || this.positionChannel.readyState !== "open") return;
    const buf = new ArrayBuffer(24);
    const view = new DataView(buf);
    view.setUint8(0, Opcode.POSITION_UPDATE);
    view.setFloat32(1, x, true);
    view.setFloat32(5, y, true);
    view.setFloat32(9, z, true);
    view.setFloat32(13, rotation, true);
    view.setFloat32(17, 0, true); // velocity placeholder
    view.setUint8(21, 0); // flags
    view.setUint8(22, 0);
    view.setUint8(23, 0);
    this.positionChannel.send(buf);
  }

  // Send reliable JSON message
  sendEvent(op: number, data: Record<string, unknown> = {}): void {
    if (!this.reliableChannel || this.reliableChannel.readyState !== "open") return;
    this.reliableChannel.send(JSON.stringify({ op, ...data }));
  }

  disconnect(): void {
    this.pc?.close();
    this.pc = null;
    this.connected = false;
  }
}
