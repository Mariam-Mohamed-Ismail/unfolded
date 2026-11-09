import * as Phaser from 'phaser'
import type { Input } from './Input.ts'
import { PlayerView } from './PlayerView.ts'
import {
  ACCEL,
  AIR_ACCEL,
  AIR_DECEL,
  APEX_BAND,
  COYOTE_MS,
  DASH_TAIL_MS,
  DASH_TAIL_MULT,
  DASH_STRETCH_X,
  DASH_STRETCH_Y,
  DASH_COOLDOWN,
  DASH_FREEZE,
  DASH_SPEED,
  DASH_TIME,
  DECEL,
  FALL_GRAVITY_MULT,
  GRAVITY,
  JUMP_BUFFER_MS,
  JUMP_CUT,
  JUMP_STRETCH_X,
  JUMP_STRETCH_Y,
  IDLE_SPEED,
  JUMP_VELOCITY,
  LAND_SQUASH_X,
  LAND_SQUASH_Y,
  LAND_STATE_MS,
  MAX_FALL_SPEED,
  MAX_SPEED,
  PLAYER_FLAT_H,
  PLAYER_FLAT_W,
  PLAYER_H,
  PLAYER_W,
} from './constants.ts'

// Folding keeps the feet planted, so the centre moves by half the height lost.
const FOLD_SHIFT = (PLAYER_H - PLAYER_FLAT_H) / 2

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

const DASH_TAIL = DASH_TAIL_MS / 1000
const LAND_HOLD = LAND_STATE_MS / 1000

