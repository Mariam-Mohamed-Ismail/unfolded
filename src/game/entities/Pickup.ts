import type * as Phaser from 'phaser'
import { Entity } from './Entity.ts'
import type { EntityContext, EntitySnapshot, EntityWorld } from './Entity.ts'
import type { EntitySpec } from '../levels/types.ts'
import type { Point } from '../geom.ts'
import {
  COLOR_FORM,
  COLOR_INK,
  FOLD_OUTLINE,
  PARTICLES_FOLD_OPEN,
  PICKUP_CARRY_R,
  PICKUP_ORBIT_HZ,
  PICKUP_ORBIT_R,
  PICKUP_PIECES,
  PICKUP_PIECE_PX,
  PICKUP_REACH,
  PICKUP_SWIRL_MS,
} from '../constants.ts'

const TAU = Math.PI * 2
const SWIRL = PICKUP_SWIRL_MS / 1000

type Mode = 'anchored' | 'swirling' | 'orbiting' | 'sword'

/**
 * The sword pieces: three teal triangles that orbit a point until you touch
 * them, then orbit you, then fold into a blade on R.
 *
 * One entity with three parts rather than three entities, because "three
 * triangles orbiting a point" is one thing. It draws itself around the
 * player from the box in the world view, so neither Player nor PlayerView
 * knows the sword exists.
 */
export class Pickup extends Entity {
  private mode: Mode = 'anchored'
  private clock = 0
  private swirl = 0
  /** Where the pieces orbit: the anchor, or the player. */
  private center: Point

  constructor(spec: EntitySpec, ctx: EntityContext) {
    super(spec, ctx)
    this.center = [this.centerX(), this.y]
  }

  /** Carried or folded: the lesson "touch the pieces" is done. */
  done(): boolean {
    return this.mode === 'orbiting' || this.mode === 'sword'
  }

  isSword(): boolean {
    return this.mode === 'sword'
  }

  /** Sword.ts draws the blade and swings it; this just reports it is out. */
  swordOut(): boolean {
    return this.mode === 'sword'
  }

  /** How many separate pieces are on screen: three, or one blade. */
  pieceCount(): number {
    return this.mode === 'sword' ? 1 : PICKUP_PIECES
  }

  update(dt: number, world: EntityWorld): void {
    this.clock += dt
    const box = world.player.box
    const px = (box.left + box.right) / 2
    const py = (box.top + box.bottom) / 2

    if (this.mode === 'anchored') {
      // Distance from the anchor to the nearest point of the player's box,
      // so walking underneath is enough rather than lining up a centre.
      const nx = Math.max(box.left, Math.min(this.center[0], box.right))
      const ny = Math.max(box.top, Math.min(this.center[1], box.bottom))
      const reach = Math.hypot(this.center[0] - nx, this.center[1] - ny)
      if (reach <= PICKUP_REACH) {
        this.mode = 'swirling'
        this.swirl = SWIRL
        world.fx.zoom()
        world.fx.sound('pickup')
        world.fx.dust(this.center[0], this.center[1], PARTICLES_FOLD_OPEN, COLOR_FORM)
      }
      return
    }

    if (this.mode === 'swirling') {
      this.swirl = Math.max(0, this.swirl - dt)
      // The gather: the orbit centre slides from the anchor onto the player.
      const t = 1 - this.swirl / SWIRL
      this.center = [
        this.center[0] + (px - this.center[0]) * t,
        this.center[1] + (py - this.center[1]) * t,
      ]
      if (this.swirl === 0) this.mode = 'orbiting'
      return
    }

    // Carried: the pieces, or the blade, follow the player.
    this.center = [px, py]

    if (world.player.sword) {
      this.mode = this.mode === 'sword' ? 'orbiting' : 'sword'
      world.fx.sound('whoosh')
    }

  }

  /**
   * Picking the sword up is the payoff for having used every control, so a
   * room reset does not take it back.
   */
  reset(): void {}

  draw(g: Phaser.GameObjects.Graphics): void {
    // With the blade out there are no loose pieces to draw: they are the
    // blade, and Sword.ts draws that.
    if (this.mode === 'sword') return

    const spin = this.clock * PICKUP_ORBIT_HZ * TAU
    const r = this.mode === 'orbiting' ? PICKUP_CARRY_R : PICKUP_ORBIT_R
    g.fillStyle(COLOR_FORM, 1)
    g.lineStyle(FOLD_OUTLINE, COLOR_INK, 1)
    for (let i = 0; i < PICKUP_PIECES; i++) {
      const a = spin + (i / PICKUP_PIECES) * TAU
      const x = this.center[0] + Math.cos(a) * r
      const y = this.center[1] + Math.sin(a) * r
      triangle(g, x, y, PICKUP_PIECE_PX, a * 2, true)
    }
  }

  serialize(): EntitySnapshot {
    return {
      ...super.serialize(),
      state: { mode: this.mode, pieces: this.pieceCount() },
    }
  }

}

function triangle(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  a: number,
  outline: boolean,
): void {
  const ax = x + Math.cos(a) * r
  const ay = y + Math.sin(a) * r
  const bx = x + Math.cos(a + TAU / 3) * r
  const by = y + Math.sin(a + TAU / 3) * r
  const cx = x + Math.cos(a + (TAU * 2) / 3) * r
  const cy = y + Math.sin(a + (TAU * 2) / 3) * r
  g.fillTriangle(ax, ay, bx, by, cx, cy)
  if (outline) g.strokeTriangle(ax, ay, bx, by, cx, cy)
}
