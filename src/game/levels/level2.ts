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

  spawn: { x: 2, h: 0 },

  // One floor per room, so each is the single line that gets cut up when
  // that room's geometry arrives. 2C's floor becomes floor, pit and high
  // platform; the rest of 2A and 2B keep theirs.
  solids: [
    { x: 0, w: 30, h: 0 },
    { x: 30, w: 32, h: 0 },
    { x: 62, w: 34, h: 0 },
  ],

  entities: [
    { id: 'cp2a', type: 'Checkpoint', x: 1, h: 0 },
    { id: 'cp2b', type: 'Checkpoint', x: 31, h: 0 },
    { id: 'cp2c', type: 'Checkpoint', x: 63, h: 0 },
  ],

  rooms: [
    { id: '2a', name: '2A · Fold', from: 0, to: 30, checkpoint: 'cp2a' },
    { id: '2b', name: '2B · Seal', from: 30, to: 62, checkpoint: 'cp2b' },
    { id: '2c', name: '2C · Wind', from: 62, to: 96, checkpoint: 'cp2c' },
  ],
}