/** The spec's nine states. */
export type PlayerState =
  | 'idle'
  | 'run'
  | 'skid'
  | 'jumpUp'
  | 'apex'
  | 'fall'
  | 'land'
  | 'dash'
  | 'flat'

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
  flat = false

  state: PlayerState = 'fall'

  private coyote = 0
  private buffer = 0
  private dashTail = 0
  private dashDir = 1
  private landHold = 0
  private dir = 0
  private freeze = 0
  private dashing = 0
  private dashWait = 0
  private airDashUsed = false

  // Set during update, read by the scene afterwards, cleared next frame.
  // Keeps effects out of the controller without it knowing they exist.
  justJumped = false
  justLanded = false
  justDashed = false
  justFolded = false
  justStood = false
  /** Downward speed at the moment of the last landing. */
  landSpeed = 0

  readonly view: PlayerView

  /**
    * `solids` is optional only so tests can build a player without a world.
    * Pass it: without it the player starts airborne, and the first frame
    * registers a landing it did not make.
    */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    solids: Solid[] = [],
  ) {
    this.x = x
    this.y = y
    this.view = new PlayerView(scene)
    this.grounded = this.onGround(solids)
  }

  /** Internal timers, for the debug overlay only. */
  debugInfo(): {
    state: PlayerState
    coyote: number
    buffer: number
    dashWait: number
    dashing: number
  } {
    return {
      state: this.state,
      coyote: this.coyote,
      buffer: this.buffer,
      dashWait: this.dashWait,
      dashing: this.dashing,
    }
  }

  /**
   * True during the dash hitstop. The scene holds its own effects still for
   * the same window, so what you see is the whole game stopping.
   */
  frozen(): boolean {
    return this.freeze > 0
  }

  /** Where the feet are. The view is drawn and scaled from this point. */
  footY(): number {
    return this.y + this.halfH()
  }

  /** Drops the player back at a spawn point with no state carried over. */
  reset(x: number, y: number, solids: Solid[] = []): void {
    this.x = x
    this.y = y
    this.vx = 0
    this.vy = 0
    // Ask the ground rather than assuming we are falling, so spawning with
    // your feet on the floor does not count as a landing.
    this.grounded = this.onGround(solids)
    this.facing = 1
    // Stale timers would otherwise let you dash or jump out of the respawn.
    this.coyote = 0
    this.buffer = 0
    this.freeze = 0
    this.dashing = 0
    this.dashWait = 0
    this.dashTail = 0
    this.dashDir = 1
    this.landHold = 0
    this.airDashUsed = false
    this.state = 'fall'
    this.flat = false
    this.view.setForm(false)
    this.clearEvents()
    this.view.update(0, x, this.footY(), this.facing)
  }

  private clearEvents(): void {
    this.justJumped = false
    this.justLanded = false
    this.justDashed = false
    this.justFolded = false
    this.justStood = false
  }

  /** `dt` is in seconds. */
  update(dt: number, input: Input, solids: Solid[]): void {
    this.clearEvents()
    this.dir = input.dir
    if (input.dir !== 0) this.facing = input.dir
    this.landHold = tick(this.landHold, dt)
    if (this.grounded) this.airDashUsed = false
    this.updateForm(input, solids)
    this.dashWait = tick(this.dashWait, dt)

    // The buffer keeps ticking through freeze and dash, so a jump pressed
    // mid-dash is not swallowed.
    this.tickBuffer(dt, input)

    if (this.freeze > 0) {
      this.freeze = tick(this.freeze, dt)
      this.grounded = this.onGround(solids)
      this.transition()
      this.syncView(dt)
      return
    }

    if (this.dashing > 0) {
      this.dash(dt, solids)
      this.transition()
      this.syncView(dt)
      return
    }

    if (this.startDash(input)) {
      // Count this frame as the first of the hitstop, rather than spending a
      // whole extra frame getting there.
      this.freeze = tick(this.freeze, dt)
      this.transition()
      this.syncView(dt)
      return
    }

    // The tail: speed is held, input ignored, but gravity and collision run
    // as normal so you can still fall out of a dash.
    if (this.dashTail > 0) {
      this.dashTail = tick(this.dashTail, dt)
      this.vx = DASH_SPEED * DASH_TAIL_MULT * this.dashDir
    } else {
      this.runX(dt, input.dir)
    }
    this.jump(dt)
    this.gravity(dt)

    this.moveX(this.vx * dt, solids)
    this.moveY(this.vy * dt, solids)

    this.transition()
    this.syncView(dt)
  }

  // --- state machine ---

  /**
   * Picks the state from physics that has already run this frame, so the
   * machine describes the movement rather than driving it. Order is
   * priority: the exclusive states win over the descriptive ones.
   */
  private transition(): void {
    const next = this.pick()
    if (next === this.state) return
    EXIT[this.state]?.(this)
    this.state = next
    ENTER[next]?.(this)
  }

  private pick(): PlayerState {
    if (this.flat) return 'flat'
    if (this.freeze > 0 || this.dashing > 0 || this.dashTail > 0) return 'dash'

    if (!this.grounded) {
      if (Math.abs(this.vy) < APEX_BAND) return 'apex'
      return this.vy < 0 ? 'jumpUp' : 'fall'
    }

    if (this.landHold > 0) return 'land'
    // Pressing against your own momentum is a skid, which is where the
    // DECEL number shows itself.
    if (this.dir !== 0 && this.vx !== 0 && Math.sign(this.vx) !== this.dir) {
      return 'skid'
    }
    return Math.abs(this.vx) < IDLE_SPEED && this.dir === 0 ? 'idle' : 'run'
  }

  /** Squash and stretch act on the drawing only; the hitbox never changes. */
  private syncView(dt: number): void {
    this.view.update(dt, this.x, this.footY(), this.facing)
  }

  // --- dash ---

  /** Begins the freeze that precedes the dash. True if a dash started. */
  private startDash(input: Input): boolean {
    if (!input.dashPressed) return false
    if (this.dashWait > 0) return false
    // One air dash per trip off the ground; landing clears it.
    if (!this.grounded && this.airDashUsed) return false

    if (!this.grounded) this.airDashUsed = true
    this.justDashed = true
    // Latch the direction now. Reading facing live would let you steer or
    // even reverse a dash in flight by turning around.
    this.dashDir = this.facing
    this.dashTail = 0
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
    this.vx = DASH_SPEED * this.dashDir
    this.vy = 0
    this.moveX(this.vx * step, solids)
    // No vertical move happens, so ask the ground directly rather than
    // inferring it from a resolution that never runs.
    this.grounded = this.onGround(solids)

    if (this.dashing === 0) {
      // Not a clamp to MAX_SPEED any more: the spec keeps 40% of the dash
      // speed for a moment afterwards.
      this.vx = DASH_SPEED * DASH_TAIL_MULT * this.dashDir
      this.dashTail = DASH_TAIL
      // The cooldown runs from the end of the dash, not the end of the tail.
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

    // No jumping while folded. The buffer keeps ticking, so a jump pressed
    // under a slit fires the moment you stand up.
    if (this.flat) return

    if (this.buffer > 0 && this.coyote > 0) {
      this.vy = JUMP_VELOCITY
      this.justJumped = true
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

  // --- form ---

  private updateForm(input: Input, solids: Solid[]): void {
    if (input.flatHeld) {
      if (!this.flat) this.goFlat(solids)
    } else if (this.flat) {
      this.tryStand(solids)
    }
  }

  private goFlat(solids: Solid[]): void {
    this.y += FOLD_SHIFT
    this.flat = true
    this.justFolded = true
    this.view.setForm(true)
    // Flat is wider than standing, so folding beside a wall can end up
    // inside it. Shove back out rather than refusing to fold, otherwise you
    // could not fold while pressed against the pillar you mean to enter.
    this.pushOutX(solids)
  }

  /**
   * The headroom rule: unfold only where a standing box actually fits, so
   * you can never stand up inside a slit and get stuck.
   */
  private tryStand(solids: Solid[]): void {
    const y = this.y - FOLD_SHIFT
    for (const s of solids) {
      if (this.boxOverlaps(s, this.x, y, PLAYER_W / 2, PLAYER_H / 2)) return
    }
    this.y = y
    this.flat = false
    this.justStood = true
    this.view.setForm(false)
  }

  private pushOutX(solids: Solid[]): void {
    for (const s of solids) {
      if (!this.overlaps(s)) continue
      const hw = this.halfW()
      // Leave by whichever face is nearer.
      const outLeft = this.x + hw - s.x
      const outRight = s.x + s.w - (this.x - hw)
      if (outLeft < outRight) this.x = s.x - hw
      else this.x = s.x + s.w + hw
      this.vx = 0
    }
  }

  halfW(): number {
    return (this.flat ? PLAYER_FLAT_W : PLAYER_W) / 2
  }

  halfH(): number {
    return (this.flat ? PLAYER_FLAT_H : PLAYER_H) / 2
  }

  // --- collision ---

  private moveX(dx: number, solids: Solid[]): void {
    if (dx === 0) return
    this.x += dx

    for (const s of solids) {
      if (!this.overlaps(s)) continue
      // Snap flush to the face we hit, then kill the speed we carried in.
      if (dx > 0) this.x = s.x - this.halfW()
      else this.x = s.x + s.w + this.halfW()
      this.vx = 0
    }
  }

  private moveY(dy: number, solids: Solid[]): void {
    // Only a real vertical move can change whether we are standing on
    // something, so a zero move leaves `grounded` alone.
    if (dy === 0) return
    const wasGrounded = this.grounded
    this.grounded = false
    this.y += dy

    for (const s of solids) {
      if (!this.overlaps(s)) continue
      if (dy > 0) {
        this.y = s.y - this.halfH()
        if (!wasGrounded) {
          this.justLanded = true
          this.landHold = LAND_HOLD
          // Captured before vy is zeroed, so the scene can tell a hard
          // landing from a gentle one.
          this.landSpeed = this.vy
        }
        this.grounded = true
      } else {
        this.y = s.y + s.h + this.halfH()
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

  private overlaps(s: Solid, x = this.x, y = this.y): boolean {
    return this.boxOverlaps(s, x, y, this.halfW(), this.halfH())
  }

  /** Touching exactly flush is not an overlap, so resting counts as clear. */
  private boxOverlaps(
    s: Solid,
    x: number,
    y: number,
    hw: number,
    hh: number,
  ): boolean {
    return (
      x - hw < s.x + s.w && x + hw > s.x && y - hh < s.y + s.h && y + hh > s.y
    )
  }
}

// Enter and exit hooks. Both run exactly once per entry, exit before enter.
// The visual kick of a landing, a jump or a dash belongs here rather than
// scattered through the physics.

type Hook = (p: Player) => void

const ENTER: Partial<Record<PlayerState, Hook>> = {
  land: (p) => p.view.pulse(LAND_SQUASH_X, LAND_SQUASH_Y),
  jumpUp: (p) => p.view.pulse(JUMP_STRETCH_X, JUMP_STRETCH_Y),
  dash: (p) => p.view.pulse(DASH_STRETCH_X, DASH_STRETCH_Y),
}

const EXIT: Partial<Record<PlayerState, Hook>> = {}
