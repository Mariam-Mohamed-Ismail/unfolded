import { Entity } from './Entity.ts'
import type { Box, EntityContext, EntitySnapshot, EntityWorld } from './Entity.ts'
import type { EntitySpec } from '../levels/types.ts'
import { HIT_FLASH_MS } from '../constants.ts'

const FLASH = HIT_FLASH_MS / 1000

/**
 * What every enemy has in common: health, taking a hit, dying once, and a
 * state machine.
 *
 * Generic over its own state names so a subclass keeps a real union — `enter`
 * and `state` will not accept a typo — without this file knowing what any of
 * the states are.
 *
 * It implements the sword's whole contract (hurtBox, hurt, knock) on top of
 * one method a subclass has to supply: `box()`, which says where it is. So a
 * subclass writes its states and its drawing, and nothing about being hit.
 */
export class Enemy<S extends string> extends Entity {
  protected health: number
  protected maxHealth: number

  /** Which state, and how long it has been in it. */
  protected state: S
  protected stateT = 0
  /** Seconds of white flash left from the last hit. */
  protected flash = 0
  /** Sideways shove from a hit that was survived. */
  protected knockVx = 0

  /** The state to go back to on reset. */
  private first: S
  /** Latched so the death effects run exactly once. */
  private burst = false

  constructor(spec: EntitySpec, ctx: EntityContext, first: S, health: number) {
    super(spec, ctx)
    this.maxHealth = spec.health ?? health
    this.health = this.maxHealth
    this.first = first
    this.state = first
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

  /** Which state it is in. For the tests and the F1 readout. */
  phase(): S {
    return this.state
  }

  /** Where it is right now. A subclass that moves overrides this. */
  protected box(): Box | null {
    return null
  }

  /** Only a living enemy can be cut, which is also what stops a second hit. */
  hurtBox(): Box | null {
    if (this.health <= 0) return null
    return this.box()
  }

  hurt(_dir: number): boolean {
    if (this.health <= 0) return false
    this.health--
    this.flash = FLASH
    return this.health > 0
  }

  knock(vx: number): void {
    this.knockVx = vx
  }

  /** Move to `next` and restart its clock. */
  protected enter(next: S): void {
    this.state = next
    this.stateT = 0
  }

  /** The subclass's brain, run every frame while alive. */
  protected think(_dt: number, _world: EntityWorld): void {}

  /**
   * What dying looks like. Raised from update() rather than from hurt(),
   * which has no access to the effects — the same reason Dummy defers its
   * own.
   */
  protected onDeath(_world: EntityWorld): void {}

  update(dt: number, world: EntityWorld): void {
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt)

    if (this.health <= 0) {
      if (!this.burst) {
        this.burst = true
        this.onDeath(world)
      }
      return
    }

    this.stateT += dt
    this.think(dt, world)
  }

  reset(): void {
    this.health = this.maxHealth
    this.state = this.first
    this.stateT = 0
    this.flash = 0
    this.knockVx = 0
    this.burst = false
  }

  serialize(): EntitySnapshot {
    return {
      ...super.serialize(),
      state: { health: this.health, phase: this.state },
    }
  }
}
