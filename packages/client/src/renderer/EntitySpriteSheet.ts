import { Container, Graphics, RenderTexture, Sprite, Texture } from "pixi.js";
import type { Application } from "pixi.js";
import { DIRECTION_COUNT, directionToIsoOffset } from "./SpriteDirection";

/**
 * Generates sprite sheet textures for entity types by rendering Graphics
 * into RenderTextures for each of 8 directions.
 *
 * When real art assets are available, replace generate*() with atlas loading.
 * The consumer API (getFrame) stays the same.
 */

const FRAME_W = 40;
const FRAME_H = 72;

interface EntityFrames {
  /** textures[direction] — one texture per facing direction (0-7) */
  textures: Texture[];
}

export class EntitySpriteSheet {
  private cache = new Map<string, EntityFrames>();
  private app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  /** Get the texture for a given entity type + direction. Generates on first access. */
  getFrame(entityType: string, direction: number): Texture {
    let frames = this.cache.get(entityType);
    if (!frames) {
      frames = this.generateFrames(entityType);
      this.cache.set(entityType, frames);
    }
    return frames.textures[direction % DIRECTION_COUNT];
  }

  /** Check if frames exist for a type */
  has(entityType: string): boolean {
    return this.cache.has(entityType);
  }

  private generateFrames(entityType: string): EntityFrames {
    const textures: Texture[] = [];

    for (let dir = 0; dir < DIRECTION_COUNT; dir++) {
      const container = new Container();
      const iso = directionToIsoOffset(dir);

      // Draw the entity based on type
      switch (entityType) {
        case "rabbit": this.drawRabbit(container, iso); break;
        case "skeleton": this.drawSkeleton(container, iso); break;
        case "goblin": this.drawGoblin(container, iso); break;
        case "imp": this.drawImp(container, iso); break;
        default: this.drawHumanoid(container, iso, 0x4488cc, 0xeeccaa); break;
      }

      // Render to texture
      const rt = RenderTexture.create({ width: FRAME_W, height: FRAME_H });
      // Center the entity in the frame
      container.position.set(FRAME_W / 2, FRAME_H - 4);
      this.app.renderer.render({ container, target: rt });
      container.destroy({ children: true });

      textures.push(rt);
    }

    return { textures };
  }

  private drawHumanoid(c: Container, iso: { x: number; y: number }, bodyColor = 0x4488cc, skinColor = 0xeeccaa): void {
    // Shadow
    const shadow = new Graphics();
    shadow.ellipse(0, 2, 14, 7);
    shadow.fill({ color: 0x000000, alpha: 0.25 });
    c.addChild(shadow);

    // Body — slight lean based on direction
    const body = new Graphics();
    body.roundRect(-10 + iso.x * 2, -32, 20, 32, 4);
    body.fill(bodyColor);
    body.stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    c.addChild(body);

    // Head — offset based on direction
    const head = new Graphics();
    head.circle(iso.x * 3, -38 + iso.y * 2, 8);
    head.fill(skinColor);
    head.stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    c.addChild(head);

    // Eyes
    const eyes = new Graphics();
    const ox = iso.x * 4;
    const oy = iso.y * 4;
    eyes.circle(ox - iso.y * 3, -38 + iso.y * 2 + oy + iso.x * 2, 2);
    eyes.circle(ox + iso.y * 3, -38 + iso.y * 2 + oy - iso.x * 2, 2);
    eyes.fill(0x222222);
    c.addChild(eyes);
  }

  private drawRabbit(c: Container, iso: { x: number; y: number }): void {
    const shadow = new Graphics();
    shadow.ellipse(0, 2, 10, 5);
    shadow.fill({ color: 0x000000, alpha: 0.25 });
    c.addChild(shadow);

    // Body
    const body = new Graphics();
    body.ellipse(iso.x * 2, -10, 10, 12);
    body.fill(0xc0a080);
    body.stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    c.addChild(body);

    // Head
    const head = new Graphics();
    head.circle(iso.x * 3, -24, 7);
    head.fill(0xc0a080);
    head.stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    c.addChild(head);

    // Ears — direction-aware
    const ears = new Graphics();
    const earBase = -24;
    ears.ellipse(-4 + iso.x * 2, earBase - 12 + iso.y * 3, 2.5, 8);
    ears.ellipse(4 + iso.x * 2, earBase - 12 + iso.y * 3, 2.5, 8);
    ears.fill(0xc0a080);
    ears.ellipse(-4 + iso.x * 2, earBase - 12 + iso.y * 3, 1.5, 5);
    ears.ellipse(4 + iso.x * 2, earBase - 12 + iso.y * 3, 1.5, 5);
    ears.fill(0xddaaaa);
    c.addChild(ears);

    // Eyes
    const eyes = new Graphics();
    eyes.circle(iso.x * 4 - iso.y * 2.5, -24 + iso.y * 3, 1.5);
    eyes.circle(iso.x * 4 + iso.y * 2.5, -24 + iso.y * 3, 1.5);
    eyes.fill(0x222222);
    c.addChild(eyes);
  }

