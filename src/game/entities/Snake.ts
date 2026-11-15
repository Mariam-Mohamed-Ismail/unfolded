import type * as Phaser from 'phaser'
import { Enemy } from './Enemy.ts'
import { covered, hiding } from './hiding.ts'
import { mixColor } from '../geom.ts'
import type { Box, EntityContext, EntitySnapshot, EntityWorld } from './Entity.ts'
import type { EntitySpec } from '../levels/types.ts'
import type { Point } from '../geom.ts'
import type { Solid } from '../Player.ts'
import { dashedLine } from '../geom.ts'
import {
  COLOR_INK,
  COLOR_VENOM,
  PARRY_SPEED_MULT,
  PARTICLES_VENOM,
  SNAKE_AIM_S,
  SNAKE_HURT_SHADE,
  SNAKE_RECOVER_S,
  SNAKE_RESPAWN_S,
  SNAKE_RETREAT_COOLDOWN_S,
  SNAKE_RETREAT_PX,
  SNAKE_STAGGER_KNOCK,
  SNAKE_STAGGER_S,
  VENOM_ARC_S,
  VENOM_ARC_STEP_S,
  VENOM_FAN_ACCEL,
  VENOM_GRAVITY,
  VENOM_PX,
  VENOM_SPEED,
  VENOM_SPIN,
  COLOR_SNAKE,
  COLOR_SNAKE_FACET,
  FOLD_OUTLINE,
  PARTICLES_SNAKE_APPEAR,
  PARTICLES_SNAKE_VANISH,
  PLAYER_H,
  SNAKE_APPEAR_S,
  MAX_FALL_SPEED,
  SNAKE_FALL,
  SNAKE_FANG_PX,
  SNAKE_H,
  SNAKE_HEALTH,
  SNAKE_MARK_HZ,
  SNAKE_MARK_PX,
  SNAKE_MARK_S,
  SNAKE_NEAR_MAX,
  SNAKE_NEAR_MIN,
  SNAKE_PATROL_SPEED,
  SNAKE_RANGE_X,
  SNAKE_RANGE_Y,
  SNAKE_REAR_LIFT,
  SNAKE_REAR_S,
  SNAKE_SEGMENTS,
  SNAKE_SEG_GAP,
  SNAKE_VANISH_S,
  SNAKE_W,
  SNAKE_WAVE_HZ,
  SNAKE_WAVE_PX,
  TILE,
} from '../constants.ts'

const TAU = Math.PI * 2

/** The spec's whole machine, plus the stagger a sword hit branches into. */
export type SnakeState =
  | 'patrol'
  | 'rear'
  | 'vanish'
  | 'mark'
  | 'appear'
  | 'aim'
  | 'spit'
  | 'recover'
  | 'retreat'
  | 'stagger'
  | 'gone'

/**
 * One blob of venom. The snake owns it; there is only ever one.
 *
 * `back` is the Parry crease: a blob that has been turned around no longer
 * threatens the player, and lands on the snake instead.
 */
type Blob = {
  x: number
  y: number
  vx: number
  vy: number
  spin: number
  back: boolean
}

/**
 * The second enemy: it patrols, telegraphs, folds itself away and comes back
 * somewhere else.
 *
 * **Nothing here is random.** The bat may scatter random motes because they
 * are decoration, but where a snake reappears is gameplay, and the recorded
 * solutions depend on a room replaying identically. So every choice is an
 * ordered search with the first valid answer winning.
 */
export class Snake extends Enemy<SnakeState> {
  /** The patrol segment, in pixels. */
  private fromX: number
  private toX: number
  private homeX: number

  /** The head, and the floor it is standing on. */
  private hx: number
  private hy: number
  private floorY: number
  /**
   * The floor it was placed on, kept separately because reset() has to
   * return it there. Reading Entity's own `y` instead was a real bug: the
   * data gives a patroller its surface as `floorH`, so `y` is the main
   * floor row and a reset dropped the snake out of its own room's height.
   */
  private spawnFloorY: number
  /** Which way it is slithering: -1 or 1. */
  private dir = 1

