import type * as Phaser from 'phaser'
import { Entity } from './Entity.ts'
import { pulse } from '../geom.ts'
import type { EntityContext, EntitySnapshot, EntityWorld } from './Entity.ts'
import type { EntitySpec } from '../levels/types.ts'
import type { Solid } from '../Player.ts'
import {
  CHEVRON_H,
  CHEVRON_INSET,
  CHEVRON_W,
  COLOR_FORM,
  COLOR_INK,
  COLOR_SOLID,
  FOLD_OUTLINE,
  PULSE_DEPTH,
  PULSE_HZ,
  SLIT_GLOW_WIDTH,
  SLIT_H,
  SLIT_PILLAR_H,
} from '../constants.ts'

/**
 * A pillar with a gap under it: too tall to jump, too low to walk through,
 * so the only way past is flat.
 *
 * This is the first solid in the game that does not reach the bottom of the
 * world. A SolidSpec always runs from its top surface down to the world
 * floor — that is how a pit works — so a gap *underneath* cannot be
 * expressed in level data at all, and the pillar owns its own box instead.
 */
export class Slit extends Entity {
  private solid: Solid
  /** The opening: floor level down to the pillar's underside. */
  private slotTop: number
  private slotBottom: number
  private used = false
  private clock = 0

  constructor(spec: EntitySpec, ctx: EntityContext) {
    super(spec, ctx)
    const top = ctx.surfaceY(spec.topH ?? SLIT_PILLAR_H)
    const clearance = spec.clearancePx ?? SLIT_H
    // `y` is the surface the pillar stands over, from Entity.
    this.slotBottom = this.y
    this.slotTop = this.y - clearance
    this.solid = { x: this.x, y: top, w: this.w, h: this.slotTop - top }
    // A pillar never changes, so it goes in once and stays.
    ctx.addSolid(this.solid)
  }

  /** The clearance under it, in pixels. */
  clearance(): number {
    return this.slotBottom - this.slotTop
  }

  /** Has the player been through? The glow stops once they have. */
  isUsed(): boolean {
    return this.used
  }

  update(dt: number, world: EntityWorld): void {
    this.clock += dt
    if (this.used) return
    const box = world.player.box
    // Inside the slot: overlapping it horizontally, and low enough to be in
    // the gap rather than standing on top of the pillar.
    if (
      box.right > this.x &&
      box.left < this.x + this.w &&
      box.bottom > this.slotTop &&
      box.top < this.slotBottom
    ) {
      this.used = true
    }
  }

  reset(): void {
    // Unlike a prompt, a glow is an affordance rather than something learnt,
    // so a room restore puts it back.
    this.used = false
    this.clock = 0
  }

  draw(g: Phaser.GameObjects.Graphics): void {
    const s = this.solid

    // The pillar, in the same green as every other platform. The spec wants
    // cream paper here, but one cream pillar in a green level looks broken:
    // that palette change belongs to every platform at once.
    g.fillStyle(COLOR_SOLID, 1)
    g.fillRect(s.x, s.y, s.w, s.h)
    g.lineStyle(FOLD_OUTLINE, COLOR_INK, 1)
    g.strokeRect(s.x, s.y, s.w, s.h)

    // The opening, outlined in teal and glowing until it has been used.
    const glow = this.used ? 0.55 : pulse(this.clock, PULSE_HZ, PULSE_DEPTH)
    g.lineStyle(SLIT_GLOW_WIDTH, COLOR_FORM, glow)
    g.lineBetween(this.x, this.slotTop, this.x + this.w, this.slotTop)
    g.lineBetween(this.x, this.slotBottom, this.x + this.w, this.slotBottom)

    // A chevron at each end, pointing through. The spec names one; one per
    // end reads from either side, and you can walk back.
    const mid = (this.slotTop + this.slotBottom) / 2
    this.chevron(g, this.x + CHEVRON_INSET, mid, 1)
    this.chevron(g, this.x + this.w - CHEVRON_INSET, mid, -1)
  }

  serialize(): EntitySnapshot {
    return {
      ...super.serialize(),
      state: { clearance: this.clearance(), used: this.used },
    }
  }

  /** A `>` pointing in `dir`, centred on (x, y). */
  private chevron(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    dir: number,
  ): void {
    const half = CHEVRON_H / 2
    g.lineBetween(x - (CHEVRON_W / 2) * dir, y - half, x + (CHEVRON_W / 2) * dir, y)
    g.lineBetween(x + (CHEVRON_W / 2) * dir, y, x - (CHEVRON_W / 2) * dir, y + half)
  }
}
