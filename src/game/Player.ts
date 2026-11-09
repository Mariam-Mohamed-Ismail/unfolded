import * as Phaser from 'phaser'
import type { Input } from './Input.ts'
import {
  ACCEL,
  AIR_ACCEL,
  AIR_DECEL,
  COLOR_PLAYER,
  COYOTE_MS,
  DASH_COOLDOWN,
  DASH_FREEZE,
  DASH_SPEED,
  DASH_TIME,
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
const DASH = DASH_TIME / 1000
const DASH_WAIT = DASH_COOLDOWN / 1000
const FREEZE = DASH_FREEZE / 1000

// Subtracting dt repeatedly leaves float residue (1/60 is not exact in
// binary), which would keep a spent timer barely above zero for one extra
// frame. Snap that residue away.
const EPS = 1e-9

/** Counts a timer down to zero, never past it. */
function tick(timer: number, dt: number): number {
  const left = timer - dt
  return left < EPS ? 0 : left
}

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
  facing = 1

  private coyote = 0
  private buffer = 0
  private freeze = 0
  private dashing = 0
  private dashWait = 0
  private airDashUsed = false
  private view: Phaser.GameObjects.Rectangle

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.x = x
    this.y = y
    this.view = scene.add.rectangle(x, y, PLAYER_W, PLAYER_H, COLOR_PLAYER)
  }

  /** `dt` is in seconds. */
  update(dt: number, input: Input, solids: Solid[]): void {
    if (input.dir !== 0) this.facing = input.dir
    if (this.grounded) this.airDashUsed = false
    this.dashWait = tick(this.dashWait, dt)

    // The buffer keeps ticking through freeze and dash, so a jump pressed
    // mid-dash is not swallowed.
    this.tickBuffer(dt, input)

    if (this.freeze > 0) {
      this.freeze = tick(this.freeze, dt)
      this.grounded = this.onGround(solids)
      this.view.setPosition(this.x, this.y)
      return
    }

    if (this.dashing > 0) {
      this.dash(dt, solids)
      this.view.setPosition(this.x, this.y)
      return
    }

    if (this.startDash(input)) {
      this.view.setPosition(this.x, this.y)
      return
    }

    this.runX(dt, input.dir)
    this.jump(dt)
    this.gravity(dt)

    this.moveX(this.vx * dt, solids)
    this.moveY(this.vy * dt, solids)

    this.view.setPosition(this.x, this.y)
  }

  // --- dash ---

  /** Begins the freeze that precedes the dash. True if a dash started. */
  private startDash(input: Input): boolean {
    if (!input.dashPressed) return false
    if (this.dashWait > 0) return false
    // One air dash per trip off the ground; landing clears it.
    if (!this.grounded && this.airDashUsed) return false

    if (!this.grounded) this.airDashUsed = true
    this.freeze = FREEZE
    this.dashing = DASH
    this.vx = 0
    this.vy = 0
    return true
  }

  private dash(dt: number, solids: Solid[]): void {
    // Spend only the time the dash has left. Without this the final frame
    // runs in full and the dash overshoots DASH_TIME by up to one frame, so
    // the distance travelled would depend on the frame rate.
    const step = Math.min(dt, this.dashing)
    this.dashing = tick(this.dashing, step)

    // Flat and gravity-free, so the line reads clearly.
    this.vx = DASH_SPEED * this.facing
    this.vy = 0
    this.moveX(this.vx * step, solids)
    // No vertical move happens, so ask the ground directly rather than
    // inferring it from a resolution that never runs.
    this.grounded = this.onGround(solids)

    if (this.dashing === 0) {
      this.vx = Phaser.Math.Clamp(this.vx, -MAX_SPEED, MAX_SPEED)
      // The cooldown runs from the end of the dash, not the start.
      this.dashWait = DASH_WAIT
    }
  }

  // --- run and jump ---

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

  private tickBuffer(dt: number, input: Input): void {
    // Set by the press edge only, so holding jump cannot refill it.
    if (input.jumpPressed) this.buffer = JUMP_BUFFER
    else this.buffer = tick(this.buffer, dt)

    // Letting go on the way up keeps 45% of the rise.
    if (input.jumpReleased && this.vy < 0) this.vy *= JUMP_CUT
  }

  private jump(dt: number): void {
    // Coyote refills while grounded and drains in the air, so it is already
    // full the moment you step off an edge.
    if (this.grounded) this.coyote = COYOTE
    else this.coyote = tick(this.coyote, dt)

    if (this.buffer > 0 && this.coyote > 0) {
      this.vy = JUMP_VELOCITY
      // Spend both: the buffer so one press is one jump, the coyote so a jump
      // off a ledge cannot be taken twice.
      this.buffer = 0
      this.coyote = 0
      this.grounded = false
    }
  }

  private gravity(dt: number): void {
    // Heavier on the way down, which is what makes the arc feel snappy.
    const g = this.vy > 0 ? GRAVITY * FALL_GRAVITY_MULT : GRAVITY
    this.vy = Math.min(this.vy + g * dt, MAX_FALL_SPEED)
  }

  // --- collision ---

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

  /** Is there a solid directly underfoot? Used when no vertical move runs. */
  private onGround(solids: Solid[]): boolean {
    for (const s of solids) {
      if (this.overlaps(s, this.x, this.y + 1)) return true
    }
    return false
  }

  /** Touching exactly flush is not an overlap, so resting counts as clear. */
  private overlaps(s: Solid, x = this.x, y = this.y): boolean {
    return (
      x - PLAYER_W / 2 < s.x + s.w &&
      x + PLAYER_W / 2 > s.x &&
      y - PLAYER_H / 2 < s.y + s.h &&
      y + PLAYER_H / 2 > s.y
    )
  }
}