  /** Free-running, for the body's wave. */
  private clock = 0
  /** The segments trail this, newest first. */
  private trail: Point[] = []

  /** Where the mark is, and so where it will reappear. */
  private markX = 0
  private markY = 0
  /** Where the venom is aimed: locked when Aim ends, never updated after. */
  private aimAt: Point | null = null
  /**
   * Where the player was last seen. Kept so draw() can show the arc while
   * aiming: draw() has no world, and during Aim nothing is locked yet —
   * which is the whole point of locking only at the end.
   */
  private lastSeen: Point | null = null
  /** The one live blob, or null. */
  private blob: Blob | null = null
  /** Set once the blob has landed a hit, so it only ever lands one. */
  private blobSpent = false
  /** Hurt: one health gone. Drawn darker from then on. */
  private wounded = false
  /** Seconds before it may notice again, after retreating. */
  private cooldown = 0
  /** Counting up to a respawn while dead. */
  private deadFor = 0
  /** How far above its floor the wind has carried it, and how fast. */
  private air = 0
  private liftVy = 0
  /** Latched so each state's one-off effects fire once. */
  private announced = false

  constructor(spec: EntitySpec, ctx: EntityContext) {
    super(spec, ctx, 'patrol', SNAKE_HEALTH)
    this.floorY = ctx.surfaceY(spec.floorH ?? this.th)
    this.spawnFloorY = this.floorY
    this.fromX = ctx.tileX(spec.patrolFrom ?? this.tx)
    this.toX = ctx.tileX(spec.patrolTo ?? this.tx + 1)
    this.homeX = ctx.tileX(spec.homeX ?? spec.patrolFrom ?? this.tx) + TILE / 2
    this.hx = this.homeX
    this.hy = this.floorY - SNAKE_H / 2
    this.seedTrail()
  }

  /** Where the head is. */
  at(): Point {
    return [this.hx, this.hy]
  }

  /** Where it will reappear, once the mark is down. */
  mark(): Point | null {
    return this.state === 'mark' || this.state === 'appear'
      ? [this.markX, this.markY]
      : null
  }

  /** The body, head first. For the tests and for drawing. */
  segments(): Point[] {
    return this.trail.slice(0, SNAKE_SEGMENTS)
  }

  /**
   * The spec's 36x16, on the head and the first segments. It shrinks to
   * nothing through the vanish, so a folded-away snake cannot be cut.
   */
  protected box(): Box | null {
    const shrink =
      this.state === 'vanish'
        ? 1 - Math.min(1, this.stateT / SNAKE_VANISH_S)
        : this.state === 'appear'
          ? Math.min(1, this.stateT / SNAKE_APPEAR_S)
          : 1
    if (shrink <= 0.01) return null
    const h = SNAKE_H * shrink
    return {
      left: this.hx - SNAKE_W / 2,
      right: this.hx + SNAKE_W / 2,
      top: this.hy - h / 2,
      bottom: this.hy + h / 2,
    }
  }

  protected think(dt: number, world: EntityWorld): void {
    this.clock += dt
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt)
    this.flyBlob(dt, world)

