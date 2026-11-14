import type * as Phaser from 'phaser'
import { Entity } from './Entity.ts'
import type { Box, EntityContext, EntitySnapshot, EntityWorld } from './Entity.ts'
import type { EntitySpec } from '../levels/types.ts'
import {
  COLOR_INK,
  COLOR_PAPER,
  DUMMY_FRICTION,
  DUMMY_H,
  DUMMY_HEALTH,
  DUMMY_W,
  FOLD_OUTLINE,
  HIT_FLASH_MS,
  PARTICLES_HIT,
} from '../constants.ts'

const FLASH = HIT_FLASH_MS / 1000

/**
 * A training dummy: a paper post that takes sword hits so the swing can be
 * tested before there is anything real to cut.
 *
 * TEMPORARY. To remove it, delete its one line from level2.ts; nothing else
 * refers to it. This file and its line in createRegistry() can go too, but
 * leaving them costs nothing and keeps a target around.
 */
export class Dummy extends Entity {
  private health: number
  private maxHealth: number
  /** Slid sideways by knockback, decaying back to a stop. */
  private driftX = 0
  private vx = 0
  private flash = 0
  private broken = false
  private baseY: number

  constructor(spec: EntitySpec, ctx: EntityContext) {
    super(spec, ctx)
    this.maxHealth = spec.health ?? DUMMY_HEALTH
    this.health = this.maxHealth
    this.baseY = this.y
  }

  alive(): boolean {
    return this.health > 0
  }

  hits(): number {
    return this.health
  }

  isFlashing(): boolean {
    return this.flash > 0
  }

  /** Where it is standing right now, knockback included. */
  hurtBox(): Box | null {
    if (this.health <= 0) return null
    const cx = this.centerX() + this.driftX
    return {
      left: cx - DUMMY_W / 2,
      right: cx + DUMMY_W / 2,
      top: this.baseY - DUMMY_H,
      bottom: this.baseY,
    }
  }

  hurt(_dir: number): boolean {
    if (this.health <= 0) return false
    this.health--
    this.flash = FLASH
    return this.health > 0
  }

  knock(vx: number): void {
    this.vx = vx
  }

  update(dt: number, world: EntityWorld): void {
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt)

    if (this.vx !== 0) {
      this.driftX += this.vx * dt
      const drop = DUMMY_FRICTION * dt
      if (Math.abs(this.vx) <= drop) this.vx = 0
      else this.vx -= Math.sign(this.vx) * drop
    }

    // Breaking up is a one-off, so it happens the frame after the last hit
    // rather than inside hurt(), which has no access to the effects.
    if (this.health === 0 && !this.broken) {
      this.broken = true
      const box = {
        x: this.centerX() + this.driftX,
        y: this.baseY - DUMMY_H / 2,
      }
      world.fx.dust(box.x, box.y, PARTICLES_HIT * 2, COLOR_PAPER)
      world.fx.sound('hit')
    }
  }


  reset(): void {
    this.health = this.maxHealth
    this.driftX = 0
    this.vx = 0
    this.flash = 0
    this.broken = false
  }

  draw(g: Phaser.GameObjects.Graphics): void {
    if (this.health <= 0) return
    const box = this.hurtBox()
    if (!box) return

    // White while it is flashing, cream otherwise.
    g.fillStyle(this.flash > 0 ? 0xffffff : COLOR_PAPER, 1)
    g.fillRect(box.left, box.top, DUMMY_W, DUMMY_H)
    g.lineStyle(FOLD_OUTLINE, COLOR_INK, 1)
    g.strokeRect(box.left, box.top, DUMMY_W, DUMMY_H)

    // A cross on the post, and one notch per hit taken.
    const cx = (box.left + box.right) / 2
    g.lineBetween(box.left + 4, box.top + 10, box.right - 4, box.top + 24)
    g.lineBetween(box.right - 4, box.top + 10, box.left + 4, box.top + 24)
    for (let i = 0; i < this.maxHealth - this.health; i++) {
      const y = box.bottom - 8 - i * 7
      g.lineBetween(cx - 6, y, cx + 6, y)
    }
  }

  serialize(): EntitySnapshot {
    return {
      ...super.serialize(),
      state: { health: this.health, flashing: this.flash > 0 },
    }
  }
}
