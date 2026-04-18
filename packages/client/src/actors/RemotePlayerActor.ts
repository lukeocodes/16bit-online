import { Actor, Color, Vector } from "excalibur";

// Placeholder remote player — just a coloured square until sprite sheets
// and the full state sync (numeric hash map) are wired in.
export class RemotePlayerActor extends Actor {
  private targetPos: Vector;
  private readonly LERP_SPEED = 200; // px/s

  constructor(x: number, y: number, _entityId: string) {
    super({ x, y, width: 12, height: 12, color: Color.fromHex("#ff6666") });
    this.targetPos = new Vector(x, y);
  }

  // Called by GameScene when a position update arrives for this entity
  updateTargetPosition(x: number, z: number): void {
    this.targetPos = new Vector(x, z);
  }

  override onPreUpdate(_engine: unknown, delta: number): void {
    const dist = this.targetPos.distance(this.pos);
    if (dist > 0.5) {
      const step = Math.min(dist, this.LERP_SPEED * delta / 1000);
      const dir = this.targetPos.sub(this.pos).normalize();
      this.pos = this.pos.add(dir.scale(step));
    } else {
      this.pos = this.targetPos.clone();
    }
  }
}
