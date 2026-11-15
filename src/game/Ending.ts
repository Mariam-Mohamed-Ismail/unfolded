import type * as Phaser from 'phaser'
import { mixColor } from './geom.ts'
import type { Point } from './geom.ts'
import type { LevelData } from './levels/types.ts'
import {
  COLOR_INK,
  COLOR_L3_BG,
  COLOR_PAPER,
  COLOR_PLAYER,
  COLOR_PLAYER_LINE,
  END_BOB_HZ,
  END_BOB_PX,
  END_CREASE_ALPHA,
  END_DRIFT_END_S,
  END_DRIFT_PX,
  END_DRIFT_SPIN,
  END_FREEZE_S,
  END_PULL_END_S,
  END_SEAM_S,
  END_SHEET_FRAC,
  END_SKIP_AFTER_S,
  END_TILE_PX,
  END_TITLE_IN_S,
  END_TOTAL_S,
  END_UNFOLD_EACH_S,
  FOLD_OUTLINE,
  PLAYER_OUTLINE,
} from './constants.ts'

export type EndTri = [Point, Point, Point]

/** The spec's beats, in order. */
export type EndPhase = 'freeze' | 'drift' | 'unfold' | 'sheet' | 'pull' | 'title' | 'done'

/** One fold line on the sheet, in unit coordinates: 0..1 across and down. */
export type Fold = [number, number, number, number]

type Piece = {
  /** The triangle relative to its own centre, as it stood. */
  local: EndTri
  /** Its centre on screen when the ending began. */
  from: Point
  /** Which way it drifts, unit length. */
  dir: Point
  /** Radians per second, signed. */
  spin: number
  /** The centre of the tile it becomes. */
  tile: Point
}

const TAU = Math.PI * 2
const smooth = (u: number): number => {
  const k = Math.max(0, Math.min(1, u))
  return k * k * (3 - 2 * k)
}
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k
/** The same angle, brought into -PI..PI so it unwinds the short way round. */
const wrap = (a: number): number => {
  let r = a % TAU
  if (r > Math.PI) r -= TAU
  if (r < -Math.PI) r += TAU
  return r
}

/**
 * The ending: the figure comes apart, unfolds into its true shape - one
 * blank square of paper - and the camera pulls back to show the whole game
 * creased into that sheet.
 *
 * Everything here is in screen space and driven by one dt-accumulated clock,
 * like every other timer in the game. It knows nothing about scenes: it is
 * handed the figure's nine triangles and the level data, asks for a chime as
 * each tile lands, and says when it is done. Which is what lets it run, and
 * be checked, without a canvas.
 */
export class Ending {
  private t = 0
  private skipped = false
  private landed = 0
  private pieces: Piece[]
  /** Where the figure stood, and so where the small sheet forms. */
  private centre: Point
  private view: { w: number; h: number }
  private folds: Fold[]
  private chime: (step: number) => void

  constructor(
    tris: EndTri[],
    levels: readonly LevelData[],
    view: { w: number; h: number },
    chime: (step: number) => void,
  ) {
    this.view = view
    this.chime = chime
    this.folds = foldsOf(levels)

    const centres = tris.map(centroid)
    const n = Math.max(1, centres.length)
    this.centre = [
      centres.reduce((s, c) => s + c[0], 0) / n,
      centres.reduce((s, c) => s + c[1], 0) / n,
    ]

    // The figure's pieces come head first, so laying them into the grid in
    // order puts the head in the top row and the legs in the bottom one:
    // the sheet is the figure, opened out.
    this.pieces = tris.map((tri, i) => {
      const c = centres[i]
      let dx = c[0] - this.centre[0]
      let dy = c[1] - this.centre[1]
      const len = Math.hypot(dx, dy)
      if (len < 0.001) {
        // Dead centre: pick a direction from the index instead.
        const a = (i / n) * TAU
        dx = Math.cos(a)
        dy = Math.sin(a)
      } else {
        dx /= len
        dy /= len
      }
      const row = Math.floor(i / 3)
      const col = i % 3
      return {
        local: tri.map((p): Point => [p[0] - c[0], p[1] - c[1]]) as EndTri,
        from: c,
        dir: [dx, dy],
        // Alternating, and not all at one speed, so the cloud turns rather
        // than rotating as a block.
        spin: (i % 2 === 0 ? 1 : -1) * END_DRIFT_SPIN * (0.6 + 0.1 * ((i * 7) % 5)),
        tile: [
          this.centre[0] + (col - 1) * END_TILE_PX,
          this.centre[1] + (row - 1) * END_TILE_PX,
        ],
      }
    })
  }

