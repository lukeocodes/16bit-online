import type { Container } from "pixi.js";
import { worldToScreen } from "./IsometricRenderer";

const DEFAULT_ZOOM = 2.0;
export const MIN_ZOOM = 1.0;
export const MAX_ZOOM = 4.0;
// Exponential decay rate (higher = snappier follow). Frame-rate independent.
const FOLLOW_SPEED = 12;

/**
 * 2D isometric camera — replaces Babylon.js IsometricCamera.
 * In 2D, the "camera" is just a translation + scale on the world container.
 */
export class IsoCamera {
  private targetX = 0;
  private targetY = 0;
  private currentX = 0;
  private currentY = 0;
  private zoom = DEFAULT_ZOOM;
  private targetZoom = DEFAULT_ZOOM;
  private shakeIntensity = 0;
  private shakeDuration = 0;
  private shakeElapsed = 0;

  constructor(
    private worldContainer: Container,
    private getScreenSize: () => { width: number; height: number },
  ) {}

  /** Set camera target to follow a world-space entity position */
  setTarget(worldX: number, worldY: number, worldZ: number): void {
    const { sx, sy } = worldToScreen(worldX, worldZ, worldY);
    this.targetX = sx;
    this.targetY = sy;
  }

  /** Snap camera to target immediately (no lerp) */
  snapToTarget(): void {
    this.currentX = this.targetX;
    this.currentY = this.targetY;
    this.applyTransform();
  }

  setZoom(zoom: number): void {
    this.targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
  }

  getZoom(): number {
    return this.zoom;
  }

  /** Trigger a screen shake (e.g., on big hit or death) */
  shake(intensity = 4, duration = 0.2): void {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeElapsed = 0;
  }

  /** Called every frame — dt-scaled exponential decay toward target */
  update(dt: number): void {
    const t = 1 - Math.exp(-FOLLOW_SPEED * dt);
    this.currentX += (this.targetX - this.currentX) * t;
    this.currentY += (this.targetY - this.currentY) * t;
    this.zoom += (this.targetZoom - this.zoom) * t;

    // Screen shake
    let shakeX = 0, shakeY = 0;
    if (this.shakeElapsed < this.shakeDuration) {
      this.shakeElapsed += dt;
      const decay = 1 - this.shakeElapsed / this.shakeDuration;
      shakeX = (Math.random() - 0.5) * this.shakeIntensity * decay * 2;
      shakeY = (Math.random() - 0.5) * this.shakeIntensity * decay * 2;
    }

    this.applyTransform(shakeX, shakeY);
  }

  /** Get the current camera center in world-pixel coordinates */
  getPosition(): { x: number; y: number } {
    return { x: this.currentX, y: this.currentY };
  }

  private applyTransform(shakeX = 0, shakeY = 0): void {
    const screen = this.getScreenSize();
    this.worldContainer.scale.set(this.zoom);
    this.worldContainer.x = -this.currentX * this.zoom + screen.width / 2 + shakeX;
    this.worldContainer.y = -this.currentY * this.zoom + screen.height / 2 + shakeY;
  }
}
