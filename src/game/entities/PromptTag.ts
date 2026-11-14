import type * as Phaser from 'phaser'
import { Entity } from './Entity.ts'
import { pulse } from '../geom.ts'
import { drawTag, drawTagText, tagBox } from '../ui/tag.ts'
import type { EntitySnapshot, EntityWorld, PlayerSense } from './Entity.ts'
import type { EntityContext } from './Entity.ts'
import type { EntitySpec } from '../levels/types.ts'
import {
  PROMPT_FADE_MS,
  PROMPT_FAILS_FOR_HINT,
  PROMPT_HIGH_RISE,
  PROMPT_LIFT,
  PROMPT_PULSE_DEPTH,
  PROMPT_RUN_SPEED,
  PULSE_HZ,
} from '../constants.ts'

const FADE = PROMPT_FADE_MS / 1000
/** Monospace, so a character is a reliable fraction of the font size. */

/** What dismisses a tag. */
export type PromptAction =
  | 'run'
  | 'jump'
  | 'jumpHigh'
  | 'dash'
  | 'fold'
  | 'sword'
  | 'slash'
  | 'target'

const ACTIONS: PromptAction[] = [
  'run',
  'jump',
  'jumpHigh',
  'dash',
  'fold',
  'sword',
  'slash',
  'target',
]

/**
 * A paper tag that teaches one control: a few words, a drawn key cap, and a
 * trigger zone. It fades in near the spot it applies to, fades out once the
 * player has done the thing, and comes back with a soft pulse if they fail
 * at that spot three times. It never pauses anything.
 */
export class PromptTag extends Entity {
  private words: string
  private keys: string[]
  private action: PromptAction
  /** Id of something that has to be done before this tag may show at all. */
  private afterId: string | null
  private gate: Entity | null = null

  /** 0 hidden, 1 fully shown. */
  private shown = 0
  /** Latched once the player has done the action here. */
  private learnt = false
  private strikes = 0
  private hinting = false
  private clock = 0
  /** The ground we last left, so a held jump can be told from a tap. */
  private groundY: number | null = null

  constructor(spec: EntitySpec, ctx: EntityContext) {
    super(spec, ctx)
    this.words = spec.text ?? ''
    this.keys = spec.keys ?? []
    const action = spec.action as PromptAction | undefined
    if (action && !ACTIONS.includes(action)) {
      console.warn(`PromptTag ${this.id}: unknown action "${action}"`)
    }
    this.action = action && ACTIONS.includes(action) ? action : 'run'
    this.afterId = spec.after ?? null
  }

  /**
   * `after` is resolved alongside the targets, so a tag can be gated on
   * something that appears further down the level file.
   */
  link(byId: ReadonlyMap<string, Entity>): void {
    super.link(byId)
    if (!this.afterId) return
    const found = byId.get(this.afterId)
    if (!found) {
      console.warn(`PromptTag ${this.id}: no entity with id "${this.afterId}" to wait for`)
      return
    }
    this.gate = found
  }

  /** Has this lesson landed? Read live for a target, latched otherwise. */
  done(): boolean {
    if (this.action === 'target') {
      return this.targets.length > 0 && this.targets.every((t) => t.done())
    }
    return this.learnt
  }

  /** 0 to 1. What the tag is currently worth on screen. */
  alpha(): number {
    if (this.shown <= 0) return 0
    if (!this.hinting) return this.shown
    return this.shown * pulse(this.clock, PULSE_HZ, PROMPT_PULSE_DEPTH)
  }

  isHinting(): boolean {
    return this.hinting
  }

  strikeCount(): number {
    return this.strikes
  }

  update(dt: number, world: EntityWorld): void {
    this.clock += dt
    const p = world.player
    const here = this.covers(p.box)

    // Three failures at this spot and the hint comes back. The spec's rule
    // is per spot, so a muff somewhere else in the level is not ours.
    if (p.failedAt !== null && this.coversX(p.failedAt)) {
      this.strikes++
      if (this.strikes >= PROMPT_FAILS_FOR_HINT) this.hinting = true
    }

    if (p.grounded) this.groundY = p.box.bottom

    // Doing the thing clears the tag, and cancels any hint: they have just
    // proved they can, so nagging would be the opposite of a hint.
    if (here && this.did(p)) {
      this.learnt = true
      this.hinting = false
      this.strikes = 0
    }

    // A gated tag stays hidden until the thing it waits for has happened,
    // which is how "press R" cannot appear before you are holding anything.
    const open = !this.gate || this.gate.done()
    const want = here && open && (!this.done() || this.hinting) ? 1 : 0
    // Linear, so a fade takes exactly PROMPT_FADE_MS rather than easing
    // toward the target for ever.
    const move = dt / FADE
    this.shown = Math.max(0, Math.min(1, this.shown + (want ? move : -move)))

    // Words go out through the scene's label pool: an entity has no Text
    // object of its own. It happens here rather than in draw() because this
    // is where the world, and so the pool, is in reach.
    if (this.shown > 0.01) this.say(world)
  }

  draw(g: Phaser.GameObjects.Graphics): void {
    const a = this.alpha()
    if (a <= 0.01) return
    drawTag(g, this.frame(), this.keys, a)
  }

  /**
   * Position and visibility reset; what the player has learnt does not.
   *
   * Backspace is itself one of the failures that counts toward the hint, so
   * a tag that forgot its strikes on reset could never reach three. And you
   * do not forget how to jump because you walked back into the room.
   */
  reset(): void {
    this.shown = 0
    this.clock = 0
    this.groundY = null
  }

  serialize(): EntitySnapshot {
    return {
      ...super.serialize(),
      state: {
        text: this.words,
        action: this.action,
        learnt: this.done(),
        strikes: this.strikes,
        hinting: this.hinting,
      },
    }
  }

  /** The words and key letters, handed to the scene's label pool. */
  private say(world: EntityWorld): void {
    drawTagText(world.fx, this.id, this.frame(), this.words, this.keys, this.alpha())
  }

  /** The tag's own rectangle: centred over its zone, floating above it. */
  private frame(): { x: number; y: number; w: number; h: number } {
    return tagBox(this.centerX(), this.y - PROMPT_LIFT, this.words, this.keys)
  }

  private did(p: PlayerSense): boolean {
    switch (this.action) {
      case 'run':
        return p.speed > PROMPT_RUN_SPEED
      case 'jump':
        return p.jumped
      case 'jumpHigh':
        // A tap gives about a tile; only a held jump clears two.
        return (
          !p.grounded &&
          this.groundY !== null &&
          this.groundY - p.box.bottom > PROMPT_HIGH_RISE
        )
      case 'dash':
        return p.dashed
      case 'fold':
        return p.folded
      case 'sword':
        return p.sword
      case 'slash':
        return p.slash
      case 'target':
        return false
    }
  }

  /** Horizontal only: a vertical test would blink the tag off mid-jump. */
  private covers(box: { left: number; right: number }): boolean {
    return box.right > this.x && box.left < this.x + this.w
  }

  private coversX(x: number): boolean {
    return x >= this.x && x < this.x + this.w
  }
}

