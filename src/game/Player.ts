import * as Phaser from 'phaser'
import type { Input } from './Input.ts'
import {
  ACCEL,
  AIR_ACCEL,
  AIR_DECEL,
  COLOR_PLAYER,
  COYOTE_MS,
  DECEL,
  FALL_GRAVITY_MULT,
  GRAVITY,
  JUMP_BUFFER_MS,
  JUMP_CUT,
  JUMP_VELOCITY,
  MAX_FALL_SPEED,
  MAX_SPEED,
  PLAYER_H,
  PLAYER_W,
} from './constants.ts'

// The constants are in milliseconds because that is the unit you tune in.
// Converted once, here, so `dt` is the only unit inside the controller.
const COYOTE = COYOTE_MS / 1000
const JUMP_BUFFER = JUMP_BUFFER_MS / 1000

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
  vy = 0
  grounded = false

  private coyote = 0
  private buffer = 0
  private view: Phaser.GameObjects.Rectangle

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.x = x
    this.y = y
    this.view = scene.add.rectangle(x, y, PLAYER_W, PLAYER_H, COLOR_PLAYER)
  }

  /** `dt` is in seconds. */
  update(dt: number, input: Input, solids: Solid[]): void {
    this.runX(dt, input.dir)
    this.jump(dt, input)
    this.gravity(dt)

    this.moveX(this.vx * dt, solids)
    this.moveY(this.vy * dt, solids)

    this.view.setPosition(this.x, this.y)
  }

  private runX(dt: number, dir: number): void {
    const accel = this.grounded ? ACCEL : AIR_ACCEL
    const decel = this.grounded ? DECEL : AIR_DECEL

    if (dir === 0) {
      // Coast to a stop without overshooting past zero.
      const drop = decel * dt
      if (Math.abs(this.vx) <= drop) this.vx = 0
      else this.vx -= Math.sign(this.vx) * drop
      return
    }

    // Turning around brakes at decel until velocity crosses zero; once we are
    // moving the way we are pressing, accel takes over. That is the skid.
    const turning = this.vx !== 0 && Math.sign(this.vx) !== dir
    const rate = turning ? decel : accel
    this.vx = Phaser.Math.Clamp(this.vx + dir * rate * dt, -MAX_SPEED, MAX_SPEED)
  }

  private jump(dt: number, input: Input): void {
    // Coyote refills while grounded and drains in the air, so it is already
    // full the moment you step off an edge.
    if (this.grounded) this.coyote = COYOTE
    else this.coyote = Math.max(0, this.coyote - dt)

    // The buffer is set by the press edge only, so holding jump cannot refill
    // it. It drains whether or not you are airborne.
    if (input.jumpPressed) this.buffer = JUMP_BUFFER
    else this.buffer = Math.max(0, this.buffer - dt)

    if (this.buffer > 0 && this.coyote > 0) {
      this.vy = JUMP_VELOCITY
      // Spend both: the buffer so one press is one jump, the coyote so a jump
      // off a ledge cannot be taken twice.
      this.buffer = 0
      this.coyote = 0
      this.grounded = false
    }

    // Letting go on the way up keeps 45% of the rise. Tap for a hop, hold for
    // the full jump.
    if (input.jumpReleased && this.vy < 0) this.vy *= JUMP_CUT
  }

  private gravity(dt: number): void {
    // Heavier on the way down, which is what makes the arc feel snappy.
    const g = this.vy > 0 ? GRAVITY * FALL_GRAVITY_MULT : GRAVITY
    this.vy = Math.min(this.vy + g * dt, MAX_FALL_SPEED)
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

  private moveY(dy: number, solids: Solid[]): void {
    // Only a real vertical move can change whether we are standing on
    // something, so a zero move leaves `grounded` alone.
    if (dy === 0) return
    this.grounded = false
    this.y += dy

    for (const s of solids) {
      if (!this.overlaps(s)) continue
      if (dy > 0) {
        this.y = s.y - PLAYER_H / 2
        this.grounded = true
      } else {
        this.y = s.y + s.h + PLAYER_H / 2
      }
      this.vy = 0
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
