import type * as Phaser from 'phaser'
import {
  COLOR_FOLD,
  COLOR_INK,
  COLOR_PAPER,
  FOLD_OUTLINE,
  STAR_GAP,
  STAR_INSET,
  STAR_PX,
} from '../constants.ts'

export type StarBox = { x: number; y: number; w: number; h: number }

/** The five points of a paper star, folded out of a pentagon. */
const POINTS = 5
/** How far the inner corners sit from the middle, as a fraction. */
const WAIST = 0.42
/** Point up: a star balanced on two legs rather than on a point. */
const TURN = -Math.PI / 2

/**
 * One star as a closed path of ten corners, alternating tip and waist.
 * Drawn rather than typed: a glyph would be the one piece of art in this
 * game that came from a font.
 */
function path(cx: number, cy: number, r: number): Phaser.Types.Math.Vector2Like[] {
  const pts: Phaser.Types.Math.Vector2Like[] = []
  let top = Infinity
  let bottom = -Infinity
  for (let i = 0; i < POINTS * 2; i++) {
    const reach = i % 2 === 0 ? r : r * WAIST
    const a = TURN + (i * Math.PI) / POINTS
    const y = Math.sin(a) * reach
    top = Math.min(top, y)
    bottom = Math.max(bottom, y)
    pts.push({ x: cx + Math.cos(a) * reach, y: cy + y })
  }
  // A star with a point up reaches further above its middle than below it,
  // so sitting it on cy leaves it looking high. Centre what is drawn, not
  // the pentagon it came from.
  const lift = (top + bottom) / 2
  for (const p of pts) p.y -= lift
  return pts
}

/** One star, filled if it has been earned and a faint outline if not. */
export function drawStar(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  earned: boolean,
): void {
  const pts = path(cx, cy, STAR_PX)
  if (earned) {
    g.fillStyle(COLOR_FOLD, 1)
    g.fillPoints(pts, true)
    g.lineStyle(FOLD_OUTLINE, COLOR_INK, 1)
    g.strokePoints(pts, true)
    // The crease: one fold line down the middle, like every other folded
    // thing in the game. Taken from the path's own corners - the top point
    // and the waist directly below it - so it stays put when the shape is
    // centred.
    g.lineBetween(pts[0].x, pts[0].y, pts[5].x, pts[5].y)
    return
  }
  // Not yet: the paper is there, the star is not.
  g.fillStyle(COLOR_PAPER, 0.35)
  g.fillPoints(pts, true)
  g.lineStyle(FOLD_OUTLINE, COLOR_INK, 0.3)
  g.strokePoints(pts, true)
}

/**
 * A room's stars at the right-hand end of its Room select row: `earned` of
 * `possible` filled, the rest left as empty paper so the row shows what is
 * still to come.
 *
 * `possible` is 2 for a room with no par time, which is the movement lane.
 */
export function drawStars(
  g: Phaser.GameObjects.Graphics,
  box: StarBox,
  earned: number,
  possible = 3,
): void {
  const step = STAR_PX * 2 + STAR_GAP
  // Right-aligned, so rows with two and rows with three still line up on
  // the edge the eye follows.
  const right = box.x + box.w - STAR_INSET - STAR_PX
  const cy = box.y + box.h / 2
  for (let i = 0; i < possible; i++) {
    const cx = right - (possible - 1 - i) * step
    drawStar(g, cx, cy, i < earned)
  }
}
