import type * as Phaser from 'phaser'
import { Entity } from './Entity.ts'
import { dashedRect, rotAbout } from '../geom.ts'
import type { Box, EntityContext, EntitySnapshot, EntityWorld } from './Entity.ts'
import type { EntitySpec } from '../levels/types.ts'
import type { Point } from '../geom.ts'
import type { Updraft } from '../Player.ts'
import {
  COLOR_WIND,
  DRAUGHT_ACCEL,
  DRAUGHT_VY,
  FAN_BLADES,
  FAN_BLADE_PX,
  FAN_BODY_H,
  FAN_BURST,
  FAN_COLUMN_H,
  FAN_DASH_GAP,
  FAN_DASH_PX,
  FAN_FLICKER_HZ,
  FAN_HUM_WARN,
  FAN_SPINUP_MS,
  FAN_WARN_MS,
  FAN_WARN_SPIN,
  FAN_HEAR_PX,
  FAN_MOTES_PER_S,
  FAN_MOTE_PX,
  FAN_MOTE_SPEED,
  FAN_SPIN,
  FAN_STREAKS,
  FAN_STREAK_PX,
  FAN_STREAK_R,
  FAN_SWIRL,
  COLOR_INK,
  FOLD_OUTLINE,
  TILE,
} from '../constants.ts'

const TAU = Math.PI * 2
const WARN = FAN_WARN_MS / 1000
const SPINUP = FAN_SPINUP_MS / 1000

type Mote = { x: number; y: number; spin: number }

/**
 * A fan in the floor of a pit, with a column of moving air above it.
 *
 * It adds no collision: it is a grille you walk onto and get carried off.
 * Solid, you could stand on it and jump, which would be a way round the
 * lesson it exists to teach.
 */
export class Fan extends Entity {
  private floorY: number
  private topY: number
  private draught: Updraft

  private clock = 0
  private motes: Mote[] = []
  private owed = 0
  /** A fan with no period is simply always on, as Level 1's is. */
  private onStart: number
  private onDuration: number
  private period: number | null
  /** Was it on last frame, so turning on can be noticed once. */
  private wasOn = true
  /** Counts up from a turn-on, so the blades wind back up. */
  private spinup = SPINUP
  /** Blade angle, advanced by the current rate rather than the raw clock. */
  private spun = 0
  /** Has anything ridden this column? The room's tag asks. */
  private ridden = false
  /** Where the player is while they are in the column, for the streaks. */
  private rider: { x: number; y: number } | null = null

  constructor(spec: EntitySpec, ctx: EntityContext) {
    super(spec, ctx)
    // The fan sits on the pit floor, which is its own h rather than the
    // room's, so a fan can stand anywhere.
    this.floorY = ctx.surfaceY(spec.floorH ?? this.th)
    this.topY = this.floorY - (spec.columnH ?? FAN_COLUMN_H) * TILE
    this.draught = { vy: DRAUGHT_VY, accel: DRAUGHT_ACCEL }
    this.onStart = spec.onStart ?? 0
    this.onDuration = spec.onDuration ?? 0
    this.period = spec.period ?? null
    this.wasOn = this.isOn()
  }

  /**
   * On or off right now. Without a period there is no timer and it simply
   * runs, which is what keeps Level 1's fan working untouched.
   */
  isOn(): boolean {
    if (this.period === null) return true
    return this.phase() < this.onDuration
  }

  /** The last stretch before it turns off: the player's cue to move. */
  isWarning(): boolean {
    if (this.period === null || !this.isOn()) return false
    return this.onDuration - this.phase() <= WARN
  }

  /** Has anything ridden the column? The room's tag asks. */
  done(): boolean {
    return this.ridden
  }

  /** Seconds since this fan last came on, wrapped into its period. */
  private phase(): number {
    const p = this.period
    if (p === null) return 0
    return (((this.clock - this.onStart) % p) + p) % p
  }

  /** The column, in pixels. */
  column(): Box {
    return {
      left: this.x,
      right: this.x + this.w,
      top: this.topY,
      bottom: this.floorY,
    }
  }

  draughtAt(box: Box): Updraft | null {
    if (!this.isOn()) return null
    const c = this.column()
    const inside =
      box.right > c.left &&
      box.left < c.right &&
      box.bottom > c.top &&
      box.top < c.bottom
    return inside ? this.draught : null
  }

