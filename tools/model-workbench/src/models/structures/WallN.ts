import type { Model, RenderContext, DrawCall, Skeleton, AttachmentPoint } from "../types";

/**
 * WALL_N — north wall panel. Six faces derived from CLAUDE.isometric.md.
 *
 * Tile unit T = hw = 22, H2 = T/2 = 11.
 * Depth D = 0.2 tile-units (+X direction): DX = 4, DY = 2 (2:1 iso ratio).
 * Story height = 3T = 66.
 *
 * Lighting (light from above-right):
 *   top / ground cap : base × 1.00
 *   outer / inner    : base × 0.80
 *   left / right edge: base × 0.65
 *
 * Face culling via iso direction so only camera-visible faces are drawn:
 *   outer face  — iso.y >= 0  (camera south of wall, outside)
 *   inner face  — iso.y <= 0  (camera north of wall, inside)
 *   right edge  — iso.x >= 0  (camera east/right)
 *   left edge   — iso.x <= 0  (camera west/left)
 *   top cap     — always
 *   ground cap  — always
 */

const T  = 22;
const H2 = T / 2;           // 11
const DX = Math.round(0.2 * T);   // 4
const DY = Math.round(0.2 * H2);  // 2

export const STORY_H = 3 * T;     // 66

const BASE  = 0xc4b8aa;
const TOP   = BASE;
const FACE  = 0x9c9088;           // BASE × 0.80
const SIDE  = 0x7d7470;           // BASE × 0.65
const TRIM  = 0x3a3028;

type V = { x: number; y: number };

// Outer corners (ground level)
const OA: V = { x: -T,      y:  0      };  // outer west
const OB: V = { x:  0,      y: -H2     };  // outer north

// Inner corners (shifted +DX, +DY into room)
const IA: V = { x: -T + DX, y:  DY     };  // inner west
const IB: V = { x:  DX,     y: -H2+DY  };  // inner north

const lift = (p: V): V => ({ x: p.x, y: p.y - STORY_H });

export class WallN implements Model {
  readonly id         = "wall-n";
  readonly name       = "Wall N";
  readonly category   = "construction" as const;
  readonly slot       = "root" as const;
  readonly isAnimated = false;

  getDrawCalls(ctx: RenderContext): DrawCall[] {
    const { iso } = ctx.skeleton;
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
          g.fill(color);
          detail?.(g, s);
          g.poly(flat);
          g.stroke({ width: s * 0.5, color: TRIM, alpha: 0.5 });
        },
      });
    };

    // ── 1. Ground cap — buried at floor level, OCD-complete but never visible ───
    quad(1, TOP, [OA, OB, IB, IA]);

    // ── 2. Outer face — main wall surface, visible from outside (iso.y ≥ 0) ───
    if (iso.y >= 0) {
      quad(41, FACE, [OA, OB, lift(OB), lift(OA)], (g, s) => {
        for (let i = 1; i < 6; i++) {
          const t = i / 6;
          g.moveTo(OA.x * s, (OA.y - STORY_H * t) * s);
          g.lineTo(OB.x * s, (OB.y - STORY_H * t) * s);
          g.stroke({ width: s * 0.35, color: TRIM, alpha: 0.25 });
        }
      });
    }

    // ── 3. Right edge — north corner depth strip, visible from east (iso.x ≥ 0) ─
    if (iso.x >= 0) {
      quad(42, SIDE, [OB, IB, lift(IB), lift(OB)]);
    }

    // ── 4. Top cap — wall top, always visible ─────────────────────────────────
    quad(43, TOP, [lift(OA), lift(OB), lift(IB), lift(IA)]);

    // ── 5. Left edge — topmost layer, visible from west (iso.x ≤ 0) ─────────
    if (iso.x <= 0) {
      quad(50, SIDE, [OA, IA, lift(IA), lift(OA)]);
    }

    // ── 6. Inner face — topmost layer, always present ────────────────────────
    quad(60, FACE, [IA, IB, lift(IB), lift(IA)]);

    return calls;
  }

  getAttachmentPoints(_skeleton: Skeleton): Record<string, AttachmentPoint> {
    return {};
  }
}