  private drawSkeleton(c: Container, iso: { x: number; y: number }): void {
    const shadow = new Graphics();
    shadow.ellipse(0, 2, 12, 6);
    shadow.fill({ color: 0x000000, alpha: 0.25 });
    c.addChild(shadow);

    // Thin body with ribs
    const body = new Graphics();
    body.roundRect(-6 + iso.x * 2, -32, 12, 32, 2);
    body.fill(0xd0c8b8);
    body.stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    body.moveTo(-5 + iso.x * 2, -24); body.lineTo(5 + iso.x * 2, -24);
    body.moveTo(-5 + iso.x * 2, -18); body.lineTo(5 + iso.x * 2, -18);
    body.moveTo(-5 + iso.x * 2, -12); body.lineTo(5 + iso.x * 2, -12);
    body.stroke({ width: 1, color: 0x444444, alpha: 0.5 });
    c.addChild(body);

    // Skull
    const head = new Graphics();
    head.roundRect(-7 + iso.x * 3, -44 + iso.y * 2, 14, 14, 3);
    head.fill(0xe8e0d0);
    head.stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    c.addChild(head);

    // Eye sockets
    const eyes = new Graphics();
    eyes.circle(-3 + iso.x * 4, -38 + iso.y * 3, 2);
    eyes.circle(3 + iso.x * 4, -38 + iso.y * 3, 2);
    eyes.fill(0x333333);
    c.addChild(eyes);
  }

  private drawGoblin(c: Container, iso: { x: number; y: number }): void {
    const shadow = new Graphics();
    shadow.ellipse(0, 2, 12, 6);
    shadow.fill({ color: 0x000000, alpha: 0.25 });
    c.addChild(shadow);

    // Wide body
    const body = new Graphics();
    body.roundRect(-12 + iso.x * 2, -22, 24, 22, 5);
    body.fill(0x6a5a3a);
    body.stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    c.addChild(body);

    // Head
    const head = new Graphics();
    head.circle(iso.x * 3, -30 + iso.y * 2, 8);
    head.fill(0x7aaa5a);
    head.stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    c.addChild(head);

    // Pointed ears
    const ears = new Graphics();
    ears.poly([{ x: -8 + iso.x * 3, y: -32 }, { x: -15, y: -38 }, { x: -7 + iso.x * 3, y: -28 }]);
    ears.poly([{ x: 8 + iso.x * 3, y: -32 }, { x: 15, y: -38 }, { x: 7 + iso.x * 3, y: -28 }]);
    ears.fill(0x7aaa5a);
    c.addChild(ears);

    // Eyes
    const eyes = new Graphics();
    eyes.circle(-3 + iso.x * 4, -30 + iso.y * 3, 2);
    eyes.circle(3 + iso.x * 4, -30 + iso.y * 3, 2);
    eyes.fill(0xee4444);
    c.addChild(eyes);
  }

  private drawImp(c: Container, iso: { x: number; y: number }): void {
    const shadow = new Graphics();
    shadow.ellipse(0, 2, 10, 5);
    shadow.fill({ color: 0x000000, alpha: 0.25 });
    c.addChild(shadow);

    // Wings (behind body)
    const wings = new Graphics();
    wings.poly([{ x: -7, y: -18 }, { x: -18 - iso.x * 3, y: -24 }, { x: -8, y: -10 }]);
    wings.poly([{ x: 7, y: -18 }, { x: 18 - iso.x * 3, y: -24 }, { x: 8, y: -10 }]);
    wings.fill({ color: 0x883333, alpha: 0.6 });
    c.addChild(wings);

    // Small body
    const body = new Graphics();
    body.roundRect(-7 + iso.x * 2, -20, 14, 20, 3);
    body.fill(0x883333);
    body.stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    c.addChild(body);

    // Head
    const head = new Graphics();
    head.circle(iso.x * 3, -26 + iso.y * 2, 6);
    head.fill(0x883333);
    head.stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    c.addChild(head);

    // Horns
    const horns = new Graphics();
    horns.poly([{ x: -4 + iso.x * 3, y: -32 }, { x: -2, y: -38 }, { x: iso.x * 3, y: -32 }]);
    horns.poly([{ x: 4 + iso.x * 3, y: -32 }, { x: 2, y: -38 }, { x: iso.x * 3, y: -32 }]);
    horns.fill(0x332222);
    c.addChild(horns);

    // Eyes (glowing)
    const eyes = new Graphics();
    eyes.circle(-2 + iso.x * 4, -26 + iso.y * 3, 1.5);
    eyes.circle(2 + iso.x * 4, -26 + iso.y * 3, 1.5);
    eyes.fill(0xffaa00);
    c.addChild(eyes);
  }

  dispose(): void {
    for (const frames of this.cache.values()) {
      for (const tex of frames.textures) {
        tex.destroy(true);
      }
    }
    this.cache.clear();
  }
}

/** Map NPC name to sprite sheet type key */
export function entityNameToSpriteType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("rabbit")) return "rabbit";
  if (lower.includes("skeleton")) return "skeleton";
  if (lower.includes("goblin")) return "goblin";
  if (lower.includes("imp")) return "imp";
  return "humanoid";
}
