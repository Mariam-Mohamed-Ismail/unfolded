import { formatTime } from './ui/format.ts'

export type RoomRecord = {
  /** Seconds, or null if no attempt has been banked yet. */
  bestTime: number | null
  fewestResets: number | null
  /** How many visits have been banked, best or not. */
  attempts: number
}

/**
 * What the player has managed in each room, for this session only.
 *
 * Best time and fewest resets are two independent minima rather than one
 * "best attempt", because they are: the fastest run through a room and the
 * cleanest run through it need not be the same run.
 *
 * Nothing is written to storage, so a reload starts over.
 */
export class Records {
  private rooms = new Map<string, RoomRecord>()

  /** Bank one finished visit to a room. */
  submit(roomId: string, time: number, resets: number): void {
    const rec = this.rooms.get(roomId) ?? {
      bestTime: null,
      fewestResets: null,
      attempts: 0,
    }
    rec.attempts++
    if (rec.bestTime === null || time < rec.bestTime) rec.bestTime = time
    if (rec.fewestResets === null || resets < rec.fewestResets) {
      rec.fewestResets = resets
    }
    this.rooms.set(roomId, rec)
  }

  get(roomId: string): RoomRecord | undefined {
    return this.rooms.get(roomId)
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
 */
export function roomLabel(name: string, rec?: RoomRecord): string {
  if (!rec || rec.bestTime === null) return name
  return `${name}  ${formatTime(rec.bestTime)} · ${rec.fewestResets ?? 0}r`
}
