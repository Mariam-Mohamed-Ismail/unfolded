import type { Solid } from '../Player.ts'
import { SLIT_H, TILE } from '../constants.ts'

/** Tiles to pixels. The lane is laid out on the 32px grid. */
const t = (n: number) => n * TILE

export type Level = {
  /** Where the player's feet start, and where a fall puts them back. */
  spawn: { x: number; y: number }
  solids: Solid[]
}

// Ground sits on two levels: row 15 to start, row 14 after the step.
const LOW = 15
const HIGH = 14

/**
 * The movement lane. Thirty tiles wide, so the whole thing is on screen
 * without a camera: run, a 2-tile block, a step up, a 6-tile gap that needs
 * the dash, then a pillar you can only pass folded.
 */
export const level1: Level = {
  spawn: { x: t(2), y: t(LOW) },
  solids: [
    // Starting ground.
    { x: t(0), y: t(LOW), w: t(9), h: t(2) },
    // A 2-tile block to clear. 64px, against a jump apex of 82px.
    { x: t(4), y: t(13), w: t(2), h: t(2) },
    // The step up, and the runway to the gap.
    { x: t(9), y: t(HIGH), w: t(6), h: t(3) },
    // --- the 6-tile gap runs from x=15 to x=21 ---
    // Landing, and the ground the pillar stands on.
    { x: t(21), y: t(HIGH), w: t(9), h: t(3) },
    // The pillar, hanging to within SLIT_H of the ground.
    { x: t(26), y: t(9), w: t(1), h: t(5) - SLIT_H },
  ],
}

/** The gap the dash exists for, in pixels. */
export const GAP_WIDTH = t(21) - t(15)
