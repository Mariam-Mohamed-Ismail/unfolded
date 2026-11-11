import { level1 } from './level1.ts'
import { level2 } from './level2.ts'
import type { LevelData } from './types.ts'

/**
 * Every level the game knows about, in order.
 *
 * The room select reads this rather than naming level 1, so adding a level
 * here makes its rooms appear in the menu with no menu change.
 */
export const LEVELS: LevelData[] = [level1, level2]

/** The level a fresh Play starts in. */
export const FIRST_LEVEL = LEVELS[0]

export type RoomChoice = {
  /** Index into LEVELS. */
  level: number
  /** RoomSpec id, which is what Game is started with. */
  room: string
  /** What the button says. */
  name: string
}

/** Every room in every level, flattened. */
export function roomChoices(): RoomChoice[] {
  const out: RoomChoice[] = []
  for (let i = 0; i < LEVELS.length; i++) {
    for (const room of LEVELS[i].rooms) {
      out.push({ level: i, room: room.id, name: room.name })
    }
  }
  return out
}

export type RoomGroup = { name: string; choices: RoomChoice[] }

/**
 * The same rooms, grouped by level, which is how Room select shows them.
 * Built from LEVELS, so a new level appears under its own heading without
 * either menu changing.
 */
export function roomGroups(): RoomGroup[] {
  return LEVELS.map((level, i) => ({
    name: level.name,
    choices: level.rooms.map((room) => ({
      level: i,
      room: room.id,
      name: room.name,
    })),
  }))
}
