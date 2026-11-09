/**
 * Level data, in the shape the spec asks for. Plain data: positions are in
 * tiles, and `h` is the height of a surface above the main floor row, so
 * negative is below it. Nothing here knows about pixels or Phaser.
 */

export type SolidSpec = {
  /** Left edge, in tiles. */
  x: number
  /** Width, in tiles. */
  w: number
  /** Top surface, in tiles above the floor row. Negative is below. */
  h: number
}

export type EntitySpec = {
  id: string
  type: 'Checkpoint'
  x: number
  h: number
}

export type LevelData = {
  width: number
  height: number
  floorRow: number
  spawn: { x: number; h: number }
  solids: SolidSpec[]
  entities: EntitySpec[]
}

/**
 * Level 1, "Blank Sheet". Only the movement lane (x 0 to 24) is built so
 * far; rooms 1A, 1B and 1C come later.
 */
export const level1: LevelData = {
  width: 92,
  height: 18,
  floorRow: 14,

  spawn: { x: 3, h: 0 },

  solids: [
    // Floor, up to the lip of the gap.
    { x: 0, w: 18, h: 0 },
    // The 1-tile step: teaches jump where failing costs nothing.
    { x: 8, w: 2, h: 1 },
    // The 2-tile block: the same idea, one notch harder.
    { x: 13, w: 2, h: 2 },
    // The pit under the 6-tile gap. Two tiles down and safe, so a missed
    // dash is a climb back rather than a death.
    { x: 18, w: 6, h: -2 },
    // Floor resumes past the gap. This also carries into room 1A.
    { x: 24, w: 22, h: 0 },
  ],

  entities: [
    { id: 'cp0', type: 'Checkpoint', x: 3, h: 0 },
    { id: 'cp1', type: 'Checkpoint', x: 25, h: 0 },
  ],
}

/** The gap the dash exists for, in tiles. */
export const GAP_FROM = 18
export const GAP_TO = 24
