import * as Phaser from 'phaser'
import type { Input } from './Input.ts'
import {
  ACCEL,
  COLOR_PLAYER,
  DECEL,
  MAX_SPEED,
  PLAYER_H,
  PLAYER_W,
} from './constants.ts'

/** An axis-aligned solid, stored by its top-left corner. */
export type Solid = { x: number; y: number; w: number; h: number }

/**
 * Hand-written controller. Position is the centre of the box; collision is
 * resolved one axis at a time against plain rectangles.
 */
export class Player {
  x: number
  y: number
  vx = 0

  private view: Phaser.GameObjects.Rectangle

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.x = x
    this.y = y
    this.view = scene.add.rectangle(x, y, PLAYER_W, PLAYER_H, COLOR_PLAYER)
  }

  /** `dt` is in seconds. */
  update(dt: number, input: Input, solids: Solid[]): void {
    this.runX(dt, input.dir)
    this.moveX(this.vx * dt, solids)
    this.view.setPosition(this.x, this.y)
  }

  private runX(dt: number, dir: number): void {
    if (dir === 0) {
      // Coast to a stop without overshooting past zero.
      const drop = DECEL * dt
      if (Math.abs(this.vx) <= drop) this.vx = 0
      else this.vx -= Math.sign(this.vx) * drop
      return
    }

    // Turning around brakes at DECEL until velocity crosses zero; once we are
    // moving the way we are pressing, ACCEL takes over. That is the skid.
    const turning = this.vx !== 0 && Math.sign(this.vx) !== dir
    const rate = turning ? DECEL : ACCEL
    this.vx = Phaser.Math.Clamp(this.vx + dir * rate * dt, -MAX_SPEED, MAX_SPEED)
  }

  private moveX(dx: number, solids: Solid[]): void {
    if (dx === 0) return
    this.x += dx

    for (const s of solids) {
      if (!this.overlaps(s)) continue
      // Snap flush to the face we hit, then kill the speed we carried in.
      if (dx > 0) this.x = s.x - PLAYER_W / 2
      else this.x = s.x + s.w + PLAYER_W / 2
      this.vx = 0
    }
  }

  /** Touching exactly flush is not an overlap, so resting counts as clear. */
  private overlaps(s: Solid): boolean {
    return (
      this.x - PLAYER_W / 2 < s.x + s.w &&
      this.x + PLAYER_W / 2 > s.x &&
      this.y - PLAYER_H / 2 < s.y + s.h &&
      this.y + PLAYER_H / 2 > s.y
    )
  }
}
