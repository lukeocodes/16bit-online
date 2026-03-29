import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint } from "../types";
import { DEPTH_W } from "../types";
import { darken, lighten } from "../palette";
import { STORY_H } from "./WallN";

const T  = 22;
const H2 = T / 2;
const DX = Math.round(0.2 * T);
const DY = Math.round(0.2 * H2);

const WIN_U0 = 0.15, WIN_U1 = 0.85;
const WIN_V0 = 0.20,  WIN_V1 = 0.72;

type V = { x: number; y: number };

const OA: V = { x:  0,      y:  H2     };
const OB: V = { x: -T,      y:  0      };
const IA: V = { x: -DX,     y:  H2+DY  };
const IB: V = { x: -T-DX,   y:  DY     };

const lift = (p: V): V => ({ x: p.x, y: p.y - STORY_H });

function outerUV(u: number, v: number): V {
  return { x: OA.x + u*(OB.x-OA.x), y: OA.y + u*(OB.y-OA.y) - v*STORY_H };
}
function innerUV(u: number, v: number): V {
  return { x: IA.x + u*(IB.x-IA.x), y: IA.y + u*(IB.y-IA.y) - v*STORY_H };
}

const outerHole = [
  outerUV(WIN_U0, WIN_V0), outerUV(WIN_U1, WIN_V0),
  outerUV(WIN_U1, WIN_V1), outerUV(WIN_U0, WIN_V1),
];
const innerHole = [
  innerUV(WIN_U0, WIN_V0), innerUV(WIN_U1, WIN_V0),
  innerUV(WIN_U1, WIN_V1), innerUV(WIN_U0, WIN_V1),
];

export class WallWwin implements Model {
  readonly id         = "wall-w-win";
  readonly name       = "Wall W Win";
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
    const SILL_COL = lighten(primary, 0.15);
    const HEAD_COL = darken(primary, 0.1);
    const JAM_COL  = primary;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tex = ctx.texture as any ?? null;
    const calls: DrawCall[] = [];

    const quad = (depth: number, color: number, pts: [V, V, V, V]) => {
      calls.push({
        depth,
        draw: (g, s) => {
          const flat = pts.flatMap(p => [p.x*s, p.y*s]);
          g.poly(flat);
          if (tex) {
            const xs = pts.map(p => p.x*s), ys = pts.map(p => p.y*s);
            const x0 = Math.min(...xs), x1 = Math.max(...xs);
            const y0 = Math.min(...ys), y1 = Math.max(...ys);
            const { Matrix } = (globalThis as any).PIXI ?? {};
            if (Matrix) { g.fill({ texture: tex, matrix: new Matrix().scale(x1-x0, y1-y0).translate(x0, y0) }); }
            else { g.fill(color); }
          } else { g.fill(color); }
          g.poly(flat); g.stroke({ width: s*0.4, color: 0x000000, alpha: 0.18 });
        },
      });
    };

    const quadWin = (depth: number, color: number, pts: [V, V, V, V], hole: V[]) => {
      calls.push({
        depth,
        draw: (g, s) => {
          const flat = pts.flatMap(p => [p.x*s, p.y*s]);
          const holeFlat = hole.flatMap(p => [p.x*s, p.y*s]);
          g.poly(flat);
          if (tex) {
            const xs = pts.map(p => p.x*s), ys = pts.map(p => p.y*s);
            const x0 = Math.min(...xs), x1 = Math.max(...xs);
            const y0 = Math.min(...ys), y1 = Math.max(...ys);
            const { Matrix } = (globalThis as any).PIXI ?? {};
            if (Matrix) { g.fill({ texture: tex, matrix: new Matrix().scale(x1-x0, y1-y0).translate(x0, y0) }); }
            else { g.fill(color); }
          } else { g.fill(color); }
          g.poly(holeFlat); g.cut();
          g.poly(flat); g.stroke({ width: s*0.4, color: 0x000000, alpha: 0.18 });
          g.poly(holeFlat); g.stroke({ width: s*0.4, color: 0x000000, alpha: 0.28 });
        },
      });
    };

    quad(DEPTH_W + 0, TOP_COL, [OA, OB, IB, IA]);
    if (iso.y >= 0) { quadWin(DEPTH_W + 1, LIT_COL, [OA, OB, lift(OB), lift(OA)], outerHole); }
    if (iso.x >= 0) { quad(DEPTH_W + 2, SIDE_COL, [OA, IA, lift(IA), lift(OA)]); }
    if (iso.x <= 0) { quad(DEPTH_W + 3, SIDE_COL, [OB, IB, lift(IB), lift(OB)]); }
    quadWin(DEPTH_W + 4, DIM_COL, [IA, IB, lift(IB), lift(IA)], innerHole);
    quad(DEPTH_W + 5, TOP_COL, [lift(OA), lift(OB), lift(IB), lift(IA)]);

    // Window reveals — drawn before the outer face so the outer face renders over them in solid areas
    quad(DEPTH_W + 0, HEAD_COL, [
      outerUV(WIN_U0, WIN_V1), outerUV(WIN_U1, WIN_V1),
      innerUV(WIN_U1, WIN_V1), innerUV(WIN_U0, WIN_V1),
    ]);
    quad(DEPTH_W + 0, JAM_COL, [
      outerUV(WIN_U0, WIN_V0), outerUV(WIN_U0, WIN_V1),
      innerUV(WIN_U0, WIN_V1), innerUV(WIN_U0, WIN_V0),
    ]);
    quad(DEPTH_W + 0, JAM_COL, [
      outerUV(WIN_U1, WIN_V0), outerUV(WIN_U1, WIN_V1),
      innerUV(WIN_U1, WIN_V1), innerUV(WIN_U1, WIN_V0),
    ]);
    quad(DEPTH_W + 0, SILL_COL, [
      outerUV(WIN_U0, WIN_V0), outerUV(WIN_U1, WIN_V0),
      innerUV(WIN_U1, WIN_V0), innerUV(WIN_U0, WIN_V0),
    ]);

    return calls;
  }

  getAttachmentPoints(_skeleton: Skeleton): Record<string, AttachmentPoint> { return {}; }
}
