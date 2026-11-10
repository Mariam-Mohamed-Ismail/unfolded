import type * as Phaser from 'phaser'
import { Entity } from './Entity.ts'
import { rotAbout } from '../geom.ts'
import type { Box, EntityContext, EntitySnapshot, EntityWorld } from './Entity.ts'
import type { EntitySpec } from '../levels/types.ts'
import type { Point } from '../geom.ts'
import type { Updraft } from '../Player.ts'
import {
  COLOR_INK,
  COLOR_WIND,
  DRAUGHT_ACCEL,
  DRAUGHT_VY,
  FAN_BLADES,
  FAN_BLADE_PX,
  FAN_BODY_H,
  FAN_COLUMN_H,
  FAN_HEAR_PX,
  FAN_MOTES_PER_S,
  FAN_MOTE_PX,
  FAN_MOTE_SPEED,
  FAN_SPIN,
  FAN_STREAKS,
  FAN_STREAK_PX,
  FAN_STREAK_R,
  FAN_SWIRL,
  FOLD_OUTLINE,
  TILE,
} from '../constants.ts'

const TAU = Math.PI * 2

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
  /** Where the player is while they are in the column, for the streaks. */
  private rider: { x: number; y: number } | null = null

  constructor(spec: EntitySpec, ctx: EntityContext) {
    super(spec, ctx)
    // The fan sits on the pit floor, which is its own h rather than the
    // room's, so a fan can stand anywhere.
    this.floorY = ctx.surfaceY(spec.floorH ?? this.th)
    this.topY = this.floorY - (spec.columnH ?? FAN_COLUMN_H) * TILE
    this.draught = { vy: DRAUGHT_VY, accel: DRAUGHT_ACCEL }
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

    // Amber triangles, 14 a second, rising from the grille. `owed` carries
    // the fraction over so the rate does not depend on the frame length.
    this.owed += FAN_MOTES_PER_S * dt
    while (this.owed >= 1) {
      this.owed -= 1
      this.motes.push({
        x: this.x + Math.random() * this.w,
        y: this.floorY,
        spin: Math.random() * TAU,
      })
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

    // A low loop that gets louder as you approach, measured from the grille.
    const dx = (box.left + box.right) / 2 - this.centerX()
    const dy = (box.top + box.bottom) / 2 - this.floorY
    const near = 1 - Math.hypot(dx, dy) / FAN_HEAR_PX
    world.fx.hum(this.id, Math.max(0, Math.min(1, near)))
  }

  reset(): void {
    this.motes.length = 0
    this.owed = 0
    this.rider = null
  }

  draw(g: Phaser.GameObjects.Graphics): void {
    // The motes are the column: nothing else draws it, so the air is
    // visible only by what it carries.
    g.fillStyle(COLOR_WIND, 0.75)
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

    const spin = this.clock * FAN_SPIN
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
