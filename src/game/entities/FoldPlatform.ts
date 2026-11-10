import type * as Phaser from 'phaser'
import { Entity } from './Entity.ts'
import { dashedRect, mixColor, pulse, rotAbout } from '../geom.ts'
import type { EntityContext, EntitySnapshot, EntityWorld } from './Entity.ts'
import type { EntitySpec } from '../levels/types.ts'
import type { Point } from '../geom.ts'
import type { Solid } from '../Player.ts'
import {
  COLOR_FOLD,
  COLOR_FOLD_LINE,
  COLOR_FOLD_SHADE,
  FOLD_DASH_GAP,
  FOLD_DASH_PX,
  FOLD_GHOST_ALPHA,
  FOLD_OPEN_MS,
  FOLD_OUTLINE,
  PARTICLES_FOLD_OPEN,
  PULSE_DEPTH,
  PULSE_HZ,
  SHAKE_FOLD,
  SHAKE_FOLD_MS,
} from '../constants.ts'

const OPEN = FOLD_OPEN_MS / 1000
const QUARTER = Math.PI / 2

/**
 * A step that starts as a flat sheet and unfolds into solid ground.
 *
 * Folded it is a dashed ghost of where it will be, with no collision
 * anywhere in the world. Triggered, it waits its turn in the sequence, then
 * swings up about its crease — the bottom-left corner, on the floor — and
 * becomes solid the moment it lands.
 */
export class FoldPlatform extends Entity {
  private ctx: EntityContext
  private solid: Solid
  /** Top surface and floor-level base, in pixels. */
  private topY: number
  private baseY: number
  private startsFolded: boolean

  private opening = false
  private delay = 0
  private clock = 0
  /** 0 flat, 1 fully unfolded. */
  private t = 0
  private solidOn = false
  private pulseClock = 0

  constructor(spec: EntitySpec, ctx: EntityContext) {
    super(spec, ctx)
    this.ctx = ctx
    // Entity put `y` on the entity's own row, which for a step is the floor
    // it grows out of. `topH` is where its surface ends up.
    this.baseY = this.y
    this.topY = ctx.surfaceY(spec.topH ?? this.th + 1)
    this.startsFolded = spec.startsFolded ?? true
    this.solid = {
      x: this.x,
      y: this.topY,
      w: this.w,
      h: this.baseY - this.topY,
    }
    this.reset()
  }

  /** Is it carrying weight yet? */
  isOpen(): boolean {
    return this.solidOn
  }

  /** 0 flat, 1 landed. For the overlay and for tests. */
  progress(): number {
    return this.t
  }

  trigger(delay: number): void {
    if (!this.startsFolded || this.opening || this.solidOn) return
    this.opening = true
    this.delay = delay
    this.clock = 0
  }

  update(dt: number, world: EntityWorld): void {
    this.pulseClock += dt
    if (!this.opening) return

    // One clock counting up rather than two counting down: the stagger and
    // the rotation then cannot drift apart or leave float residue behind.
    this.clock += dt
    const p = (this.clock - this.delay) / OPEN
    if (p <= 0) return
    this.t = Math.min(1, p)
    if (this.t < 1) return

    this.opening = false
    this.setSolid(true)
    // It lands rather than appears: paper, dust and a knock.
    world.fx.dust(this.x + this.w / 2, this.topY, PARTICLES_FOLD_OPEN, COLOR_FOLD)
    world.fx.shake(SHAKE_FOLD, SHAKE_FOLD_MS)
    world.fx.fold()
  }

  reset(): void {
    this.opening = false
    this.clock = 0
    this.delay = 0
    this.t = this.startsFolded ? 0 : 1
    this.setSolid(!this.startsFolded)
  }

  draw(g: Phaser.GameObjects.Graphics): void {
    if (this.t <= 0) {
      // A ghost of where the step will be, so the geometry reads before the
      // puzzle is solved: the stairs are visibly missing, not absent.
      const alpha = FOLD_GHOST_ALPHA * pulse(this.pulseClock, PULSE_HZ, PULSE_DEPTH)
      g.lineStyle(FOLD_OUTLINE, COLOR_FOLD, alpha)
      dashedRect(
        g,
        this.x,
        this.topY,
        this.w,
        this.baseY - this.topY,
        FOLD_DASH_PX,
        FOLD_DASH_GAP,
      )
      return
    }

    // Rotating about the crease. At t = 0 the sheet lies a quarter turn back
    // from where it ends up; the shading follows the angle, so a flat sheet
    // reads as one that is still on its way.
    const angle = -(1 - this.t) * QUARTER
    const crease: Point = [this.x, this.baseY]
    const quad: Point[] = [
      [this.x, this.baseY],
      [this.x + this.w, this.baseY],
      [this.x + this.w, this.topY],
      [this.x, this.topY],
    ].map((p) => rotAbout(p as Point, angle, crease))
    const points = quad.map(([x, y]) => ({ x, y }))

    g.fillStyle(mixColor(COLOR_FOLD_SHADE, COLOR_FOLD, this.t), 1)
    g.fillPoints(points, true)
    g.lineStyle(FOLD_OUTLINE, COLOR_FOLD_LINE, 1)
    g.strokePoints(points, true)
  }

  serialize(): EntitySnapshot {
    return {
      ...super.serialize(),
      state: { open: this.solidOn, t: Math.round(this.t * 100) / 100 },
    }
  }

  private setSolid(on: boolean): void {
    if (on === this.solidOn) return
    this.solidOn = on
    if (on) this.ctx.addSolid(this.solid)
    else this.ctx.removeSolid(this.solid)
  }
}