    switch (this.state) {
      case 'patrol':
        this.slither(dt)
        if (this.cooldown > 0) break
        if (this.sees(world)) {
          this.enter('rear')
          this.announced = false
        }
        break

      case 'rear':
        // Head up, fangs white. The telegraph: it never attacks without it.
        if (!this.announced) {
          this.announced = true
          world.fx.sound('hiss')
        }
        if (this.stateT >= SNAKE_REAR_S) {
          this.enter('vanish')
          this.announced = false
        }
        break

      case 'vanish':
        if (!this.announced) {
          this.announced = true
          world.fx.dust(this.hx, this.hy, PARTICLES_SNAKE_VANISH, COLOR_SNAKE)
          world.fx.sound('crumple')
        }
        if (this.stateT >= SNAKE_VANISH_S) {
          this.aimMark(world)
          this.enter('mark')
          this.announced = false
        }
        break

      case 'mark':
        // The crease glows where it will come out, so the player can move.
        if (this.stateT >= SNAKE_MARK_S) {
          this.hx = this.markX
          this.hy = this.markY
          this.floorY = this.markY + SNAKE_H / 2
          this.seedTrail()
          this.enter('appear')
          this.announced = false
        }
        break

      case 'appear':
        if (!this.announced) {
          this.announced = true
          world.fx.dust(this.hx, this.hy, PARTICLES_SNAKE_APPEAR, COLOR_SNAKE)
          world.fx.sound('pop')
        }
        // Head toward the player as it comes out.
        this.dir = this.towardPlayer(world)
        if (this.stateT >= SNAKE_APPEAR_S) {
          this.enter('aim')
          this.announced = false
        }
        break

      case 'aim': {
        // The head tracks while aiming, and the arc is drawn from the same
        // solution the blob will fly - see arcFor().
        this.dir = this.towardPlayer(world)
        const pb = world.player.box
        this.lastSeen = [(pb.left + pb.right) / 2, (pb.top + pb.bottom) / 2]
        if (this.stateT >= SNAKE_AIM_S) {
          // "Cannot spit while the player is flat in a slit": the whole
          // attack is abandoned rather than fired blind.
          if (this.playerHidden(world)) {
            this.aimAt = null
            this.enter('recover')
          } else {
            // Locked here and never read again: moving after this dodges,
            // moving before it does not.
            const p = world.player.box
            this.aimAt = [(p.left + p.right) / 2, (p.top + p.bottom) / 2]
            this.enter('spit')
          }
          this.announced = false
        }
        break
      }

      case 'spit':
        if (!this.announced) {
          this.announced = true
          this.fire(world)
        }
        this.enter('recover')
        this.announced = false
        break

      case 'recover':
        // Head low and slow: the player's window.
        if (this.stateT >= SNAKE_RECOVER_S) {
          this.enter('retreat')
          this.announced = false
        }
        break

      case 'retreat': {
        // Away from the player first, then back to its own patrol segment.
        //
        // Both halves matter: retreating only "away" let it flee for ever
        // when the player stood between it and home - measured at 1400px
        // before this was split in two.
        const backedOff = this.stateT * SNAKE_PATROL_SPEED >= SNAKE_RETREAT_PX
        const home = this.hx >= this.fromX && this.hx <= this.toX
        if (!backedOff) {
          this.dir = -this.towardPlayer(world)
        } else if (!home) {
          this.dir = this.hx < this.fromX ? 1 : -1
        } else {
          this.cooldown = SNAKE_RETREAT_COOLDOWN_S
          this.enter('patrol')
          break
        }
        this.hx += this.dir * SNAKE_PATROL_SPEED * dt
        this.hy = this.floorY - SNAKE_H / 2
        break
      }

      case 'stagger':
        // Held in place by the hit, sliding with the knockback.
        this.hx += this.knockVx * dt
        this.hy = this.floorY - SNAKE_H / 2
        if (this.stateT >= SNAKE_STAGGER_S) {
          this.knockVx = 0
          // "It vanishes right after, hurt."
          this.enter('vanish')
          this.announced = false
        }
        break

      case 'gone':
        break
    }