  update(dt: number, world: EntityWorld): void {
    this.clock += dt
    const on = this.isOn()

    // Turning on: the blades wind up from slow, and a batch of motes shoots
    // up the column so the change is impossible to miss.
    if (on && !this.wasOn) {
      this.spinup = 0
      for (let i = 0; i < FAN_BURST; i++) this.spawnMote()
    }
    this.wasOn = on
    if (this.spinup < SPINUP) this.spinup = Math.min(SPINUP, this.spinup + dt)

    // The blades turn here rather than in draw(), so the angle follows the
    // simulation rather than however many times the frame drew. They slow
    // through the warning and wind back up on turning on.
    const rate =
      (this.isWarning() ? FAN_WARN_SPIN : on ? 1 : 0) * (this.spinup / SPINUP)
    this.spun += rate * FAN_SPIN * dt

    // Motes only while it is blowing. The ones already in flight finish
    // their rise rather than blinking out.
    if (on) {
      this.owed += FAN_MOTES_PER_S * dt
      while (this.owed >= 1) {
        this.owed -= 1
        this.spawnMote()
      }
    } else {
      this.owed = 0
    }
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i]
      m.y -= FAN_MOTE_SPEED * dt
      m.spin += FAN_SWIRL * dt
      if (m.y < this.topY) this.motes.splice(i, 1)
    }

    const box = world.player.box
    this.rider = this.draughtAt(box)
      ? { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 }
      : null
    if (this.rider) this.ridden = true

    // A low loop that gets louder as you approach, measured from the
    // grille, silent while off and dropping through the warning.
    const dx = (box.left + box.right) / 2 - this.centerX()
    const dy = (box.top + box.bottom) / 2 - this.floorY
    const near = 1 - Math.hypot(dx, dy) / FAN_HEAR_PX
    let level = Math.max(0, Math.min(1, near))
    if (!on) level = 0
    else if (this.isWarning()) level *= FAN_HUM_WARN
    world.fx.hum(this.id, level)
  }

  private spawnMote(): void {
    this.motes.push({
      x: this.x + Math.random() * this.w,
      y: this.floorY,
      spin: Math.random() * TAU,
    })
  }

  reset(): void {
    this.motes.length = 0
    this.owed = 0
    this.rider = null
    this.ridden = false
    this.clock = 0
    this.spinup = SPINUP
    this.spun = 0
    this.wasOn = this.isOn()
  }

  draw(g: Phaser.GameObjects.Graphics): void {
    const on = this.isOn()
    const warning = this.isWarning()
    const c = this.column()

    // The outline says at a glance whether it is blowing: dashed off,
    // solid on.
    g.lineStyle(FOLD_OUTLINE, COLOR_WIND, on ? 0.7 : 0.4)
    if (on) {
      g.strokeRect(c.left, c.top, c.right - c.left, c.bottom - c.top)
    } else {
      dashedRect(
        g,
        c.left,
        c.top,
        c.right - c.left,
        c.bottom - c.top,
        FAN_DASH_PX,
        FAN_DASH_GAP,
      )
    }

    // The motes are the air: visible only by what it carries. They flicker
    // through the warning.
    const flicker = warning
      ? 0.35 + 0.4 * (Math.sin(this.clock * FAN_FLICKER_HZ * TAU) > 0 ? 1 : 0)
      : 0.75
    g.fillStyle(COLOR_WIND, flicker)
    for (const m of this.motes) {
      // Fade out toward the top, so they thin rather than vanish.
      const up = (this.floorY - m.y) / (this.floorY - this.topY)
      triangle(g, m.x, m.y, FAN_MOTE_PX * (1 - up * 0.4), m.spin)
    }

    // The grille, and three blades turning on it.
    const cx = this.centerX()
    const cy = this.floorY - FAN_BODY_H / 2
    g.fillStyle(COLOR_WIND, 1)
    g.fillRect(this.x, this.floorY - FAN_BODY_H, this.w, FAN_BODY_H)
    g.lineStyle(FOLD_OUTLINE, COLOR_INK, 1)
    g.strokeRect(this.x, this.floorY - FAN_BODY_H, this.w, FAN_BODY_H)

    const spin = this.spun
    g.fillStyle(COLOR_INK, 0.85)
    for (let i = 0; i < FAN_BLADES; i++) {
      triangle(g, cx, cy, FAN_BLADE_PX, spin + (i / FAN_BLADES) * TAU)
    }

    // Streaks swirling around whoever is inside.
    if (this.rider) {
      g.lineStyle(FOLD_OUTLINE, COLOR_WIND, 0.9)
      for (let i = 0; i < FAN_STREAKS; i++) {
        const a = this.clock * FAN_SWIRL + (i / FAN_STREAKS) * TAU
        const o: Point = [this.rider.x, this.rider.y]
        const from = rotAbout([this.rider.x + FAN_STREAK_R, this.rider.y], a, o)
        const to = rotAbout(
          [this.rider.x + FAN_STREAK_R, this.rider.y - FAN_STREAK_PX],
          a,
          o,
        )
        g.lineBetween(from[0], from[1], to[0], to[1])
      }
    }
  }

  serialize(): EntitySnapshot {
    return {
      ...super.serialize(),
      state: { motes: this.motes.length, riding: this.rider !== null },
    }
  }

  /** How many motes are in the air. For tests. */
  moteCount(): number {
    return this.motes.length
  }
}

/** A small equilateral triangle, pointing wherever `a` says. */
function triangle(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  a: number,
): void {
  g.fillTriangle(
    x + Math.cos(a) * r,
    y + Math.sin(a) * r,
    x + Math.cos(a + TAU / 3) * r,
    y + Math.sin(a + TAU / 3) * r,
    x + Math.cos(a + (TAU * 2) / 3) * r,
    y + Math.sin(a + (TAU * 2) / 3) * r,
  )
}