  /** One step. Enter skips, but only once the sequence has had its moment. */
  update(dt: number, skip: boolean): void {
    if (this.done()) return
    if (skip && this.t >= END_SKIP_AFTER_S) {
      this.skipped = true
      return
    }
    this.t += dt
    // A chime for every tile that has landed by now, in order. A loop, not
    // an if, so a long frame cannot swallow one.
    while (this.landed < this.pieces.length && this.t >= this.landAt(this.landed)) {
      this.chime(this.landed)
      this.landed++
    }
  }

  done(): boolean {
    return this.skipped || this.t >= END_TOTAL_S
  }

  wasSkipped(): boolean {
    return this.skipped
  }

  time(): number {
    return this.t
  }

  /** How many tiles have landed. */
  tiles(): number {
    return this.landed
  }

  phase(): EndPhase {
    const t = this.t
    if (this.done()) return 'done'
    if (t < END_FREEZE_S) return 'freeze'
    if (t < END_DRIFT_END_S) return 'drift'
    if (t < this.unfoldEnd()) return 'unfold'
    if (t < this.unfoldEnd() + END_SEAM_S) return 'sheet'
    if (t < END_PULL_END_S) return 'pull'
    return 'title'
  }

  /** The title's opacity, 0 until the pull-back is over. */
  titleAlpha(): number {
    return smooth((this.t - END_PULL_END_S) / END_TITLE_IN_S)
  }

  /** The level data's crease pattern, in unit sheet coordinates. */
  creases(): readonly Fold[] {
    return this.folds
  }

  /** When tile `i` lands. */
  landAt(i: number): number {
    return END_DRIFT_END_S + (i + 1) * END_UNFOLD_EACH_S
  }

  /** Every piece as drawn right now: a quad, on screen. */
  shapes(): Point[][] {
    return this.pieces.map((p, i) => this.shape(p, i))
  }

  /** The sheet once it is one square: where it is and how big. */
  sheet(): { x: number; y: number; side: number } {
    const k = this.pull()
    const small = END_TILE_PX * 3
    const big = this.view.h * END_SHEET_FRAC
    const side = lerp(small, big, k)
    const cx = lerp(this.centre[0], this.view.w / 2, k)
    const cy = lerp(this.centre[1], this.view.h / 2, k)
    return { x: cx - side / 2, y: cy - side / 2, side }
  }

  draw(g: Phaser.GameObjects.Graphics): void {
    if (this.done()) return
    const unfolded = this.t >= this.unfoldEnd()

    if (!unfolded) {
      this.drawPieces(g)
      return
    }

    // The world goes as the camera backs away, and the sheet is all there is.
    const k = this.pull()
    if (k > 0) {
      g.fillStyle(COLOR_L3_BG, k)
      g.fillRect(0, 0, this.view.w, this.view.h)
    }

    const s = this.sheet()
    g.fillStyle(COLOR_PAPER, 1)
    g.fillRect(s.x, s.y, s.side, s.side)

    // The seams between the nine tiles, fading out: nine pieces becoming
    // one sheet.
    const seam = 1 - smooth((this.t - this.unfoldEnd()) / END_SEAM_S)
    if (seam > 0) {
      g.lineStyle(FOLD_OUTLINE, COLOR_INK, seam * 0.6)
      for (let i = 1; i < 3; i++) {
        const x = s.x + (s.side * i) / 3
        const y = s.y + (s.side * i) / 3
        g.lineBetween(x, s.y, x, s.y + s.side)
        g.lineBetween(s.x, y, s.x + s.side, y)
      }
    }

    // The creases, drawing themselves in over the second half of the pull:
    // each one grows from its start, one after another.
    const reveal = smooth((k - 0.35) / 0.65) * this.folds.length
    if (reveal > 0) {
      g.lineStyle(1, COLOR_INK, END_CREASE_ALPHA)
      for (let i = 0; i < this.folds.length; i++) {
        const part = Math.max(0, Math.min(1, reveal - i))
        if (part <= 0) break
        const [x1, y1, x2, y2] = this.folds[i]
        const ax = s.x + x1 * s.side
        const ay = s.y + y1 * s.side
        const bx = s.x + lerp(x1, x2, part) * s.side
        const by = s.y + lerp(y1, y2, part) * s.side
        g.lineBetween(ax, ay, bx, by)
      }
    }

    g.lineStyle(FOLD_OUTLINE, COLOR_INK, 1)
    g.strokeRect(s.x, s.y, s.side, s.side)
  }

