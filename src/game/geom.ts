import type * as Phaser from 'phaser'

/**
 * Shared geometry and the drawing primitives that go with it. Everything in
 * this game that folds is a rotated point, and everything not yet solid is
 * drawn as a dashed ghost of itself.
 */

export type Point = [number, number]

const TAU = Math.PI * 2

/** `p` rotated `a` radians about `o`. */
export function rotAbout(p: Point, a: number, o: Point): Point {
  if (a === 0) return p
  const c = Math.cos(a)
  const s = Math.sin(a)
  const dx = p[0] - o[0]
  const dy = p[1] - o[1]
  return [o[0] + dx * c - dy * s, o[1] + dx * s + dy * c]
}

/**
 * A soft breathing factor in [1 - depth, 1], for the glow on anything
 * waiting to be used. `t` is a clock in seconds.
 */
export function pulse(t: number, hz: number, depth: number): number {
  return 1 - depth + depth * (0.5 + 0.5 * Math.sin(t * hz * TAU))
}

/** A line drawn as dashes, `dash` long with `gap` between them. */
export function dashedLine(
  g: Phaser.GameObjects.Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dash: number,
  gap: number,
): void {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy)
  if (len === 0) return
  const ux = dx / len
  const uy = dy / len

  for (let at = 0; at < len; at += dash + gap) {
    const end = Math.min(at + dash, len)
    g.lineBetween(x1 + ux * at, y1 + uy * at, x1 + ux * end, y1 + uy * end)
  }
}

/** The four sides of a rectangle, dashed. */
export function dashedRect(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  dash: number,
  gap: number,
): void {
  dashedLine(g, x, y, x + w, y, dash, gap)
  dashedLine(g, x + w, y, x + w, y + h, dash, gap)
  dashedLine(g, x + w, y + h, x, y + h, dash, gap)
  dashedLine(g, x, y + h, x, y, dash, gap)
}

/** Blend two packed 0xRRGGBB colours. `t` 0 gives `a`, 1 gives `b`. */
export function mixColor(a: number, b: number, t: number): number {
  const k = Math.max(0, Math.min(1, t))
  const ar = (a >> 16) & 0xff
  const ag = (a >> 8) & 0xff
  const ab = a & 0xff
  const br = (b >> 16) & 0xff
  const bg = (b >> 8) & 0xff
  const bb = b & 0xff
  const r = Math.round(ar + (br - ar) * k)
  const gg = Math.round(ag + (bg - ag) * k)
  const bl = Math.round(ab + (bb - ab) * k)
  return (r << 16) | (gg << 8) | bl
}
