import type * as Phaser from 'phaser'
import type { EntitySpec } from '../levels/types.ts'
import type { Solid } from '../Player.ts'
import { TILE } from '../constants.ts'

/**
 * What an entity needs from the level: the tile-to-pixel conversion, and a
 * way to put itself into the world's collision list or take itself back out.
 * The list stays owned by Level.
 */
export type EntityContext = {
  /** Pixel x of the left edge of tile column `x`. */
  tileX: (x: number) => number
  /** Pixel y of a surface `h` tiles above the floor row. */
  surfaceY: (h: number) => number
  addSolid: (s: Solid) => void
  removeSolid: (s: Solid) => void
}

/** An axis-aligned box in pixels. */
export type Box = { left: number; right: number; top: number; bottom: number }

/**
 * What an entity can make happen in the world, as plain functions, so a
 * component never imports Particles, Camera or Audio — or Phaser.
 */
export type Fx = {
  dust: (x: number, y: number, count: number, color?: number) => void
  shake: (px: number, ms: number) => void
  /** The paper crinkle, for anything that folds. */
  fold: () => void
}

/** What an entity can see each frame. One object, reused by Level. */
export type EntityWorld = {
  player: Box
  fx: Fx
}

export type EntityStateValue = number | boolean | string

/**
 * An entity dumped back to plain data. The fixed fields mirror the level
 * file; `state` is whatever the subclass is currently doing, which is the
 * part that changes while playing.
 */
export type EntitySnapshot = {
  id: string
  type: string
  x: number
  h: number
  state?: Record<string, EntityStateValue>
}

/**
 * The base every level object is built on: an id, a type, a position, and
 * three hooks — update it, reset it, write it out.
 *
 * Deliberately knows nothing about Phaser or about the player. A subclass
 * that needs to draw takes what it needs through its own constructor.
 */
export class Entity {
  readonly id: string
  readonly type: string

  /** Position as the data gives it: tiles, and `h` above the floor row. */
  readonly tx: number
  readonly th: number
  /** Width in tiles. One tile unless the data says otherwise. */
  readonly tw: number

  /** The same position in pixels: left edge, top surface, width. */
  readonly x: number
  readonly y: number
  readonly w: number

  /** Ids this entity drives, straight from the data. */
  readonly targetIds: readonly string[]
  /** The same, resolved to entities by link(). Empty until then. */
  readonly targets: Entity[] = []

  // Not a parameter property: erasableSyntaxOnly forbids those.
  constructor(spec: EntitySpec, ctx: EntityContext) {
    this.id = spec.id
    this.type = spec.type
    this.tx = spec.x
    this.th = spec.h ?? 0
    this.tw = spec.w ?? 1
    this.x = ctx.tileX(spec.x)
    this.y = ctx.surfaceY(this.th)
    this.w = this.tw * TILE
    this.targetIds = spec.targets ?? []
  }

  /** Middle of the entity, which is what you aim at or spawn on. */
  centerX(): number {
    return this.x + this.w / 2
  }

  /**
   * Resolve targetIds to entities. Run once, after every entity exists, so
   * the data can reference an id that appears further down the list.
   *
   * A dangling id warns rather than throwing: a half-written level should
   * still be playable, and the warning says exactly what to fix.
   */
  link(byId: ReadonlyMap<string, Entity>): void {
    this.targets.length = 0
    for (const id of this.targetIds) {
      const found = byId.get(id)
      if (!found) {
        console.warn(`Entity ${this.id}: no entity with id "${id}" to target`)
        continue
      }
      this.targets.push(found)
    }
  }

  /**
   * Back to the state the level file describes. The base has no mutable
   * state, so this does nothing; anything that latches, folds or moves
   * overrides it. Called on room entry and on Backspace.
   */
  reset(): void {}

  /** Per frame, in seconds. The base does nothing. */
  update(_dt: number, _world: EntityWorld): void {}

  /**
   * Draw into the Graphics the scene hands round. An entity never owns one
   * and never touches the scene, which keeps Phaser a type-only import here.
   */
  draw(_g: Phaser.GameObjects.Graphics): void {}

  /**
   * Do your thing, `delay` seconds from now. This is what the id links are
   * for: a switch calls trigger() on its targets and never learns what they
   * are. Anything that does not respond ignores it.
   */
  trigger(_delay: number): void {}

  /** Current state as plain data, for debugging and for the F1 overlay. */
  serialize(): EntitySnapshot {
    return { id: this.id, type: this.type, x: this.tx, h: this.th }
  }
}
