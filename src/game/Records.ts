import { ROOM_PAR_S } from './constants.ts'
import { formatTime } from './ui/format.ts'

export type RoomRecord = {
  /** Seconds, or null if no attempt has been banked yet. */
  bestTime: number | null
  fewestResets: number | null
  /** How many visits have been banked, best or not. */
  attempts: number
  /**
   * Has any one visit been finished with no hits and no resets? The third
   * star. Kept as a flag rather than derived from the two minima above,
   * which could each come from a different run: fewest resets 0 and fewest
   * hits 0 do not add up to one clean run.
   */
  clean: boolean
}

/**
 * What the player has managed in each room, for this session only.
 *
 * Best time and fewest resets are two independent minima rather than one
 * "best attempt", because they are: the fastest run through a room and the
 * cleanest run through it need not be the same run. The stars follow the
 * same rule - each is earned by some visit, not all by one.
 *
 * Everything in here is a *finished* visit. Deciding that is the caller's
 * job: GameScene banks a room when the player leaves by its exit, so
 * walking in and straight back out is not a record and does not earn a
 * star.
 *
 * Nothing is written to storage, so a reload starts over.
 */
export class Records {
  private rooms = new Map<string, RoomRecord>()

  /** Bank one finished visit to a room. */
  submit(roomId: string, time: number, resets: number, hits = 0): void {
    const rec = this.rooms.get(roomId) ?? {
      bestTime: null,
      fewestResets: null,
      attempts: 0,
      clean: false,
    }
    rec.attempts++
    if (rec.bestTime === null || time < rec.bestTime) rec.bestTime = time
    if (rec.fewestResets === null || resets < rec.fewestResets) {
      rec.fewestResets = resets
    }
    if (resets === 0 && hits === 0) rec.clean = true
    this.rooms.set(roomId, rec)
  }

  get(roomId: string): RoomRecord | undefined {
    return this.rooms.get(roomId)
  }

  /**
   * The spec's three stars, as a count:
   *
   *   1. finish the room
   *   2. finish under its par time
   *   3. finish with no hits taken and no resets
   *
   * A room with no par in the table - the movement lane - can earn the
   * other two and tops out at two.
   */
  stars(roomId: string): number {
    const rec = this.rooms.get(roomId)
    if (!rec || rec.attempts === 0) return 0
    let n = 1
    const par = ROOM_PAR_S[roomId]
    if (par !== undefined && rec.bestTime !== null && rec.bestTime < par) n++
    if (rec.clean) n++
    return n
  }

  /** How many stars this room can ever show. Two without a par time. */
  starsPossible(roomId: string): number {
    return ROOM_PAR_S[roomId] === undefined ? 2 : 3
  }

  /** Every room with a record, for the overlay and for tests. */
  ids(): string[] {
    return [...this.rooms.keys()]
  }

  clear(): void {
    this.rooms.clear()
  }
}

/**
 * How a room reads in the Room select list. One function because there are
 * two room-select pages — the main menu's and the pause overlay's — and two
 * copies would drift.
 *
 * The stars are not in here: they are drawn, not written. See ui/star.ts.
 */
export function roomLabel(name: string, rec?: RoomRecord): string {
  if (!rec || rec.bestTime === null) return name
  return `${name}  ${formatTime(rec.bestTime)} · ${rec.fewestResets ?? 0}r`
}
