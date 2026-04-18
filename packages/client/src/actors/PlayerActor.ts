import {
  Actor,
  ImageSource,
  SpriteSheet,
  Sprite,
  Animation,
  AnimationStrategy,
  Vector,
  Color,
} from "excalibur";
import { TILE, CHAR_W, CHAR_H } from "../tile.js";

// Mana Seed NPC pack sheet: 128×256px, 4 cols × 8 rows, 32×32 per frame.
// At native resolution: exactly CHAR_W (16) wide × CHAR_H (32) tall = 1×2 tiles.
// No scaling required.
//
// Row layout:
//   0 = walk down   (4 frames)
//   1 = walk left   (4 frames)
//   2 = walk right  (4 frames)
//   3 = walk up     (4 frames)
// Idle = col 0 of each row.

const COLS = 4;
const FRAME_MS = 150;

export type Direction = "down" | "up" | "left" | "right";

export class PlayerActor extends Actor {
  private idleDown!: Sprite;
  private idleUp!: Sprite;
  private idleLeft!: Sprite;
  private idleRight!: Sprite;
  private walkDown!: Animation;
  private walkUp!: Animation;
  private walkLeft!: Animation;
  private walkRight!: Animation;

  private currentDir: Direction = "down";
  private isMoving = false;
  private targetPos: Vector;

  // px/s — crosses one TILE (16 units) in ~83ms, feels responsive
  private readonly MOVE_SPEED = 192;

  constructor(img: ImageSource, x: number, y: number, _entityId: string) {
    // Collision box: 1 tile wide, 1 tile tall (feet area)
    super({ x, y, width: CHAR_W, height: TILE, color: Color.fromHex("#e8c4a0") });
    this.targetPos = new Vector(x, y);
    this.setupSprite(img);
  }

  private setupSprite(img: ImageSource): void {
    // Frames are CHAR_H × CHAR_H (32×32) — exactly 1w × 2h tiles at native res
    const sheet = SpriteSheet.fromImageSource({
      image: img,
      grid: { rows: 8, columns: COLS, spriteWidth: CHAR_H, spriteHeight: CHAR_H },
    });

    const sprite = (col: number, row: number): Sprite => sheet.getSprite(col, row);
    const anim = (row: number): Animation => new Animation({
      frames: [0, 1, 2, 3].map(col => ({ graphic: sprite(col, row), duration: FRAME_MS })),
      strategy: AnimationStrategy.Loop,
    });

    this.idleDown  = sprite(0, 0);
    this.idleLeft  = sprite(0, 1);
    this.idleRight = sprite(0, 2);
    this.idleUp    = sprite(0, 3);

    this.walkDown  = anim(0);
    this.walkLeft  = anim(1);
    this.walkRight = anim(2);
    this.walkUp    = anim(3);

    // Sprite is CHAR_H (32) tall, actor anchor is centre of collision box (16 tall).
    // Shift up by half the extra height so feet sit at the bottom of the collision tile.
    this.graphics.use(this.idleDown);
    this.graphics.offset = new Vector(0, -(CHAR_H - TILE) / 2); // -8
  }

  tryMove(dx: number, dy: number): void {
    if (this.isMoving) return;
    this.targetPos = new Vector(this.pos.x + dx, this.pos.y + dy);
    this.isMoving = true;
    if      (dx > 0) this.setDir("right");
    else if (dx < 0) this.setDir("left");
    else if (dy > 0) this.setDir("down");
    else if (dy < 0) this.setDir("up");
  }

  private setDir(dir: Direction): void {
    this.currentDir = dir;
    switch (dir) {
      case "down":  this.graphics.use(this.walkDown);  break;
      case "up":    this.graphics.use(this.walkUp);    break;
      case "left":  this.graphics.use(this.walkLeft);  break;
      case "right": this.graphics.use(this.walkRight); break;
    }
    this.graphics.offset = new Vector(0, -(CHAR_H - TILE) / 2);
  }

  private setIdle(): void {
    switch (this.currentDir) {
      case "down":  this.graphics.use(this.idleDown);  break;
      case "up":    this.graphics.use(this.idleUp);    break;
      case "left":  this.graphics.use(this.idleLeft);  break;
      case "right": this.graphics.use(this.idleRight); break;
    }
    this.graphics.offset = new Vector(0, -(CHAR_H - TILE) / 2);
  }

  override onPreUpdate(_engine: unknown, delta: number): void {
    const dist = this.targetPos.distance(this.pos);
    if (dist > 0.5) {
      const step = Math.min(dist, this.MOVE_SPEED * delta / 1000);
      this.pos = this.pos.add(this.targetPos.sub(this.pos).normalize().scale(step));
      this.isMoving = true;
    } else {
      this.pos = this.targetPos.clone();
      if (this.isMoving) {
        this.isMoving = false;
        this.setIdle();
      }
    }
  }
}
