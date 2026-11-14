import {
  COLOR_FORM,
  COLOR_L2_BG,
  COLOR_L2_FOLD,
  COLOR_WIND,
} from '../constants.ts'
import type { LevelData } from './types.ts'

/**
 * Level 2, "Creased". The skeleton: three rooms with a floor and a
 * checkpoint each, built by the same loader as Level 1.
 *
 * What each room will hold, from the spec:
 *   2A  two linked switches, folded stairs, a high ledge and a fold wall
 *   2B  a slit pillar, a bat arena and a seal across the exit
 *   2C  a pit with two fans on timers, a bat, and a high platform
 */
export const level2: LevelData = {
  name: 'Level 2',
  width: 96,
  height: 18,
  floorRow: 14,

  // The spec's cooler palette. Amber and teal are the same as Level 1's;
  // the background and the purple are not.
  palette: {
    bg: COLOR_L2_BG,
    fold: COLOR_L2_FOLD,
    wind: COLOR_WIND,
    form: COLOR_FORM,
  },

  // Level 2 is where danger starts, so this is the level that shows health.
  hazards: true,

  spawn: { x: 2, h: 0 },

  // One floor per room, so each is the single line that gets cut up when
  // that room's geometry arrives. 2C's floor becomes floor, pit and high
  // platform; the rest of 2A and 2B keep theirs.
  solids: [
    { x: 0, w: 30, h: 0 },
    { x: 30, w: 32, h: 0 },
    // Room 2C: a short approach, then the fan pit, then the platform.
    { x: 62, w: 4, h: 0 },
    // The pit, 18 tiles wide and 2 down. Safe: you can jump out on the
    // left, and the platform's wall on the right is 192px, so the fans are
    // the only way forward.
    { x: 66, w: 18, h: -2 },
    { x: 84, w: 12, h: 4 },
    // 2A's high ledge, tiles 15 to 19. 96px up against an 82.5px jump, so
    // the folded stairs are the only way onto it.
    //
    // A slab rather than a column: with the floor open underneath, falling
    // off a step after pressing S2 leaves you able to walk on to the wall.
    // As a column it penned you between the stairs and the ledge with the
    // stairs folded away - a dead pocket only Backspace could undo.
    { x: 15, w: 5, h: 3, bottomH: 2 },
    // The block above 2B's seal, so the seal cannot be jumped over. A slab
    // rather than a column, so it hangs over the passage.
    { x: 50, w: 1, h: 10, bottomH: 8 },
    // The bat's ceiling strip over 2B's arena, tiles 44 to 47. A thin slab:
    // it is something to hang from, not something to stand on.
    { x: 44, w: 3, h: 8, bottomH: 7.75 },
  ],

  entities: [
    { id: 'cp2a', type: 'Checkpoint', x: 1, h: 0 },
    { id: 'cp2b', type: 'Checkpoint', x: 31, h: 0 },
    { id: 'cp2c', type: 'Checkpoint', x: 63, h: 0 },

    // Room 2A: two switches, in order. S1 unfolds the stairs up to the
    // ledge; S2 up there tips the wall flat and folds the stairs back,
    // which is the lesson - the second action removes the way you came up.
    { id: 'sw1', type: 'Switch', x: 4, h: 0, targets: ['stair1', 'stair2'] },
    // TEMPORARY, for testing the sword. Delete this one line to remove it.
    { id: 'dummy1', type: 'Dummy', x: 6, h: 0 },
    { id: 'stair1', type: 'FoldPlatform', x: 9, w: 2, topH: 1, startsFolded: true },
    { id: 'stair2', type: 'FoldPlatform', x: 12, w: 2, topH: 2, startsFolded: true },
    { id: 'sw2', type: 'Switch', x: 17, h: 3, mode: 'fold',
      targets: ['foldwall1', 'stair1', 'stair2'] },
    { id: 'foldwall1', type: 'FoldWall', x: 24, w: 1, h: 9 },
    // TEMPORARY, until the sword carries over from Level 1: without it the
    // seal in 2B can never be cut. Delete this one line to remove it.
    { id: 'l2sword', type: 'Pickup', x: 3, h: 1 },
    // A warning rather than a control, so no key cap. It clears once S2
    // has been pressed and the player has seen what it does.
    { id: 'tipFoldBack', type: 'PromptTag', x: 15, w: 5, h: 3,
      text: 'this folds things back', action: 'target', targets: ['sw2'] },

    // Room 2B: squeeze through, then cut your way out.
    //
    // The arena from x 42 to 50 is where the bat lives: it hangs from the
    // ceiling strip at x 44-47, on the spec's anchor at x 45.5, h 7.5.
    //
    // 2C's bat is deliberately not placed yet. 2C's only route onto the
    // platform clears its edge by 50px, and a diving enemy in that pit
    // would invalidate that proof - it belongs with the room, not here.
    { id: 'slit2b', type: 'Slit', x: 36, w: 6, topH: 7, clearancePx: 14 },
    { id: 'bat1', type: 'Bat', x: 45, w: 1, h: 7.5 },
    { id: 'seal1', type: 'Seal', x: 50, floorH: 0, topH: 8 },
    // These two share a zone on purpose: the second is gated on the first,
    // so only one is ever up.
    { id: 'tipDraw', type: 'PromptTag', x: 32, w: 4, h: 0,
      keys: ['R'], text: 'draw the sword', action: 'sword' },
    { id: 'tipSlash', type: 'PromptTag', x: 32, w: 4, h: 0,
      keys: ['J'], text: 'click or J to slash', action: 'slash',
      after: 'tipDraw' },

    // Room 2C: two fans taking turns across an 18-tile pit.
    //
    // A is on from 0s for 3.4s, B from 3s for 3.4s, both on a 6s period, so
    // they overlap for 0.4s twice a period - that overlap is the crossing
    // window. The bat hangs from a ceiling strip at x 73-77, anchor h 8, in
    // the middle of the pit; nothing is placed there yet.
    { id: 'fanA', type: 'Fan', x: 71, w: 2, floorH: -2, columnH: 8,
      onStart: 0, onDuration: 3.4, period: 6 },
    { id: 'fanB', type: 'Fan', x: 78, w: 2, floorH: -2, columnH: 8,
      onStart: 3, onDuration: 3.4, period: 6 },
    { id: 'exit2', type: 'ExitDoor', x: 94, h: 4 },
    { id: 'tipFans', type: 'PromptTag', x: 63, w: 4, h: 0,
      text: 'fans take turns', action: 'target', targets: ['fanA'] },
  ],

  rooms: [
    { id: '2a', name: '2A · Fold', from: 0, to: 30, checkpoint: 'cp2a' },
    { id: '2b', name: '2B · Seal', from: 30, to: 62, checkpoint: 'cp2b' },
    { id: '2c', name: '2C · Wind', from: 62, to: 96, checkpoint: 'cp2c' },
  ],
}
