import type { Graphics } from "pixi.js";
import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint } from "../types";
import { darken, lighten } from "../palette";

export class ShieldKite implements Model {
  readonly id = "shield-kite";
  readonly name = "Kite Shield";
  readonly category = "offhand" as const;
  readonly slot = "hand-L" as const;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { skeleton, facingCamera } = ctx;
    const side = ctx.farSide;
    const wrist = skeleton.joints[`wrist${side}`];
    const iso = skeleton.iso;
    const wf = skeleton.wf;
    const secondary = ctx.palette.secondary;

    return [
      {
        depth: facingCamera ? 18 : 48,
        draw: (g: Graphics, s: number) => {
          const ox = iso.x * 4;
          const oy = iso.y * 2;
          const cx = wrist.x + ox;
          const cy = wrist.y - 4 + oy;
          const sw = 7 * wf;
          const sh = 9;

          // Shield body (kite shape)
          g.moveTo(cx * s, (cy - sh) * s);
          g.quadraticCurveTo(
            (cx + sw) * s,
            (cy - sh * 0.3) * s,
            (cx + sw * 0.8) * s,
            cy * s
          );
          g.quadraticCurveTo(
            (cx + sw * 0.3) * s,
            (cy + sh * 0.6) * s,
            cx * s,
            (cy + sh) * s
          );
          g.quadraticCurveTo(
            (cx - sw * 0.3) * s,
            (cy + sh * 0.6) * s,
            (cx - sw * 0.8) * s,
            cy * s
          );
          g.quadraticCurveTo(
            (cx - sw) * s,
            (cy - sh * 0.3) * s,
            cx * s,
            (cy - sh) * s
          );
          g.closePath();
          g.fill(secondary);

          // Outline
          g.moveTo(cx * s, (cy - sh) * s);
          g.quadraticCurveTo(
            (cx + sw) * s,
            (cy - sh * 0.3) * s,
            (cx + sw * 0.8) * s,
            cy * s
          );
          g.quadraticCurveTo(
            (cx + sw * 0.3) * s,
            (cy + sh * 0.6) * s,
            cx * s,
            (cy + sh) * s
          );
          g.quadraticCurveTo(
            (cx - sw * 0.3) * s,
            (cy + sh * 0.6) * s,
            (cx - sw * 0.8) * s,
            cy * s
          );
          g.quadraticCurveTo(
            (cx - sw) * s,
            (cy - sh * 0.3) * s,
            cx * s,
            (cy - sh) * s
          );
          g.closePath();
          g.stroke({ width: s * 0.8, color: darken(secondary, 0.45) });

          // Rim highlight
          g.moveTo(cx * s, (cy - sh + 0.5) * s);
          g.quadraticCurveTo(
            (cx - sw + 0.5) * s,
            (cy - sh * 0.3) * s,
            (cx - sw * 0.8 + 0.5) * s,
            cy * s
          );
          g.stroke({
            width: s * 0.5,
            color: lighten(secondary, 0.2),
            alpha: 0.5,
          });

          // Boss
          g.circle(cx * s, (cy - 1) * s, 2.5 * s);
          g.fill(0xccaa44);
          g.circle(cx * s, (cy - 1) * s, 2.5 * s);
          g.stroke({ width: s * 0.5, color: 0x886622 });

          // Decorative cross
          g.moveTo(cx * s, (cy - sh * 0.6) * s);
          g.lineTo(cx * s, (cy + sh * 0.4) * s);
          g.moveTo((cx - sw * 0.5) * s, (cy - 1) * s);
          g.lineTo((cx + sw * 0.5) * s, (cy - 1) * s);
          g.stroke({
            width: s * 0.7,
            color: darken(secondary, 0.2),
            alpha: 0.4,
          });
        },
      },
    ];
  }

  getAttachmentPoints(): Record<string, AttachmentPoint> {
    return {};
  }
}
