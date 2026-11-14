import type * as Phaser from 'phaser'
import { Entity } from './Entity.ts'
import { mixColor, rotAbout } from '../geom.ts'
import type { EntityContext, EntitySnapshot, EntityWorld, FoldMode } from './Entity.ts'
import type { EntitySpec } from '../levels/types.ts'
import type { Point } from '../geom.ts'
import type { Solid } from '../Player.ts'
import {
  COLOR_FOLD_LINE,
  COLOR_FOLD_SHADE,
  FOLDWALL_H,
  FOLDWALL_MS,
  FOLDWALL_THIN_PX,
  FOLD_OUTLINE,
  PARTICLES_FOLDWALL,
  SHAKE_FOLDWALL,
  SHAKE_FOLDWALL_MS,
  TILE,
} from '../constants.ts'

const TIP = FOLDWALL_MS / 1000
const QUARTER = Math.PI / 2

/**
 * A tall paper wall across the floor. A switch in fold mode tips it over
 * around its base crease and it lies down flat.
 *
 * Laid flat it carries NO collision, and that is deliberate rather than an
 * omission. The spec calls for "a thin 4px floor the player can walk over",
 * but the controller has no step-up: moveX snaps flush against any solid
 * face, so a 4px solid lying on the ground would be a 4px wall that stops
 * the player exactly as the standing wall did. The floor underneath is
 * already solid, so dropping the collision is what actually makes it
 * walkable. A fold wall over a gap would not bridge it.
 */
export class FoldWall extends Entity {
  private ctx: EntityContext
  private solid: Solid
  private purple: number
  /** The wall's footprint: base on the floor, top `h` tiles up. */
  private baseY: number
  private topY: number
  private tall: number

  /** 0 standing, 1 flat on the floor. */
  private t = 0
  private tipping = false
  private delay = 0
  private clock = 0
  private solidOn = false

  constructor(spec: EntitySpec, ctx: EntityContext) {
    super(spec, ctx)
    this.ctx = ctx
    this.purple = ctx.palette.fold
    // For a wall, `h` is its height in tiles rather than how high up it
    // sits, which is how the spec's data writes it. Its base rests on
    // `floorH`, defaulting to the main floor.
    this.baseY = ctx.surfaceY(spec.floorH ?? 0)
    this.tall = (spec.h ?? FOLDWALL_H) * TILE
    this.topY = this.baseY - this.tall
    this.solid = { x: this.x, y: this.topY, w: this.w, h: this.tall }
    this.reset()
  }

  /** Is it still blocking the way? */
  isStanding(): boolean {
    return this.solidOn
  }

  /** 0 standing, 1 flat. */
  progress(): number {
    return this.t
  }

  done(): boolean {
    return this.t >= 1
  }

  trigger(delay: number, mode: FoldMode = 'unfold'): void {
    // Only ever folds. Nothing in the spec stands it back up, and a reset
    // is what puts it back.
    if (mode !== 'fold' || this.tipping || this.t >= 1) return
    this.tipping = true
    this.delay = delay
    this.clock = 0
  }

  update(dt: number, world: EntityWorld): void {
    if (!this.tipping) return
    this.clock += dt
    const p = (this.clock - this.delay) / TIP
    if (p <= 0) return
    this.t = Math.min(1, p)
    if (this.t < 1) return

    this.tipping = false
    // Flat: it stops being something to walk into.
    this.setSolid(false)
    world.fx.dust(
      this.x + this.tall / 2,
      this.baseY - FOLDWALL_THIN_PX,
      PARTICLES_FOLDWALL,
      this.purple,
    )
    world.fx.shake(SHAKE_FOLDWALL, SHAKE_FOLDWALL_MS)
    world.fx.sound('fold')
  }

  reset(): void {
    this.tipping = false
    this.clock = 0
    this.delay = 0
    this.t = 0
    this.setSolid(true)
  }

  draw(g: Phaser.GameObjects.Graphics): void {
    if (this.t >= 1) {
      // Lying down: a thin strip along the floor, the length of the wall.
      g.fillStyle(this.purple, 1)
      g.fillRect(this.x, this.baseY - FOLDWALL_THIN_PX, this.tall, FOLDWALL_THIN_PX)
      g.lineStyle(FOLD_OUTLINE, COLOR_FOLD_LINE, 1)
      g.strokeRect(this.x, this.baseY - FOLDWALL_THIN_PX, this.tall, FOLDWALL_THIN_PX)
      return
    }

    // Tipping: the whole wall rotates about the crease at its base, and the
    // fill darkens as it turns, the same angle-based shading the fold
    // platforms use.
    const angle = this.t * QUARTER
    const crease: Point = [this.x + this.w, this.baseY]
    const quad: Point[] = [
      [this.x, this.baseY],
      [this.x + this.w, this.baseY],
      [this.x + this.w, this.topY],
      [this.x, this.topY],
    ].map((p) => rotAbout(p as Point, angle, crease))
    const points = quad.map(([x, y]) => ({ x, y }))

    g.fillStyle(mixColor(this.purple, COLOR_FOLD_SHADE, this.t), 1)
    g.fillPoints(points, true)
    g.lineStyle(FOLD_OUTLINE, COLOR_FOLD_LINE, 1)
    g.strokePoints(points, true)
  }

  serialize(): EntitySnapshot {
    return {
      ...super.serialize(),
      state: { standing: this.solidOn, t: Math.round(this.t * 100) / 100 },
    }
  }

  private setSolid(on: boolean): void {
    if (on === this.solidOn) return
    this.solidOn = on
    if (on) this.ctx.addSolid(this.solid)
    else this.ctx.removeSolid(this.solid)
  }
}
