import type { LevelData } from './types.ts'

/**
 * Level 1, "Blank Sheet". Only the movement lane (x 0 to 24) and the floor
 * of room 1A are built so far; the puzzle rooms come later.
 *
 * Positions are in tiles, and `h` is the height of a surface above the main
 * floor row, so negative is below it. The schema lives in ./types.ts.
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
    // Room 1A's ledge: 3 tiles up, which is 96px against an 82px jump, so
    // the only way onto it is the stairs the switch unfolds.
    { x: 37, w: 9, h: 3 },
  ],

  entities: [
    { id: 'cp0', type: 'Checkpoint', x: 3, h: 0 },
    { id: 'cp1', type: 'Checkpoint', x: 25, h: 0 },

    // Room 1A: step on the plate, the stairs unfold.
    { id: 'sw1', type: 'Switch', x: 27, h: 0, targets: ['s1', 's2'] },
    { id: 's1', type: 'FoldPlatform', x: 31, w: 2, topH: 1, startsFolded: true },
    { id: 's2', type: 'FoldPlatform', x: 34, w: 2, topH: 2, startsFolded: true },
  ],

  // Rooms 1B (x 46 to 68) and 1C (x 68 to 92) join this list when their
  // geometry and checkpoints exist; there is nothing to stand on out there
  // yet, so a room spec for them would describe empty space.
  rooms: [
    { id: 'lane', name: 'Movement lane', from: 0, to: 24, checkpoint: 'cp0' },
    { id: '1a', name: '1A · Fold', from: 24, to: 46, checkpoint: 'cp1' },
  ],
}

/** The gap the dash exists for, in tiles. */
export const GAP_FROM = 18
export const GAP_TO = 24
