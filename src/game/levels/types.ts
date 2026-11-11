/**
 * The shape of a level file. Plain data: positions are in tiles, and `h` is
 * the height of a surface above the main floor row, so negative is below it.
 * Nothing here knows about pixels, Phaser, or any particular entity class.
 */

export type SolidSpec = {
  /** Left edge, in tiles. */
  x: number
  /** Width, in tiles. */
  w: number
  /** Top surface, in tiles above the floor row. Negative is below. */
  h: number
}

/**
 * One entity in the level. `type` picks the class that gets built (see
 * EntityRegistry); the optional fields are the ones the spec's own entity
 * list uses, and each component reads only the ones it cares about.
 *
 * These are named optional fields rather than an open index signature on
 * purpose: tsc then catches a typo in level data, which is most of the point
 * of keeping the level as data. The cost is one line here when a new
 * component needs a field nothing else uses.
 */
export type EntitySpec = {
  id: string
  type: string
  /** Left edge, in tiles. */
  x: number
  /** Height above the floor row, in tiles. */
  h?: number
  /** Width, in tiles. */
  w?: number
  /** Top surface of a platform, in tiles above the floor row. */
  topH?: number
  /** Ids of the entities this one drives, e.g. a switch and its steps. */
  targets?: string[]
  startsFolded?: boolean
  /** A prompt's words. Four or fewer, per the tutorial rules. */
  text?: string
  /** The key caps a prompt draws, e.g. ['A', 'D']. */
  keys?: string[]
  /** What dismisses a prompt: run, jump, jumpHigh, dash, fold, sword, target. */
  action?: string
  /** Id of something that must be done before a prompt may show at all. */
  after?: string
  /** Floor height for something standing in a pit. */
  floorH?: number
  /** Height of a draught column, in tiles. */
  columnH?: number
  /** Clearance under a slit, in pixels. */
  clearancePx?: number
}

/**
 * A stretch of the level that resets as a unit. `checkpoint` is the id of a
 * Checkpoint entity, which is where Backspace sends the player.
 */
export type RoomSpec = {
  id: string
  /** Shown in the HUD, e.g. "1A · Fold". */
  name: string
  /** Left edge, in tiles. */
  from: number
  /** Right edge, in tiles, exclusive. */
  to: number
  /** Id of this room's Checkpoint entity. */
  checkpoint: string
}

/**
 * A level's colours. The spec keeps the colour language across levels but
 * shifts the background and the purple, so this belongs to the level rather
 * than being one set of module constants.
 */
export type Palette = {
  bg: number
  /** Folds and switches. */
  fold: number
  wind: number
  /** Seals, slits and pickups. */
  form: number
}

export type LevelData = {
  /** Shown as the heading in Room select. */
  name: string
  width: number
  height: number
  floorRow: number
  palette: Palette
  spawn: { x: number; h: number }
  solids: SolidSpec[]
  entities: EntitySpec[]
  rooms: RoomSpec[]
}
