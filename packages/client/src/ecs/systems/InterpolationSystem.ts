import { EntityManager } from "../EntityManager";
import type { PositionComponent } from "../components/Position";

// Tuned to reach target in ~1 server tick (50ms at 20Hz).
// Higher = snappier but can overshoot, lower = smoother but sluggish.
const LERP_SPEED = 18;

export class InterpolationSystem {
  private entityManager: EntityManager;

  constructor(entityManager: EntityManager) {
    this.entityManager = entityManager;
  }

  update(dt: number) {
    for (const entity of this.entityManager.iterEntitiesWithComponents("position")) {
      const pos = entity.components.get("position") as PositionComponent;
      if (!pos.isRemote) continue;

      const t = Math.min(1, LERP_SPEED * dt);

      const dx = pos.remoteTargetX - pos.x;
      const dy = pos.remoteTargetY - pos.y;
      const dz = pos.remoteTargetZ - pos.z;

      // Snap to target once close enough to avoid floating between tiles
      pos.x = Math.abs(dx) < 0.01 ? pos.remoteTargetX : pos.x + dx * t;
      pos.y = Math.abs(dy) < 0.01 ? pos.remoteTargetY : pos.y + dy * t;
      pos.z = Math.abs(dz) < 0.01 ? pos.remoteTargetZ : pos.z + dz * t;

      // Interpolate rotation (handle wraparound)
      let rotDiff = pos.remoteTargetRotation - pos.rotation;
      if (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      if (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
      pos.rotation += rotDiff * t;
    }
  }
}
