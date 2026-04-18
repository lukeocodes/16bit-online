import {
  Scene,
  SceneActivationContext,
  TileMap,
  ImageSource,
  SpriteSheet,
  Keys,
  Engine,
  Vector,
} from "excalibur";
import { TILE, tileToWorld } from "../tile.js";
import { NetworkManager, Opcode } from "../net/NetworkManager.js";
import { PlayerActor } from "../actors/PlayerActor.js";
import { RemotePlayerActor } from "../actors/RemotePlayerActor.js";

const MAP_W = 40;
const MAP_H = 30;

export class GameScene extends Scene {
  private net: NetworkManager;
  private characterId: string;
  private player!: PlayerActor;
  private remotePlayers = new Map<string, RemotePlayerActor>();

  private lastSendTime = 0;
  private readonly SEND_HZ = 15;
  private heldDir: { dx: number; dy: number } | null = null;

  constructor(net: NetworkManager, characterId: string) {
    super();
    this.net = net;
    this.characterId = characterId;
  }

  override async onInitialize(engine: Engine): Promise<void> {
    this.net.setOnEvent((msg) => this.handleEvent(msg));
    this.net.setOnPosition((buf) => this.handlePositionUpdate(buf));

    // Tilemap — 16×16 tiles from the summer forest sheet
    const tilesetImg = new ImageSource("/assets/tilesets/summer forest.png");
    await tilesetImg.load();
    this.add(this.buildMap(tilesetImg));

    // Player — spawned at server tile position
    const spawnX = tileToWorld(this.net.spawn.x);
    const spawnY = tileToWorld(this.net.spawn.z);

    const spriteImg = new ImageSource("/assets/sprites/player.png");
    await spriteImg.load();

    this.player = new PlayerActor(spriteImg, spawnX, spawnY, this.characterId);
    this.add(this.player);

    // Camera
    this.camera.zoom = 3;
    this.camera.pos = new Vector(spawnX, spawnY);
    this.camera.strategy.lockToActor(this.player);
  }

  override onActivate(_ctx: SceneActivationContext): void {}

  override onPreUpdate(engine: Engine, _delta: number): void {
    const kb = engine.input.keyboard;
    const up    = kb.isHeld(Keys.ArrowUp)    || kb.isHeld(Keys.W);
    const down  = kb.isHeld(Keys.ArrowDown)  || kb.isHeld(Keys.S);
    const left  = kb.isHeld(Keys.ArrowLeft)  || kb.isHeld(Keys.A);
    const right = kb.isHeld(Keys.ArrowRight) || kb.isHeld(Keys.D);

    if      (up)    this.heldDir = { dx: 0,     dy: -TILE };
    else if (down)  this.heldDir = { dx: 0,     dy:  TILE };
    else if (left)  this.heldDir = { dx: -TILE, dy: 0 };
    else if (right) this.heldDir = { dx:  TILE, dy: 0 };
    else            this.heldDir = null;

    if (this.heldDir) this.player.tryMove(this.heldDir.dx, this.heldDir.dy);

    // Throttled position send
    const now = performance.now();
    if (now - this.lastSendTime > 1000 / this.SEND_HZ) {
      this.net.sendPosition(this.player.pos.x / TILE, 0, this.player.pos.y / TILE, this.player.rotation);
      this.lastSendTime = now;
    }
  }

  private handleEvent(raw: string): void {
    try {
      const msg = JSON.parse(raw);
      switch (msg.op) {
        case Opcode.ENTITY_SPAWN:
          if (msg.entityId !== this.characterId && msg.entityType === "player")
            this.spawnRemote(msg);
          break;
        case Opcode.ENTITY_DESPAWN:
          this.despawnRemote(msg.entityId);
          break;
      }
    } catch { /* ignore */ }
  }

  private handlePositionUpdate(_buf: ArrayBuffer): void {
    // Full state sync wired later
  }

  private spawnRemote(msg: { entityId: string; x: number; z: number }): void {
    if (this.remotePlayers.has(msg.entityId)) return;
    const remote = new RemotePlayerActor(tileToWorld(msg.x), tileToWorld(msg.z), msg.entityId);
    this.remotePlayers.set(msg.entityId, remote);
    this.add(remote);
  }

  private despawnRemote(entityId: string): void {
    const actor = this.remotePlayers.get(entityId);
    if (actor) { actor.kill(); this.remotePlayers.delete(entityId); }
  }

  private buildMap(img: ImageSource): TileMap {
    const map = new TileMap({
      rows: MAP_H, columns: MAP_W,
      tileWidth: TILE, tileHeight: TILE,
    });
    // summer forest.png: 512×336, 32 cols × 21 rows at 16×16
    const sheet = SpriteSheet.fromImageSource({
      image: img,
      grid: { rows: 21, columns: 32, spriteWidth: TILE, spriteHeight: TILE },
    });
    // col 4, row 0 = solid grass
    const grass = sheet.getSprite(4, 0);
    for (let r = 0; r < MAP_H; r++)
      for (let c = 0; c < MAP_W; c++)
        map.getTile(c, r)?.addGraphic(grass);
    return map;
  }
}
