import type * as Phaser from 'phaser'
import { Enemy } from './Enemy.ts'
import { drawTag, drawTagText, tagBox } from '../ui/tag.ts'
import { mixColor, rotAbout } from '../geom.ts'
import type { Box, EntityContext, EntitySnapshot, EntityWorld } from './Entity.ts'
import type { EntitySpec } from '../levels/types.ts'
import type { Point } from '../geom.ts'
import type { Solid } from '../Player.ts'
import {
  BAT_ALERT_S,
  BAT_COOLDOWN_S,
  BAT_COVER_PX,
  BAT_DIVE_SAMPLES,
  BAT_DIVE_SPEED,
  BAT_FLAP_DEG,
  BAT_FLAP_HZ,
  BAT_H,
  BAT_HEALTH,
  BAT_RANGE_X,
  BAT_RANGE_Y,
  BAT_RETURN_S,
  BAT_STUN_S,
  BAT_SWAY_HZ,
  BAT_SWAY_PX,
  BAT_TAG_DY,
  BAT_W,
  BAT_WIND_ACCEL,
  BAT_WIND_DAMP,
  COLOR_BAT_BODY,
  COLOR_BAT_EAR,
  COLOR_BAT_WING,
  COLOR_INK,
  FOLD_OUTLINE,
  PARTICLES_BAT,
  TILE,
} from '../constants.ts'

const TAU = Math.PI * 2
const FLAP = (BAT_FLAP_DEG * Math.PI) / 180

/** The spec's five states, in the order one dive runs through them. */
export type BatState = 'hang' | 'alert' | 'dive' | 'stunned' | 'return'

/**
 * The first enemy: hangs from a ceiling strip, telegraphs, dives along a
 * fixed curve, and is killed by one sword hit.
 *
 * The one rule that matters more than any effect here is **fairness**: the
 * dive's target is captured at the instant the alert ends and never read
 * again, so a player who moves after the flash can always dodge. Nothing in
 * `dive` looks at the player.
 */
export class Bat extends Enemy<BatState> {
  /** Where it hangs from, and where it is now. */
  private anchorX: number
  private anchorY: number
  private px: number
  private py: number
  /** Last frame's position, to back out of a solid it has hit. */
  private prevX = 0
  private prevY = 0

  /** Free-running, for the sway and the flap. */
  private clock = 0
  /** Seconds before it may alert again. Runs through every state. */
  private cooldown = 0

  /** The sampled dive curve and its cumulative lengths. */
  private path: Point[] = []
  private lens: number[] = []
  /** Distance travelled along the curve. */
  private travel = 0
  /** Where the dive was launched from, and the locked target. */
  private aim: Point = [0, 0]

  /** The push a fan's column has given this dive. */
  private windVy = 0
  private windY = 0

  /** Did it catch the player on this dive? If so it is not stunned. */
  private struck = false
  /** Where a return started from. */
  private fromX = 0
  private fromY = 0

  constructor(spec: EntitySpec, ctx: EntityContext) {
    super(spec, ctx, 'hang', BAT_HEALTH)
    this.anchorX = this.centerX()
    // `y` is the underside of the strip it hangs from.
    this.anchorY = this.y + BAT_H / 2
    this.px = this.anchorX
    this.py = this.anchorY
  }

  /** The hitbox, wherever it currently is. */
  protected box(): Box {
    return {
      left: this.px - BAT_W / 2,
      right: this.px + BAT_W / 2,
      top: this.py - BAT_H / 2,
      bottom: this.py + BAT_H / 2,
    }
  }

  /** Where it is, for the tests and for anything that wants to look. */
  at(): Point {
    return [this.px, this.py]
  }

  /** The locked dive target. Null until a dive has been aimed. */
  target(): Point | null {
    return this.path.length > 0 ? [this.aim[0], this.aim[1]] : null
  }

  /**
   * Hurts the player, and only while diving. One hit per dive: the latch is
   * here rather than in the scene so two bats cannot share it.
   */
  dangerAt(box: Box): number | null {
    if (!this.alive()) return null
    if (this.state !== 'dive' || this.struck) return null
    if (!overlaps(this.box(), box)) return null
    this.struck = true
    return this.px
  }

  protected think(dt: number, world: EntityWorld): void {
    this.clock += dt
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt)
    this.prevX = this.px
    this.prevY = this.py

    if (this.state === 'hang' || this.state === 'alert') {
      // Hanging and telegraphing both sway; only the wings differ.
      this.px = this.anchorX
      this.py = this.anchorY + Math.sin(this.clock * BAT_SWAY_HZ * TAU) * BAT_SWAY_PX
    }

