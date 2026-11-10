import type * as Phaser from 'phaser'
import { Entity } from './Entity.ts'
import { rotAbout } from '../geom.ts'
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
  SLASH_ARC,
  SLASH_MS,
  SLASH_SHAKE,
  SLASH_SHAKE_MS,
  SWORD_LEN,
  SWORD_W,
} from '../constants.ts'

const TAU = Math.PI * 2
const SWIRL = PICKUP_SWIRL_MS / 1000
const SLASH = SLASH_MS / 1000

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
  /** Counts down the swirl, then the slash. */
  private swirl = 0
  private slashT = 0
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

  /** How many separate pieces are on screen: three, or one blade. */
  pieceCount(): number {
    return this.mode === 'sword' ? 1 : PICKUP_PIECES
  }

  isSlashing(): boolean {
    return this.slashT > 0
  }

  update(dt: number, world: EntityWorld): void {
    this.clock += dt
    const box = world.player.box
    const px = (box.left + box.right) / 2
    const py = (box.top + box.bottom) / 2

    if (this.slashT > 0) this.slashT = Math.max(0, this.slashT - dt)

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

    // Only with the blade out: it is a sword slash, and the spec calls it an
    // end-of-level demo.
    if (world.player.slash && this.mode === 'sword' && this.slashT === 0) {
      this.slashT = SLASH
      world.fx.sound('whoosh')
      world.fx.shake(SLASH_SHAKE, SLASH_SHAKE_MS)
    }
  }

  /**
   * Picking the sword up is the payoff for having used every control, so a
   * room reset does not take it back. Only the slash, which is transient,
   * is cleared.
   */
  reset(): void {
    this.slashT = 0
  }

  draw(g: Phaser.GameObjects.Graphics): void {
    if (this.mode === 'sword') {
      this.drawSword(g)
      return
    }

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

  /** One long thin blade, held out to the side, sweeping during a slash. */
  private drawSword(g: Phaser.GameObjects.Graphics): void {
    // Rest angle is horizontal; a slash sweeps it through SLASH_ARC.
    const done = this.slashT > 0 ? 1 - this.slashT / SLASH : 0
    const a = -SLASH_ARC / 2 + SLASH_ARC * done
    const o: Point = [this.center[0], this.center[1]]
    const tip: Point = [o[0] + SWORD_LEN, o[1]]
    const backA: Point = [o[0], o[1] - SWORD_W / 2]
    const backB: Point = [o[0], o[1] + SWORD_W / 2]
    const p0 = rotAbout(tip, a, o)
    const p1 = rotAbout(backA, a, o)
    const p2 = rotAbout(backB, a, o)

    g.fillStyle(COLOR_FORM, 1)
    g.fillTriangle(p0[0], p0[1], p1[0], p1[1], p2[0], p2[1])
    g.lineStyle(FOLD_OUTLINE, COLOR_INK, 1)
    g.strokeTriangle(p0[0], p0[1], p1[0], p1[1], p2[0], p2[1])
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
