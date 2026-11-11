import { COLOR_BG, COLOR_FOLD, COLOR_FORM, COLOR_WIND } from '../constants.ts'
import type { LevelData } from './types.ts'

/**
 * Level 1, "Blank Sheet". Only the movement lane (x 0 to 24) and the floor
 * of room 1A are built so far; the puzzle rooms come later.
 *
 * Positions are in tiles, and `h` is the height of a surface above the main
 * floor row, so negative is below it. The schema lives in ./types.ts.
 */
export const level1: LevelData = {
  name: 'Level 1',
  width: 92,
  height: 18,
  floorRow: 14,

  // Exactly the colours this level has always used, now named rather than
  // assumed, so Level 2 can differ without changing anything here.
  palette: {
    bg: COLOR_BG,
    fold: COLOR_FOLD,
    wind: COLOR_WIND,
    form: COLOR_FORM,
  },

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
    // Room 1B's floor. The ledge above drops 3 tiles onto it, which is safe.
    { x: 46, w: 22, h: 0 },
    // Room 1C: a short run of floor, then the fan pit.
    { x: 68, w: 4, h: 0 },
    // The pit, 2 tiles down and safe: you can jump out on the left.
    { x: 72, w: 10, h: -2 },
    // The high platform, 4 tiles up. 128px from the floor and 192px from
    // the pit floor, so the draught is the only way onto it.
    { x: 82, w: 10, h: 4 },
  ],

  entities: [
    { id: 'cp0', type: 'Checkpoint', x: 3, h: 0 },
    { id: 'cp1', type: 'Checkpoint', x: 25, h: 0 },
    { id: 'cp2', type: 'Checkpoint', x: 47, h: 0 },
    { id: 'cp3', type: 'Checkpoint', x: 69, h: 0 },

    // Room 1A: step on the plate, the stairs unfold.
    { id: 'sw1', type: 'Switch', x: 27, h: 0, targets: ['s1', 's2'] },
    { id: 's1', type: 'FoldPlatform', x: 31, w: 2, topH: 1, startsFolded: true },
    { id: 's2', type: 'FoldPlatform', x: 34, w: 2, topH: 2, startsFolded: true },

    // Room 1B: a 14px gap under a 7-tile pillar. Too tall to jump, too low
    // to walk through, so flat form is the only way past.
    { id: 'slit1', type: 'Slit', x: 54, w: 6, topH: 7, clearancePx: 14 },
    // The spec's optional second helping. Shorter in both senses, but 4
    // tiles is still well over the 82px jump.
    { id: 'slit2', type: 'Slit', x: 63, w: 2, topH: 4, clearancePx: 14 },

    // Room 1C: a fan on the pit floor, with 8 tiles of draught above it.
    // No collision of its own: you walk onto the grille and get carried.
    { id: 'f1', type: 'Fan', x: 77, w: 2, floorH: -2, columnH: 8 },

    // The payoff, on the high platform the draught is the only way onto.
    // h 5.5 puts the pieces 48px above it, so walking under them is enough.
    { id: 'swordPieces', type: 'Pickup', x: 88, h: 5.5 },
    { id: 'exit', type: 'ExitDoor', x: 91, h: 4 },
    // Gated on the pickup, so "press R" cannot appear before you are
    // carrying anything.
    { id: 'tipSword', type: 'PromptTag', x: 85, w: 7, h: 4,
      keys: ['R'], text: 'press R', action: 'sword', after: 'swordPieces' },

    // Tutorial tags. `x` and `w` are the trigger zone in tiles and the tag
    // draws at its centre, so the zones are laid out not to overlap: one
    // new idea per space, and never two tags on screen at once.
    { id: 'tipRun', type: 'PromptTag', x: 0, w: 6, h: 0,
      keys: ['A', 'D'], text: 'run', action: 'run' },
    { id: 'tipJump', type: 'PromptTag', x: 6, w: 4, h: 0,
      keys: ['Space'], text: 'jump', action: 'jump' },
    { id: 'tipHigher', type: 'PromptTag', x: 10, w: 4, h: 0,
      keys: ['Space'], text: 'hold for higher', action: 'jumpHigh' },
    // Wide on purpose: it spans the lip and the gap, so it is still up
    // while you are in the air over it.
    { id: 'tipDash', type: 'PromptTag', x: 14, w: 8, h: 0,
      keys: ['Shift'], text: 'dash in the air', action: 'dash' },
    // No key cap on this one: it is a thing you stand on.
    { id: 'tipSwitch', type: 'PromptTag', x: 25, w: 4, h: 0,
      text: 'step on it', action: 'target', targets: ['sw1'] },
    // Waiting for room 1B. Nothing updates it until 1B has a RoomSpec.
    { id: 'tipFlat', type: 'PromptTag', x: 49, w: 4, h: 0,
      keys: ['S'], text: 'hold to fold flat', action: 'fold' },
  ],

  rooms: [
    { id: 'lane', name: 'Movement lane', from: 0, to: 24, checkpoint: 'cp0' },
    { id: '1a', name: '1A · Fold', from: 24, to: 46, checkpoint: 'cp1' },
    { id: '1b', name: '1B · Flat', from: 46, to: 68, checkpoint: 'cp2' },
    { id: '1c', name: '1C · Wind', from: 68, to: 92, checkpoint: 'cp3' },
  ],
}

/** The gap the dash exists for, in tiles. */
export const GAP_FROM = 18
export const GAP_TO = 24