  // --- internals ---

  private unfoldEnd(): number {
    return END_DRIFT_END_S + this.pieces.length * END_UNFOLD_EACH_S
  }

  private pull(): number {
    const start = this.unfoldEnd() + END_SEAM_S
    return smooth((this.t - start) / (END_PULL_END_S - start))
  }

  /** Where a piece floats, before its turn to unfold. */
  private float(p: Piece, t: number): { at: Point; rot: number } {
    if (t < END_FREEZE_S) return { at: p.from, rot: 0 }
    const u = smooth((t - END_FREEZE_S) / (END_DRIFT_END_S - END_FREEZE_S))
    const bob = Math.sin((t - END_FREEZE_S) * END_BOB_HZ * TAU + p.spin) * END_BOB_PX * u
    return {
      at: [p.from[0] + p.dir[0] * END_DRIFT_PX * u, p.from[1] + p.dir[1] * END_DRIFT_PX * u + bob],
      rot: p.spin * (t - END_FREEZE_S),
    }
  }

  /**
   * One piece now: a triangle (as a quad with its last corner doubled)
   * opening into a square tile as it flies home. The corners slide from
   * triangle to square while the turn unwinds, which is the unfold.
   */
  private shape(p: Piece, i: number): Point[] {
    const start = this.landAt(i) - END_UNFOLD_EACH_S
    const v = smooth((this.t - start) / END_UNFOLD_EACH_S)
    const here = this.float(p, Math.min(this.t, start))
    const at: Point = [lerp(here.at[0], p.tile[0], v), lerp(here.at[1], p.tile[1], v)]
    const rot = lerp(wrap(here.rot), 0, v)
    const h = END_TILE_PX / 2
    const square: Point[] = [[-h, -h], [h, -h], [h, h], [-h, h]]
    const tri: Point[] = [p.local[0], p.local[1], p.local[2], p.local[2]]
    const c = Math.cos(rot)
    const s = Math.sin(rot)
    return tri.map((q, k) => {
      const x = lerp(q[0], square[k][0], v)
      const y = lerp(q[1], square[k][1], v)
      return [at[0] + x * c - y * s, at[1] + x * s + y * c] as Point
    })
  }

  private drawPieces(g: Phaser.GameObjects.Graphics): void {
    for (let i = 0; i < this.pieces.length; i++) {
      const start = this.landAt(i) - END_UNFOLD_EACH_S
      const v = smooth((this.t - start) / END_UNFOLD_EACH_S)
      // Green figure to blank paper as each one opens.
      g.fillStyle(mixColor(COLOR_PLAYER, COLOR_PAPER, v), 1)
      g.lineStyle(PLAYER_OUTLINE, mixColor(COLOR_PLAYER_LINE, COLOR_INK, v), 1)
      const pts = this.shape(this.pieces[i], i).map(([x, y]) => ({ x, y }))
      g.fillPoints(pts, true)
      g.strokePoints(pts, true)
    }
  }
}

function centroid(t: EndTri): Point {
  return [(t[0][0] + t[1][0] + t[2][0]) / 3, (t[0][1] + t[1][1] + t[2][1]) / 3]
}

/**
 * The three levels as creases on one sheet: a band each, top to bottom, cut
 * apart by a fold. Inside a band every room boundary is an upright fold and
 * every solid's top surface a level one, scaled from that level's own data -
 * so the pattern on the sheet is the game that was played, not a picture of
 * one.
 */
export function foldsOf(levels: readonly LevelData[]): Fold[] {
  const out: Fold[] = []
  const n = levels.length
  if (n === 0) return out
  for (let k = 1; k < n; k++) out.push([0, k / n, 1, k / n])
  levels.forEach((level, k) => {
    const top = k / n
    const band = 1 / n
    const ux = (tiles: number) => Math.max(0, Math.min(1, tiles / level.width))
    for (const room of level.rooms.slice(1)) {
      out.push([ux(room.from), top, ux(room.from), top + band])
    }
    for (const s of level.solids) {
      const row = level.floorRow - s.h
      const y = top + Math.max(0, Math.min(1, row / level.height)) * band
      const x1 = ux(s.x)
      const x2 = ux(s.x + s.w)
      if (x2 - x1 > 0.001) out.push([x1, y, x2, y])
    }
  })
  return out
}
