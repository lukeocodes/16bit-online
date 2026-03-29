import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint } from "../types";
import { DEPTH_S } from "../types";
import { darken, lighten } from "../palette";
import { STORY_H } from "./WallN";

const CAP_H = Math.round(STORY_H / 8);

const T  = 22;
const H2 = T / 2;
const DX = Math.round(0.2 * T);
const DY = Math.round(0.2 * H2);

type V = { x: number; y: number };

const OA: V = { x:  T,      y:  0      };
const OB: V = { x:  0,      y:  H2     };
const IA: V = { x:  T - DX, y: -DY     };
const IB: V = { x: -DX,     y:  H2-DY  };

const lift = (p: V): V => ({ x: p.x, y: p.y - CAP_H });

export class WallScap implements Model {
  readonly id         = "wall-s-cap";
  readonly name       = "Wall S Cap";
  readonly category   = "construction" as const;
  readonly slot       = "root" as const;
  readonly isAnimated = false;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { iso } = ctx.skeleton;
    const primary  = ctx.palette.primary;
    const TOP_COL  = lighten(primary, 0.25);
    const LIT_COL  = lighten(primary, 0.1);
    const DIM_COL  = darken(primary, 0.2);
    const SIDE_COL = darken(primary, 0.3);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tex = ctx.texture as any ?? null;

    const calls: DrawCall[] = [];

    const quad = (
      depth: number,
      color: number,
      pts: [V, V, V, V],
      detail?: (g: import("pixi.js").Graphics, s: number) => void,
    ) => {
      calls.push({
        depth,
        draw: (g, s) => {
          const flat = pts.flatMap(p => [p.x * s, p.y * s]);
          g.poly(flat);
          if (tex) {
            const xs = pts.map(p => p.x * s);
            const ys = pts.map(p => p.y * s);
            const x0 = Math.min(...xs), x1 = Math.max(...xs);
            const y0 = Math.min(...ys), y1 = Math.max(...ys);
            const { Matrix } = (globalThis as any).PIXI ?? {};
            if (Matrix) {
              const m = new Matrix().scale(x1 - x0, y1 - y0).translate(x0, y0);
              g.fill({ texture: tex, matrix: m });
            } else {
              g.fill(color);
            }
          } else {
            g.fill(color);
          }
          detail?.(g, s);
          g.poly(flat);
          g.stroke({ width: s * 0.4, color: 0x000000, alpha: 0.18 });
        },
      });
    };

    quad(DEPTH_S + 0, TOP_COL, [OA, OB, IB, IA]);
    quad(DEPTH_S + 1, LIT_COL, [IA, IB, lift(IB), lift(IA)]);
    if (iso.x <= 0) {
      quad(DEPTH_S + 2, SIDE_COL, [OA, IA, lift(IA), lift(OA)]);
    }
    if (iso.y >= 0) {
      quad(DEPTH_S + 3, DIM_COL, [OA, OB, lift(OB), lift(OA)]);
    }
    quad(DEPTH_S + 4, TOP_COL, [lift(OA), lift(OB), lift(IB), lift(IA)]);
    if (iso.x >= 0) {
      quad(DEPTH_S + 5, SIDE_COL, [OB, IB, lift(IB), lift(OB)]);
    }

    return calls;
  }

  getAttachmentPoints(_skeleton: Skeleton): Record<string, AttachmentPoint> {
    return {};
  }
}
