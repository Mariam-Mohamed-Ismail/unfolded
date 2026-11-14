import type * as Phaser from 'phaser'
import { Switch, overlaps } from './Switch.ts'
import { dashedLine } from '../geom.ts'
import type { EntityContext, EntitySnapshot, EntityWorld } from './Entity.ts'
import type { EntitySpec } from '../levels/types.ts'
import {
  COLOR_FOLD_LINE,
  FOLD_OUTLINE,
  LINK_DOT_GAP,
  LINK_DOT_PX,
  SWITCH_H,
  SWITCH_RING_R,
  SWITCH_RING_WIDTH,
  SWITCH_TIMED_S,
} from '../constants.ts'

const TAU = Math.PI * 2

/**
 * A plate that stays down for a few seconds and then lets go.
 *
 * A Switch rather than a copy of one: the plate's art, its trigger box, the
 * dotted link lines and the fold direction all come from the parent, and
 * only the clock is new. Releasing triggers the targets again with the
 * opposite mode, so closing reuses the machinery that opened them instead of
 * inventing a second one.
 *
 * It can be pressed again once it has released — the puzzle it exists for is
 * a run against the clock, and that has to be retryable without a reset.
 */
export class TimedSwitch extends Switch {
  private duration: number
  /** Seconds left of the press. */
  private left = 0
  /**
   * False from a release until the plate is stood clear of.
   *
   * Without it, standing on the plate when the time runs out releases it and
   * presses it again on the very next frame — which makes its targets start
   * closing and immediately re-open, a visible flicker. You have to step off
   * and back on, which is also the honest reading of a plate you trigger by
   * stepping on it.
   */
  private armed = true

  constructor(spec: EntitySpec, ctx: EntityContext) {
    super(spec, ctx)
    this.duration = spec.duration ?? SWITCH_TIMED_S
  }

  /** 1 full, 0 empty: what the ring draws and what the link line fades on. */
  remaining(): number {
    return this.duration > 0 ? this.left / this.duration : 0
  }

  secondsLeft(): number {
    return this.left
  }

  update(_dt: number, world: EntityWorld): void {
    this.pulseClock += _dt
    if (this.pressed) {
      this.clock += _dt
      this.left = Math.max(0, this.left - _dt)
      if (this.left <= 0) this.release()
      return
    }
    const on = overlaps(world.player.box, this.triggerBox())
    if (!on) {
      this.armed = true
      return
    }
    if (!this.armed) return
    this.press()
    this.left = this.duration
  }

  reset(): void {
    super.reset()
    this.left = 0
    this.armed = true
  }

  /** Can it be pressed right now? False while you are still standing on it. */
  isArmed(): boolean {
    return this.armed
  }

  draw(g: Phaser.GameObjects.Graphics): void {
    super.draw(g)
    if (!this.pressed) return

    // The clock: a ring around the plate that empties as the time runs out.
    // Drawn from straight up, clockwise, so it reads the way a clock does.
    const cx = this.centerX()
    const cy = this.plateY + SWITCH_H / 2
    const sweep = TAU * this.remaining()
    g.lineStyle(SWITCH_RING_WIDTH, COLOR_FOLD_LINE, 0.25)
    g.strokeCircle(cx, cy, SWITCH_RING_R)
    if (sweep <= 0) return
    g.lineStyle(SWITCH_RING_WIDTH, this.purple, 1)
    g.beginPath()
    g.arc(cx, cy, SWITCH_RING_R, -TAU / 4, -TAU / 4 + sweep, false)
    g.strokePath()
  }

  serialize(): EntitySnapshot {
    return {
      ...super.serialize(),
      state: {
        pressed: this.pressed,
        mode: this.mode,
        left: Math.round(this.left * 100) / 100,
      },
    }
  }

  /**
   * The link line fades with the clock rather than on the parent's fixed
   * hold: while this plate is down, the line is what says so.
   */
  protected drawLinks(g: Phaser.GameObjects.Graphics): void {
    const alpha = this.remaining()
    if (alpha <= 0) return
    g.lineStyle(FOLD_OUTLINE, this.purple, alpha)
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

  /** Time up: put the targets back the way they were, and stand up. */
  private release(): void {
    const back = this.mode === 'fold' ? 'unfold' : 'fold'
    const order = back === 'fold' ? [...this.targets].reverse() : [...this.targets]
    order.forEach((t) => t.trigger(0, back))
    this.pressed = false
    this.clock = 0
    this.left = 0
    this.armed = false
  }
}
