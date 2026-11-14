import type * as Phaser from 'phaser'
import type { EntitySpec, Palette } from '../levels/types.ts'
import type { Solid, Updraft } from '../Player.ts'
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
  /** The level's own colours, so two levels can draw the same thing twice. */
  palette: Palette
}

/** Which way a fold goes. */
export type FoldMode = 'unfold' | 'fold'

/** An axis-aligned box in pixels. */
export type Box = { left: number; right: number; top: number; bottom: number }

/**
 * What an entity can make happen in the world, as plain functions, so a
 * component never imports Particles, Camera or Audio — or Phaser.
 */
/** The one-shot voices an entity can ask for by name. */
export type SoundName =
  | 'fold'
  | 'pickup'
  | 'whoosh'
  | 'swoosh'
  | 'hit'
  | 'tear'
  /** The bat's two-note alert. */
  | 'sting'

export type Fx = {
  dust: (x: number, y: number, count: number, color?: number) => void
  shake: (px: number, ms: number) => void
  /** A short zoom pulse on the camera. */
  zoom: () => void
  /** One of the voices, by name, rather than a method per voice. */
  sound: (name: SoundName) => void
  /**
   * Put a line of text on screen, centred on (x, y), until the next frame.
   * The scene keeps one Text object per id and hides any it is not asked
   * for, which is how an entity shows words without owning a game object.
   */
  label: (
    id: string,
    x: number,
    y: number,
    text: string,
    size: number,
    alpha: number,
  ) => void
  /**
   * A continuous sound at `level` (0 to 1) until the next frame. Like a
   * label, anything that stops asking is faded out by the scene.
   */
  hum: (id: string, level: number) => void
}

/**
 * What an entity can perceive about the player. A pressure plate needs only
 * the box; a tutorial tag needs to know what they just did.
 */
export type PlayerSense = {
  box: Box
  grounded: boolean
  /** |vx|, so "are they running" is one comparison. */
  speed: number
  jumped: boolean
  dashed: boolean
  /** The moment of folding, for a tag whose lesson is "press down". */
  folded: boolean
  /** Folded flat right now, which is what hiding under a pillar looks like. */
  flat: boolean
  /** The R edge: toggle the sword. */
  sword: boolean
  /** The J or left-click edge: slash. */
  slash: boolean
  /** Where the player just failed, if they did this frame. */
  failedAt: number | null
}

/** The button edges the level feeds in, since they come from Input. */
export type Buttons = { sword: boolean; slash: boolean }

/** What an entity can see each frame. One object, reused by Level. */
export type EntityWorld = {
  player: PlayerSense
  /** Is the blade drawn? A seal's prompt depends on it. */
  swordOut: boolean
  fx: Fx
  /**
   * The world's collision list. Only something that moves needs it — the bat
   * is the first entity that does, and it is how a dive knows it has hit the
   * floor.
   */
  solids: readonly Solid[]
  /**
   * Is anything moving the air in `box`? The same question the player asks
   * the level, asked by an entity about itself, so a bat's dive bends in a
   * fan column without the fan and the bat knowing about each other.
   */
  liftAt: (box: Box) => Updraft | null
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
   *
   * `mode` is the direction: a switch in fold mode folds its targets back.
   * It defaults to unfold, so every older call site is unchanged.
   */
  trigger(_delay: number, _mode: FoldMode = 'unfold'): void {}

  /**
   * Has this thing been used yet? The read-side twin of trigger(): it lets a
   * tutorial tag know its lesson has landed without knowing what taught it.
   */
  done(): boolean {
    return false
  }

  /**
   * The box the sword can cut, or null for anything it cannot. This and
   * hurt() are the whole Hittable contract: seals and enemies implement
   * them and the sword never learns what it is cutting.
   */
  hurtBox(): Box | null {
    return null
  }

  /**
   * Take one hit, coming from `dir` (-1 or 1). Returns true if it survived,
   * which is what earns knockback; something that died takes none.
   */
  hurt(_dir: number): boolean {
    return false
  }

  /** Shoved sideways at `vx` px/s, for something that survived a hit. */
  knock(_vx: number): void {}

  /** Is the blade drawn? Only the sword pieces answer this. */
  swordOut(): boolean {
    return false
  }

  /**
   * Is this thing moving the air where `box` is? The player asks the level
   * for this each frame, so a draught never has to reach into the player.
   */
  draughtAt(_box: Box): Updraft | null {
    return null
  }

  /**
   * Is this thing hurting the player, who is at `box`? Returns the centre x
   * of whatever is doing it, which is all the knockback needs to know, or
   * null for everything harmless.
   *
   * The twin of draughtAt, and the same rule: the player asks the level, and
   * nothing ever reaches into the player.
   */
  dangerAt(_box: Box): number | null {
    return null
  }

  /** Current state as plain data, for debugging and for the F1 overlay. */
  serialize(): EntitySnapshot {
    return { id: this.id, type: this.type, x: this.tx, h: this.th }
  }
}
