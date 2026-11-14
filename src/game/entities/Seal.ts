import type * as Phaser from 'phaser'
import { Entity } from './Entity.ts'
import { drawTag, drawTagText, tagBox } from '../ui/tag.ts'
import type { TagBox } from '../ui/tag.ts'
import { pulse } from '../geom.ts'
import type { Box, EntityContext, EntitySnapshot, EntityWorld } from './Entity.ts'
import type { EntitySpec } from '../levels/types.ts'
import type { Solid } from '../Player.ts'
import {
  COLOR_INK,
  FOLD_OUTLINE,
  PARTICLES_SEAL,
  PROMPT_LIFT,
  PULSE_DEPTH,
  PULSE_HZ,
  SEAL_CROSS_GAP,
  SEAL_REACH,
  SEAL_SHAKE,
  SEAL_SHAKE_MS,
  SEAL_TAPE_PX,
  SEAL_TOP_H,
  TILE,
} from '../constants.ts'

/**
 * A strip of teal paper tape sealing a passage, floor to ceiling block.
 *
 * Only the sword cuts it, and that needs no guard: hurtBox() and hurt() are
 * the Hittable contract, and Sword is the only thing that calls them.
 */
export class Seal extends Entity {
  private ctx: EntityContext
  private solid: Solid
  private teal: number
  private baseY: number
  private topY: number
  private cut = false
  /** Set by hurt(), spent by the next update, which has the effects. */
  private justCut = false
  private clock = 0
  /** What the prompt said last frame, so the label can be cleared. */
  private showing = false
  /** Remembered so draw() can put paper behind the words update() asked for. */
  private lastTag: { box: TagBox; keys: string[] } | null = null

  constructor(spec: EntitySpec, ctx: EntityContext) {
    super(spec, ctx)
    this.ctx = ctx
    this.teal = ctx.palette.form
    this.baseY = ctx.surfaceY(spec.floorH ?? 0)
    this.topY = ctx.surfaceY(spec.topH ?? SEAL_TOP_H)
    this.solid = {
      x: this.x,
      y: this.topY,
      w: this.w,
      h: this.baseY - this.topY,
    }
    ctx.addSolid(this.solid)
  }

  isCut(): boolean {
    return this.cut
  }

  /** Glowing means: the blade is out and you are close enough. */
  isGlowing(): boolean {
    return this.showing && !this.cut
  }

  hurtBox(): Box | null {
    if (this.cut) return null
    return {
      left: this.x,
      right: this.x + this.w,
      top: this.topY,
      bottom: this.baseY,
    }
  }

  /**
   * One hit and it is gone. Returns false, so the sword knows there is
   * nothing left to knock back.
   *
   * The collision comes off here rather than next frame because the spec
   * says immediately; the noise and the shards wait for update(), which is
   * the only place with fx.
   */
  hurt(_dir: number): boolean {
    if (this.cut) return false
    this.cut = true
    this.justCut = true
    this.ctx.removeSolid(this.solid)
    return false
  }

  update(dt: number, world: EntityWorld): void {
    this.clock += dt

    if (this.justCut) {
      this.justCut = false
      const mid = (this.topY + this.baseY) / 2
      world.fx.dust(this.centerX(), mid, PARTICLES_SEAL, this.teal)
      world.fx.shake(SEAL_SHAKE, SEAL_SHAKE_MS)
      world.fx.sound('tear')
      this.showing = false
      return
    }
    if (this.cut) return

    // The prompt changes with the blade: something to do, or something to
    // draw first.
    const box = world.player.box
    const px = (box.left + box.right) / 2
    const near = Math.abs(px - this.centerX()) <= SEAL_REACH * TILE
    this.showing = near && world.swordOut
    if (!near) return

    const words = this.showing ? 'cut it' : 'draw the sword'
    const keys = this.showing ? [] : ['R']
    drawTagText(world.fx, this.id, this.tag(words, keys), words, keys, 1)
  }

  reset(): void {
    if (this.cut) {
      this.cut = false
      this.ctx.addSolid(this.solid)
    }
    this.justCut = false
    this.showing = false
  }

  draw(g: Phaser.GameObjects.Graphics): void {
    if (this.cut) return

    // The tape: a teal strip with a cross pattern up it. Glows when the
    // blade is out and you are in reach.
    const glow = this.isGlowing() ? pulse(this.clock, PULSE_HZ, PULSE_DEPTH) : 0.85
    g.fillStyle(this.teal, glow)
    g.fillRect(this.x, this.topY, this.w, this.baseY - this.topY)
    g.lineStyle(FOLD_OUTLINE, COLOR_INK, 1)
    g.strokeRect(this.x, this.topY, this.w, this.baseY - this.topY)

    g.lineStyle(SEAL_TAPE_PX, COLOR_INK, 0.4)
    for (let y = this.topY; y < this.baseY; y += SEAL_CROSS_GAP) {
      const to = Math.min(y + SEAL_CROSS_GAP, this.baseY)
      g.lineBetween(this.x, y, this.x + this.w, to)
      g.lineBetween(this.x + this.w, y, this.x, to)
    }

    // The prompt's paper, if one is up. Its words went out in update().
    const box = this.lastTag
    if (box) drawTag(g, box.box, box.keys, 1)
  }

  serialize(): EntitySnapshot {
    return {
      ...super.serialize(),
      state: { cut: this.cut, glowing: this.isGlowing() },
    }
  }

  private tag(words: string, keys: string[]): TagBox {
    const box = tagBox(this.centerX(), this.topY - PROMPT_LIFT / 2, words, keys)
    this.lastTag = { box, keys }
    return box
  }
}
