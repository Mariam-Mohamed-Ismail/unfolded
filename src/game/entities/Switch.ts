import type * as Phaser from 'phaser'
import { Entity } from './Entity.ts'
import { dashedLine, pulse } from '../geom.ts'
import type { Box, EntityContext, EntitySnapshot, EntityWorld } from './Entity.ts'
import type { EntitySpec } from '../levels/types.ts'
import {
  COLOR_FOLD,
  COLOR_FOLD_LINE,
  FOLD_OUTLINE,
  FOLD_STAGGER_MS,
  LINK_DOT_GAP,
  LINK_DOT_PX,
  LINK_FADE_MS,
  LINK_HOLD_MS,
  PULSE_DEPTH,
  PULSE_HZ,
  RIPPLE_MS,
  RIPPLE_RADIUS,
  RIPPLE_WIDTH,
  SWITCH_H,
  SWITCH_PRESS_PX,
  SWITCH_TRIGGER_H,
  SWITCH_W,
  TILE,
} from '../constants.ts'

const RIPPLE = RIPPLE_MS / 1000
const HOLD = LINK_HOLD_MS / 1000
const FADE = LINK_FADE_MS / 1000
const STAGGER = FOLD_STAGGER_MS / 1000

/**
 * A pressure plate that latches. Step on it once and it stays down; only a
 * room reset lifts it.
 *
 * It never learns what it is connected to: it calls trigger() on whatever
 * the data pointed it at, staggered, and draws a dotted line to each so the
 * room explains its own cause and effect.
 */
export class Switch extends Entity {
  private plateX: number
  private plateY: number
  private pressed = false
  /** Seconds since the press, which drives the ripple and the link line. */
  private clock = 0
  private pulseClock = 0

  constructor(spec: EntitySpec, ctx: EntityContext) {
    super(spec, ctx)
    // Centred in its tile, sitting on the surface it was placed on.
    this.plateX = this.x + (TILE - SWITCH_W) / 2
    this.plateY = this.y - SWITCH_H
  }

  isPressed(): boolean {
    return this.pressed
  }

  /** A pressed plate is a finished lesson, which is what a tag asks about. */
  done(): boolean {
    return this.pressed
  }

  update(dt: number, world: EntityWorld): void {
    this.pulseClock += dt
    if (this.pressed) {
      this.clock += dt
      return
    }
    if (!overlaps(world.player.box, this.triggerBox())) return
    this.press()
  }

  reset(): void {
    this.pressed = false
    this.clock = 0
  }

  draw(g: Phaser.GameObjects.Graphics): void {
    if (this.pressed) this.drawLinks(g)

    const sink = this.pressed ? SWITCH_PRESS_PX : 0
    const top = this.plateY + sink
    const bottom = this.plateY + SWITCH_H
    // A squat trapezoid, wider at the base: a folded paper plate rather
    // than a button. Unpressed it breathes.
    const alpha = this.pressed ? 1 : pulse(this.pulseClock, PULSE_HZ, PULSE_DEPTH)
    const lip = 3
    const points = [
      { x: this.plateX + lip, y: top },
      { x: this.plateX + SWITCH_W - lip, y: top },
      { x: this.plateX + SWITCH_W, y: bottom },
      { x: this.plateX, y: bottom },
    ]
    g.fillStyle(COLOR_FOLD, alpha)
    g.fillPoints(points, true)
    g.lineStyle(FOLD_OUTLINE, COLOR_FOLD_LINE, 1)
    g.strokePoints(points, true)

    // The ripple: one expanding ring, spreading out of the plate.
    if (this.pressed && this.clock < RIPPLE) {
      const e = this.clock / RIPPLE
      g.lineStyle(RIPPLE_WIDTH, COLOR_FOLD, 1 - e)
      g.strokeCircle(this.centerX(), bottom, RIPPLE_RADIUS * e)
    }
  }

  serialize(): EntitySnapshot {
    return { ...super.serialize(), state: { pressed: this.pressed } }
  }

  private press(): void {
    this.pressed = true
    this.clock = 0
    // One after another, in the order the data listed them.
    this.targets.forEach((t, i) => t.trigger(i * STAGGER))
  }

  /**
   * The dotted line to each target. It draws on the press, holds while they
   * move, then fades: the room explains itself once rather than carrying the
   * explanation around forever.
   */
  private drawLinks(g: Phaser.GameObjects.Graphics): void {
    const age = this.clock - HOLD
    if (age > FADE) return
    const alpha = age <= 0 ? 1 : 1 - age / FADE
    g.lineStyle(FOLD_OUTLINE, COLOR_FOLD, alpha)
    for (const t of this.targets) {
      dashedLine(
        g,
        this.centerX(),
        this.plateY,
        t.centerX(),
        t.y,
        LINK_DOT_PX,
        LINK_DOT_GAP,
      )
    }
  }

  /** The box the player has to touch. Taller than the plate, so it is kind. */
  private triggerBox(): Box {
    return {
      left: this.plateX,
      right: this.plateX + SWITCH_W,
      top: this.y - SWITCH_TRIGGER_H,
      bottom: this.y,
    }
  }
}

/** Touching exactly flush is not an overlap, matching the player's collision. */
function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}