    switch (this.state) {
      case 'hang':
        if (this.cooldown <= 0 && this.sees(world)) {
          this.enter('alert')
          world.fx.sound('sting')
        }
        break

      case 'alert':
        // The "!" paper tag, drawn as a box by draw() and worded here.
        this.label(world)
        if (this.stateT >= BAT_ALERT_S) {
          // The whole fairness rule, in one line: where they are *now*.
          this.aimAt(world.player.box)
          this.enter('dive')
        }
        break

      case 'dive':
        this.dive(dt, world)
        break

      case 'stunned':
        if (this.stateT >= BAT_STUN_S) this.toReturn()
        break

      case 'return': {
        const t = Math.min(1, this.stateT / BAT_RETURN_S)
        this.px = this.fromX + (this.anchorX - this.fromX) * t
        this.py = this.fromY + (this.anchorY - this.fromY) * t
        if (t >= 1) {
          // The cooldown starts once it is home, not when the dive ended.
          this.cooldown = BAT_COOLDOWN_S
          this.enter('hang')
        }
        break
      }
    }
  }

  /**
   * In range, and not hiding. The spec's range is a box: 7 tiles across and
   * 6 up or down.
   */
  private sees(world: EntityWorld): boolean {
    const p = world.player.box
    const cx = (p.left + p.right) / 2
    const cy = (p.top + p.bottom) / 2
    if (Math.abs(cx - this.px) > BAT_RANGE_X * TILE) return false
    if (Math.abs(cy - this.py) > BAT_RANGE_Y * TILE) return false
    // "A player who is flat inside a slit is ignored, so nobody gets
    // attacked while stuck." Read as geometry rather than as a reference to
    // Slit: flat, with something solid just overhead. Flat in the open is
    // still fair game.
    if (world.player.flat && covered(p, world.solids)) return false
    return true
  }

  /**
   * Build the dive: a curve from here, through `box`'s centre, rising again
   * the same distance beyond it.
   *
   * The control point is the one value that makes a quadratic pass exactly
   * through the target at its midpoint, so "passing through where you were"
   * is geometry rather than an approximation.
   */
  private aimAt(box: Box): void {
    const start: Point = [this.px, this.py]
    const t: Point = [(box.left + box.right) / 2, (box.top + box.bottom) / 2]
    const end: Point = [t[0] + (t[0] - start[0]), start[1]]
    const ctrl: Point = [
      (4 * t[0] - start[0] - end[0]) / 2,
      (4 * t[1] - start[1] - end[1]) / 2,
    ]

    this.aim = t
    this.path = []
    this.lens = [0]
    for (let i = 0; i <= BAT_DIVE_SAMPLES; i++) {
      const u = i / BAT_DIVE_SAMPLES
      const k = 1 - u
      this.path.push([
        k * k * start[0] + 2 * k * u * ctrl[0] + u * u * end[0],
        k * k * start[1] + 2 * k * u * ctrl[1] + u * u * end[1],
      ])
      if (i > 0) {
        const a = this.path[i - 1]
        const b = this.path[i]
        this.lens.push(this.lens[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]))
      }
    }
    this.travel = 0
    this.windVy = 0
    this.windY = 0
    this.struck = false
  }

  private dive(dt: number, world: EntityWorld): void {
    this.travel += BAT_DIVE_SPEED * dt

    // Wind: a draught pushes it up, so the path bends. What it has picked up
    // bleeds away once it is out of the column again.
    if (world.liftAt(this.box())) {
      this.windVy -= BAT_WIND_ACCEL * dt
    } else if (this.windVy !== 0) {
      const drop = BAT_WIND_DAMP * dt
      this.windVy =
        Math.abs(this.windVy) <= drop ? 0 : this.windVy - Math.sign(this.windVy) * drop
    }
    this.windY += this.windVy * dt

    const p = this.along(this.travel)
    this.px = p[0]
    this.py = p[1] + this.windY

    // Into the floor or a wall: stuck there, which is the attack window —
    // unless it got what it came for, in which case it flies home.
    if (hitsAny(this.box(), world.solids)) {
      this.px = this.prevX
      this.py = this.prevY
      if (this.struck) this.toReturn()
      else this.enter('stunned')
      return
    }

    if (this.travel >= this.total()) this.toReturn()
  }

  private toReturn(): void {
    this.fromX = this.px
    this.fromY = this.py
    this.enter('return')
  }

  /** Total length of the dive curve. */
  private total(): number {
    return this.lens.length > 0 ? this.lens[this.lens.length - 1] : 0
  }

  /**
   * The point `s` pixels along the curve. Walking the cumulative lengths
   * rather than the Bezier parameter is what makes the speed exactly the
   * spec's 380px/s instead of fastest-in-the-middle.
   */
  private along(s: number): Point {
    const last = this.path.length - 1
    if (last < 1) return [this.px, this.py]
    if (s <= 0) return this.path[0]
    if (s >= this.total()) return this.path[last]
    let i = 1
    while (i < last && this.lens[i] < s) i++
    const span = this.lens[i] - this.lens[i - 1]
    const t = span > 0 ? (s - this.lens[i - 1]) / span : 0
    const a = this.path[i - 1]
    const b = this.path[i]
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  }

  private label(world: EntityWorld): void {
    const box = tagBox(this.px, this.py - BAT_TAG_DY, '!', [])
    drawTagText(world.fx, this.id, box, '!', [], 1)
  }

  protected onDeath(world: EntityWorld): void {
    world.fx.dust(this.px, this.py, PARTICLES_BAT, COLOR_BAT_BODY)
    world.fx.sound('hit')
  }

  reset(): void {
    super.reset()
    this.px = this.anchorX
    this.py = this.anchorY
    this.clock = 0
    this.cooldown = 0
    this.path = []
    this.lens = []
    this.travel = 0
    this.windVy = 0
    this.windY = 0
    this.struck = false
  }

  draw(g: Phaser.GameObjects.Graphics): void {
    if (!this.alive()) return

    const alerting = this.state === 'alert'
    // White through the alert, and white for the instant a hit lands.
    const lit = alerting || this.isFlashing()
    const body = lit ? mixColor(COLOR_BAT_BODY, 0xffffff, 0.75) : COLOR_BAT_BODY
    const wing = lit ? 0xffffff : COLOR_BAT_WING

    const cx = this.px
    const cy = this.py
    const hw = BAT_W / 2
    const hh = BAT_H / 2

    // Ears first, so the body's outline sits over their base.
    g.fillStyle(COLOR_BAT_EAR, 1)
    for (const side of [-1, 1]) {
      tri(
        g,
        [cx + side * hw * 0.42, cy - hh * 0.55],
        [cx + side * hw * 0.2, cy - hh * 1.5],
        [cx + side * hw * 0.72, cy - hh * 0.75],
      )
    }

    // The wings: three facets each, swung about the shoulder. Folded while
    // hanging, open and beating otherwise.
    const beat =
      this.state === 'hang' ? -FLAP * 0.8 : Math.sin(this.clock * BAT_FLAP_HZ * TAU) * FLAP
    g.fillStyle(wing, 1)
    g.lineStyle(FOLD_OUTLINE, COLOR_INK, 1)
    for (const side of [-1, 1]) {
      const shoulder: Point = [cx + side * hw * 0.35, cy - hh * 0.2]
      for (let i = 0; i < 3; i++) {
        const span = hw * (1.5 - i * 0.32)
        const lift = hh * (0.35 + i * 0.3)
        const a: Point = shoulder
        const b: Point = [cx + side * span, cy - hh * 0.1 + i * 2]
        const c: Point = [cx + side * span * 0.8, cy + lift]
        const angle = beat * side * (1 + i * 0.25)
        tri(
          g,
          rotAbout(a, angle, shoulder),
          rotAbout(b, angle, shoulder),
          rotAbout(c, angle, shoulder),
          true,
        )
      }
    }

    // The body, over the wing roots.
    g.fillStyle(body, 1)
    tri(
      g,
      [cx, cy + hh],
      [cx - hw * 0.6, cy - hh * 0.6],
      [cx + hw * 0.6, cy - hh * 0.6],
      true,
    )

    // The telegraph's paper tag. Its "!" is drawn by the scene as a label.
    if (alerting) {
      drawTag(g, tagBox(cx, cy - BAT_TAG_DY, '!', []), [], 1)
    }
  }

  serialize(): EntitySnapshot {
    return {
      ...super.serialize(),
      state: {
        health: this.hits(),
        phase: this.state,
        x: Math.round(this.px),
        y: Math.round(this.py),
        struck: this.struck,
      },
    }
  }
}