    this.driftInWind(dt, world)
    this.pushTrail()
  }

  /**
   * In range, and not hiding. Nine tiles across and three up or down,
   * measured between the boxes like the bat's, so the numbers mean the same
   * thing for both enemies.
   */
  private sees(world: EntityWorld): boolean {
    const p = world.player.box
    const me = this.box()
    if (!me) return false
    const gapX = Math.max(0, me.left - p.right, p.left - me.right)
    const gapY = Math.max(0, me.top - p.bottom, p.top - me.bottom)
    if (gapX > SNAKE_RANGE_X * TILE) return false
    if (gapY > SNAKE_RANGE_Y * TILE) return false
    // "It ignores a player who is flat inside a slit."
    if (hiding(p, world.player.flat, world.solids)) return false
    return true
  }

  /**
   * A draught carries it up, the same way it carries the player, and
   * gravity brings it back to its own floor.
   *
   * Applied after the state machine has placed it, so every state gets the
   * same treatment without each one having to know about wind. It only
   * moves the snake vertically: the spec never asked for a flying snake,
   * and how it patrols sideways is unchanged.
   */
  private driftInWind(dt: number, world: EntityWorld): void {
    const box = this.box()
    const lift = box ? world.liftAt(box) : null
    if (lift) {
      const step = lift.accel * dt
      const want = lift.vy
      if (Math.abs(want - this.liftVy) <= step) this.liftVy = want
      else this.liftVy += Math.sign(want - this.liftVy) * step
    } else {
      this.liftVy = Math.min(this.liftVy + SNAKE_FALL * dt, MAX_FALL_SPEED)
    }
    // `air` is how far above its floor it is, so up is positive here.
    this.air = Math.max(0, this.air - this.liftVy * dt)
    if (this.air <= 0) {
      this.air = 0
      this.liftVy = 0
    }
    this.hy = this.floorY - SNAKE_H / 2 - this.air
  }

  private slither(dt: number): void {
    this.hx += this.dir * SNAKE_PATROL_SPEED * dt
    if (this.hx <= this.fromX) {
      this.hx = this.fromX
      this.dir = 1
    } else if (this.hx >= this.toX) {
      this.hx = this.toX
      this.dir = -1
    }
    this.hy = this.floorY - SNAKE_H / 2
  }

  /**
   * Choose where to come back, as an ordered search so the answer is always
   * the same one. The spec's five clauses, in order of preference:
   *
   *   3 to 4 tiles away · on the side the player is not facing first
   *   on a floor, an unfolded bridge counting · never inside a slit
   *   never on top of the player
   *
   * Nothing legal? Come back where it went, rather than somewhere wrong.
   */
  private aimMark(world: EntityWorld): void {
    const p = world.player.box
    const px = (p.left + p.right) / 2
    // Behind them first: away from the way they are facing.
    const sides = world.player.facing >= 0 ? [-1, 1] : [1, -1]
    const steps = [
      SNAKE_NEAR_MIN,
      (SNAKE_NEAR_MIN + SNAKE_NEAR_MAX) / 2,
      SNAKE_NEAR_MAX,
    ]

    for (const side of sides) {
      for (const tiles of steps) {
        const x = px + side * tiles * TILE
        const y = this.standOn(x, p, world.solids)
        if (y === null) continue
        this.markX = x
        this.markY = y
        return
      }
    }
    this.markX = this.hx
    this.markY = this.hy
  }

  /**
   * Could it stand at `x`? Returns the head's y if so.
   *
   * A floor has to be under it, within reach of the player's own level, so
   * it arrives beside them rather than on some distant ledge. An unfolded
   * bridge is floor because this reads the live collision list — a folded
   * one simply is not there.
   */
  private standOn(
    x: number,
    player: Box,
    solids: readonly Solid[],
  ): number | null {
    let best: number | null = null
    for (const s of solids) {
      if (x < s.x || x > s.x + s.w) continue
      // Surfaces no more than a tile either side of the player's feet.
      if (Math.abs(s.y - player.bottom) > TILE + 2) continue
      if (best === null || s.y < best) best = s.y
    }
    if (best === null) return null

    const hy = best - SNAKE_H / 2
    const me: Box = {
      left: x - SNAKE_W / 2,
      right: x + SNAKE_W / 2,
      top: hy - SNAKE_H / 2,
      bottom: hy + SNAKE_H / 2,
    }
    // Never on top of the player.
    if (
      me.right > player.left &&
      me.left < player.right &&
      me.bottom > player.top &&
      me.top < player.bottom
    ) {
      return null
    }
    // Never inside a slit: the same overhead test the bat uses, asked about
    // the space the snake would occupy standing up.
    const standing: Box = { ...me, top: best - PLAYER_H }
    if (covered(standing, solids)) return null
    return hy
  }

  /** Lay the whole body at the head, for a spawn or an arrival. */
  private seedTrail(): void {
    this.trail = []
    for (let i = 0; i < SNAKE_SEGMENTS * 3; i++) {
      this.trail.push([this.hx - this.dir * i * (SNAKE_SEG_GAP / 3), this.hy])
    }
  }

  /**
   * One history sample a frame, with the segments reading every third one —
   * so they trail at a fixed spacing rather than bunching up when it stops.
   */
  private pushTrail(): void {
    this.trail.unshift([this.hx, this.hy])
    const keep = SNAKE_SEGMENTS * 3 + 3
    if (this.trail.length > keep) this.trail.length = keep
  }

  /** Where segment `i` sits: every third sample back down the trail. */
  private segAt(i: number): Point {
    const at = Math.min(this.trail.length - 1, i * 3)
    const p = this.trail[at] ?? [this.hx, this.hy]
    // A slow wave along the body, so it reads as slithering rather than
    // sliding. Visual only.
    const wave =
      i === 0
        ? 0
        : Math.sin(this.clock * SNAKE_WAVE_HZ * TAU - i * 0.8) * SNAKE_WAVE_PX
    return [p[0], p[1] + wave]
  }

  /**
   * Dead, but not necessarily gone: the spec respawns it after 25s at its
   * patrol start, and only while the room has not been finished with. Runs
   * from update() rather than think(), because think() stops when it dies.
   */
  update(dt: number, world: EntityWorld): void {
    super.update(dt, world)
    if (this.alive()) return

    // A shot already in the air still flies and still bites.
    this.flyBlob(dt, world)

    if (world.roomCleared) return
    this.deadFor += dt
    if (this.deadFor < SNAKE_RESPAWN_S) return
    this.deadFor = 0
    this.revive()
  }

  /** Back at the patrol start, whole, as if the room had been reset. */
  private revive(): void {
    super.reset()
    this.wounded = false
    this.hx = this.fromX + TILE / 2
    this.floorY = this.spawnFloorY
    this.hy = this.floorY - SNAKE_H / 2
    this.dir = 1
    this.cooldown = 0
    this.air = 0
    this.liftVy = 0
    this.aimAt = null
    this.blob = null
    this.announced = false
    this.seedTrail()
  }

  /** -1 or 1, toward the player. */
  private towardPlayer(world: EntityWorld): number {
    const p = world.player.box
    return (p.left + p.right) / 2 > this.hx ? 1 : -1
  }

  private playerHidden(world: EntityWorld): boolean {
    return hiding(world.player.box, world.player.flat, world.solids)
  }

  /** Where the venom leaves from: the mouth, just in front of the head. */
  private mouth(): Point {
    return [this.hx + this.dir * (SNAKE_W / 2), this.hy - 2]
  }

  /**
   * The launch velocity that carries a blob from the mouth through the
   * aimed point.
   *
   * Solved rather than guessed, because the spec's own numbers leave almost
   * no slack: at 300px/s against gravity 600 the furthest a lob can reach
   * is v*v/g = 150px, and the snake reappears 96 to 128px away. Out of
   * range it throws flat and falls short - which is honest, because the arc
   * drawn during Aim comes from this same function.
   */
  private launch(target: Point): Point {
    const from = this.mouth()
    const dx = target[0] - from[0]
    // Screen y grows downward; work in height gained.
    const dy = -(target[1] - from[1])
    const v = VENOM_SPEED
    const g = VENOM_GRAVITY

    if (Math.abs(dx) > 1) {
      const disc = v ** 4 - g * (g * dx * dx + 2 * dy * v * v)
      if (disc >= 0) {
        // The flatter of the two solutions: a direct shot, not a mortar.
        const tan = (v * v - Math.sqrt(disc)) / (g * dx)
        const ang = Math.atan(Math.abs(tan))
        const dirX = dx >= 0 ? 1 : -1
        return [Math.cos(ang) * v * dirX, -Math.sin(ang) * v]
      }
    }
    // Out of range, or straight up: throw along the line and fall short.
    const len = Math.hypot(dx, dy) || 1
    return [(dx / len) * v, (-dy / len) * v]
  }

  /** One blob, from the mouth toward the locked point. */
  private fire(world: EntityWorld): void {
    const aim = this.aimAt
    if (!aim) return
    const from = this.mouth()
    const vel = this.launch(aim)
    this.blob = { x: from[0], y: from[1], vx: vel[0], vy: vel[1], spin: 0, back: false }
    this.blobSpent = false
    world.fx.sound('spit')
  }

  /**
   * The blob's flight: gravity, a fan's lift, and gone on any solid. Runs
   * whatever state the snake is in, so killing it mid-flight does not
   * cancel a shot already in the air.
   */
  private flyBlob(dt: number, world: EntityWorld): void {
    const b = this.blob
    if (!b) return
    b.spin += VENOM_SPIN * dt
    // A draught pushes it up: the same question the bat's dive asks.
    if (world.liftAt(this.blobBox(b))) b.vy -= VENOM_FAN_ACCEL * dt
    b.vy += VENOM_GRAVITY * dt
    b.x += b.vx * dt
    b.y += b.vy * dt

    const box = this.blobBox(b)

    // Its own venom, coming back: the spec's 1 damage. Checked before solids
    // so a snake standing on the floor it was parried along still takes it.
    if (b.back && this.alive() && this.state !== 'gone') {
      const me = this.box()
      if (me && overlaps(me, box)) {
        world.fx.dust(b.x, b.y, PARTICLES_VENOM, COLOR_VENOM)
        this.blob = null
        this.hurt(Math.sign(b.vx) || 1)
        return
      }
    }

    for (const sol of world.solids) {
      if (
        box.right > sol.x &&
        box.left < sol.x + sol.w &&
        box.bottom > sol.y &&
        box.top < sol.y + sol.h
      ) {
        world.fx.dust(b.x, b.y, PARTICLES_VENOM, COLOR_VENOM)
        this.blob = null
        return
      }
    }
  }

  private blobBox(b: Blob): Box {
    return {
      left: b.x - VENOM_PX,
      right: b.x + VENOM_PX,
      top: b.y - VENOM_PX,
      bottom: b.y + VENOM_PX,
    }
  }

  /** Where the venom is in flight, for the tests. */
  venom(): Point | null {
    return this.blob ? [this.blob.x, this.blob.y] : null
  }

  /** Where it is aiming, once Aim has locked it. */
  target(): Point | null {
    return this.aimAt
  }

  /** Is it hurt - one health down? Drawn darker from then on. */
  isWounded(): boolean {
    return this.wounded
  }

  /**
   * The arc the blob will fly, sampled. Drawn during Aim, and used by the
   * tests to prove the telegraph matches the flight.
   */
  arcFor(target: Point): Point[] {
    const from = this.mouth()
    const vel = this.launch(target)
    const pts: Point[] = []
    let x = from[0]
    let y = from[1]
    let vy = vel[1]
    for (let t = 0; t < VENOM_ARC_S; t += VENOM_ARC_STEP_S) {
      pts.push([x, y])
      vy += VENOM_GRAVITY * VENOM_ARC_STEP_S
      x += vel[0] * VENOM_ARC_STEP_S
      y += vy * VENOM_ARC_STEP_S
    }
    return pts
  }

  /**
   * Hurting the player: the venom where it lands, or the body on contact.
   * Returns whatever actually touched them, so the knockback points away
   * from that rather than from the snake in general.
   */
  dangerAt(box: Box): number | null {
    const b = this.blob
    // A parried blob is the player's now, so it flies straight past them;
    // only the body is left to walk into.
    if (b && !b.back && !this.blobSpent && overlaps(this.blobBox(b), box)) {
      this.blobSpent = true
      const at = b.x
      this.blob = null
      return at
    }
    if (!this.alive() || this.state === 'gone') return null
    const me = this.box()
    if (me && overlaps(me, box)) return this.hx
    return null
  }

  /**
   * The Parry crease: a slash that catches the venom turns it around.
   *
   * It is a true reflection — the velocity is negated and scaled, so the blob
   * retraces the arc it came along, which points it back at whatever fired
   * it. Gravity means it does not retrace exactly, which is why it comes back
   * faster than it left.
   *
   * A blob can only be parried once; after that it belongs to the player.
   */
  parryAt(box: Box): Point | null {
    const b = this.blob
    if (!b || b.back || this.blobSpent) return null
    if (!overlaps(this.blobBox(b), box)) return null
    b.vx *= -PARRY_SPEED_MULT
    b.vy *= -PARRY_SPEED_MULT
    b.back = true
    return [b.x, b.y]
  }

  /**
   * The spec's two-stage hit: the first staggers it and sends it away
   * hurt, the second kills it. Enemy counts the health and flashes; the
   * stagger is a state, so it holds still for its 0.4s.
   */
  hurt(dir: number): boolean {
    const survived = super.hurt(dir)
    if (!survived) return false
    this.wounded = true
    this.knockVx = SNAKE_STAGGER_KNOCK * (dir >= 0 ? 1 : -1)
    this.enter('stagger')
    this.announced = false
    return true
  }

  protected onDeath(world: EntityWorld): void {
    world.fx.dust(this.hx, this.hy, PARTICLES_SNAKE_VANISH * 2, COLOR_SNAKE)
    world.fx.sound('hit')
  }

  reset(): void {
    super.reset()
    this.hx = this.homeX
    this.floorY = this.spawnFloorY
    this.hy = this.floorY - SNAKE_H / 2
    this.dir = 1
    this.clock = 0
    this.announced = false
    this.markX = 0
    this.markY = 0
    this.aimAt = null
    this.blob = null
    this.blobSpent = false
    this.wounded = false
    this.cooldown = 0
    this.deadFor = 0
    this.air = 0
    this.liftVy = 0
    this.seedTrail()
  }

  draw(g: Phaser.GameObjects.Graphics): void {
    // The venom first, whatever state the snake is in and even if it is
    // dead: a shot already in the air is still a shot in the air.
    const b = this.blob
    if (b) {
      g.fillStyle(COLOR_VENOM, 1)
      g.lineStyle(FOLD_OUTLINE, COLOR_INK, 1)
      const tri = [0, TAU / 3, (TAU * 2) / 3].map((a): Point => [
        b.x + Math.cos(b.spin + a) * VENOM_PX,
        b.y + Math.sin(b.spin + a) * VENOM_PX,
      ])
      g.fillTriangle(tri[0][0], tri[0][1], tri[1][0], tri[1][1], tri[2][0], tri[2][1])
      g.strokeTriangle(tri[0][0], tri[0][1], tri[1][0], tri[1][1], tri[2][0], tri[2][1])
    }

    if (!this.alive()) return

    const lit =
      this.state === 'rear' || this.state === 'aim' || this.isFlashing()
    // Hurt, it is drawn darker from then on, which is how you can tell that
    // a hit has already landed.
    const base = this.wounded
      ? mixColor(COLOR_SNAKE, COLOR_SNAKE_FACET, SNAKE_HURT_SHADE)
      : COLOR_SNAKE
    const body = lit ? mixColor(base, 0xffffff, 0.5) : base

    // The telegraph: a faint dotted line along the path the blob will
    // actually fly, because this and fire() both come out of launch().
    if (this.state === 'aim' && this.lastSeen) {
      const arc = this.arcFor(this.lastSeen)
      g.lineStyle(FOLD_OUTLINE, COLOR_VENOM, 0.45)
      for (let i = 1; i < arc.length; i++) {
        dashedLine(g, arc[i - 1][0], arc[i - 1][1], arc[i][0], arc[i][1], 3, 4)
      }
    }

    // The mark on the floor, pulsing, so where it will come out is readable
    // before it gets there.
    if (this.state === 'mark') {
      const beat = 0.5 + 0.5 * Math.sin(this.stateT * SNAKE_MARK_HZ * TAU)
      g.lineStyle(FOLD_OUTLINE, COLOR_SNAKE, 0.4 + 0.6 * beat)
      const w = SNAKE_MARK_PX * (0.6 + 0.4 * beat)
      const y = this.markY + SNAKE_H / 2
      g.lineBetween(this.markX - w, y, this.markX + w, y)
      g.lineBetween(this.markX, y - 4, this.markX, y + 4)
      return
    }

    const shrink =
      this.state === 'vanish'
        ? 1 - Math.min(1, this.stateT / SNAKE_VANISH_S)
        : this.state === 'appear'
          ? Math.min(1, this.stateT / SNAKE_APPEAR_S)
          : 1
    if (shrink <= 0.02) return

    // Tail to head, so the head draws over the body.
    g.lineStyle(FOLD_OUTLINE, COLOR_INK, 1)
    for (let i = SNAKE_SEGMENTS - 1; i >= 1; i--) {
      const a = this.segAt(i)
      const b = this.segAt(i - 1)
      const half = (SNAKE_H / 2) * shrink * (1 - i / (SNAKE_SEGMENTS * 1.6))
      // A quad between this sample and the next: the body as folded facets,
      // alternating shade so each segment reads separately.
      const pts = [
        { x: a[0], y: a[1] - half },
        { x: b[0], y: b[1] - half },
        { x: b[0], y: b[1] + half },
        { x: a[0], y: a[1] + half },
      ]
      g.fillStyle(i % 2 === 0 ? body : COLOR_SNAKE_FACET, 1)
      g.fillPoints(pts, true)
      g.strokePoints(pts, true)
    }

    // The head: a triangle pointing the way it is going, lifted while
    // rearing.
    const lift = this.state === 'rear' ? SNAKE_REAR_LIFT * (this.stateT / SNAKE_REAR_S) : 0
    const hx = this.hx
    const hy = this.hy - lift
    const r = (SNAKE_H / 2 + 2) * shrink
    g.fillStyle(body, 1)
    g.fillTriangle(hx + this.dir * r * 1.6, hy, hx - this.dir * r, hy - r, hx - this.dir * r, hy + r)
    g.strokeTriangle(hx + this.dir * r * 1.6, hy, hx - this.dir * r, hy - r, hx - this.dir * r, hy + r)

    // Two fangs, white through the telegraph.
    if (shrink > 0.9) {
      g.fillStyle(lit ? 0xffffff : COLOR_SNAKE_FACET, 1)
      for (const off of [-1, 1]) {
        const fx = hx + this.dir * r * 1.3
        const fy = hy + off * 3
        g.fillTriangle(
          fx,
          fy,
          fx + this.dir * SNAKE_FANG_PX,
          fy + off * SNAKE_FANG_PX * 0.6,
          fx,
          fy + off * SNAKE_FANG_PX,
        )
      }
    }
  }

  serialize(): EntitySnapshot {
    return {
      ...super.serialize(),
      state: {
        health: this.hits(),
        phase: this.state,
        x: Math.round(this.hx),
        y: Math.round(this.hy),
      },
    }
  }
}

/** Touching exactly flush is not an overlap, matching the player's collision. */
function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}
