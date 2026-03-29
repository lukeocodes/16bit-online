import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint } from "../types";
import { DEPTH_N } from "../types";
import { darken, lighten } from "../palette";
import { STORY_H } from "./WallN";

const T  = 22;
const H2 = T / 2;
const DX = Math.round(0.2 * T);
const DY = Math.round(0.2 * H2);

const WIN_U0 = 0.15, WIN_U1 = 0.85;
const WIN_V0 = 0.20,  WIN_V1 = 0.72;

type V = { x: number; y: number };

const OA: V = { x: -T,      y:  0      };
const OB: V = { x:  0,      y: -H2     };
const IA: V = { x: -T + DX, y:  DY     };
const IB: V = { x:  DX,     y: -H2+DY  };

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

export class WallNwin implements Model {
  readonly id         = "wall-n-win";
  readonly name       = "Wall N Win";
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

    // Fill full face first, then punch the window hole with g.cut() after the fill.
    // This matches PixiJS v8's destination-out compositing model.
    const quadWin = (depth: number, color: number, pts: [V, V, V, V], hole: V[]) => {
      calls.push({
        depth,
        draw: (g, s) => {
          const flat = pts.flatMap(p => [p.x*s, p.y*s]);
          const holeFlat = hole.flatMap(p => [p.x*s, p.y*s]);
          // 1. Fill solid face
          g.poly(flat);
          if (tex) {
            const xs = pts.map(p => p.x*s), ys = pts.map(p => p.y*s);
            const x0 = Math.min(...xs), x1 = Math.max(...xs);
            const y0 = Math.min(...ys), y1 = Math.max(...ys);
            const { Matrix } = (globalThis as any).PIXI ?? {};
            if (Matrix) { g.fill({ texture: tex, matrix: new Matrix().scale(x1-x0, y1-y0).translate(x0, y0) }); }
            else { g.fill(color); }
          } else { g.fill(color); }
          // 2. Cut window opening from the filled face
          g.poly(holeFlat); g.cut();
          // 3. Outlines
          g.poly(flat); g.stroke({ width: s*0.4, color: 0x000000, alpha: 0.18 });
          g.poly(holeFlat); g.stroke({ width: s*0.4, color: 0x000000, alpha: 0.28 });
        },
      });
    };

    quad(DEPTH_N + 0, TOP_COL, [OA, OB, IB, IA]);
    if (iso.y >= 0) {
      quadWin(DEPTH_N + 1, LIT_COL, [OA, OB, lift(OB), lift(OA)], outerHole);
    }
    if (iso.x >= 0) { quad(DEPTH_N + 2, SIDE_COL, [OB, IB, lift(IB), lift(OB)]); }
    quad(DEPTH_N + 3, TOP_COL, [lift(OA), lift(OB), lift(IB), lift(IA)]);
    if (iso.x <= 0) { quad(DEPTH_N + 4, SIDE_COL, [OA, IA, lift(IA), lift(OA)]); }
    quadWin(DEPTH_N + 5, DIM_COL, [IA, IB, lift(IB), lift(IA)], innerHole);

    // Window reveals — isometric depth order: head (far/top) first, sill (near/bottom) last
    quad(DEPTH_N + 6, HEAD_COL, [
      outerUV(WIN_U0, WIN_V1), outerUV(WIN_U1, WIN_V1),
      innerUV(WIN_U1, WIN_V1), innerUV(WIN_U0, WIN_V1),
    ]);
    quad(DEPTH_N + 7, JAM_COL, [
      outerUV(WIN_U0, WIN_V0), outerUV(WIN_U0, WIN_V1),
      innerUV(WIN_U0, WIN_V1), innerUV(WIN_U0, WIN_V0),
    ]);
    quad(DEPTH_N + 8, JAM_COL, [
      outerUV(WIN_U1, WIN_V0), outerUV(WIN_U1, WIN_V1),
      innerUV(WIN_U1, WIN_V1), innerUV(WIN_U1, WIN_V0),
    ]);
    quad(DEPTH_N + 9, SILL_COL, [
      outerUV(WIN_U0, WIN_V0), outerUV(WIN_U1, WIN_V0),
      innerUV(WIN_U1, WIN_V0), innerUV(WIN_U0, WIN_V0),
    ]);

    return calls;
  }

  getAttachmentPoints(_skeleton: Skeleton): Record<string, AttachmentPoint> { return {}; }
}