/** A filled triangle, optionally outlined too. */
function tri(
  g: Phaser.GameObjects.Graphics,
  a: Point,
  b: Point,
  c: Point,
  outline = false,
): void {
  g.fillTriangle(a[0], a[1], b[0], b[1], c[0], c[1])
  if (outline) g.strokeTriangle(a[0], a[1], b[0], b[1], c[0], c[1])
}

function overlaps(a: Box, b: Box): boolean {
  return a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom
}

function hitsAny(box: Box, solids: readonly Solid[]): boolean {
  for (const s of solids) {
    if (
      box.right > s.x &&
      box.left < s.x + s.w &&
      box.bottom > s.y &&
      box.top < s.y + s.h
    ) {
      return true
    }
  }
  return false
}

/**
 * Is there something solid just above this box? Every solid in this game
 * runs from its top surface downward, so a floor's underside is far below
 * and only a slab — a slit's pillar — can answer yes.
 */
function covered(box: Box, solids: readonly Solid[]): boolean {
  for (const s of solids) {
    if (s.x >= box.right || s.x + s.w <= box.left) continue
    const gap = box.top - (s.y + s.h)
    // Slightly negative counts: a player flat in a slit fills the gap exactly.
    if (gap >= -2 && gap <= BAT_COVER_PX) return true
  }
  return false
}
