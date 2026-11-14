import type * as Phaser from 'phaser'
import type { Entity } from '../entities/Entity.ts'
import {
  COLOR_FORM,
  THREAD_PX,
  THREAD_SNAP_MS,
  THREAD_SNAP_PX,
} from '../constants.ts'

const SNAP = THREAD_SNAP_MS / 1000

/**
 * The teal thread from a seal to whatever it is holding closed.
 *
 * Shared because two things are held that way — the fold bridge over 3B's
 * gap and the fold sheet over 3C's fan — and the released-once latch is
 * exactly the sort of small rule that drifts when it is copied. Same reason
 * ui/tag.ts exists.
 *
 * The held thing owns one of these, because `heldBy` points from the held
 * object to its seal: the thing being held is the one that knows.
 */
export class Thread {
  /** Latched the frame its seal first reports itself done. */
  private released = false
  /** Counts up through the snap, then stops. -1 before it is cut. */
  private snapT = -1

  /**
   * Call once a frame with the seal, if there is one. Returns true on the
   * single frame the thread snaps, which is when the caller should open
   * itself and make a noise.
   */
  tick(holder: Entity | null, dt: number): boolean {
    if (this.snapT >= 0 && this.snapT < SNAP) {
      this.snapT = Math.min(SNAP, this.snapT + dt)
    }
    if (this.released || holder === null || !holder.done()) return false
    this.released = true
    this.snapT = 0
    return true
  }

  /** Still whole: there is a seal and it has not been cut. */
  held(holder: Entity | null): boolean {
    return holder !== null && !this.released
  }

  reset(): void {
    this.released = false
    this.snapT = -1
  }

  /**
   * One line while held; two recoiling halves while it snaps; nothing after.
   * `from` is the held object's anchor, `to` the seal's.
   */
  draw(
    g: Phaser.GameObjects.Graphics,
    holder: Entity | null,
    from: [number, number],
    to: [number, number],
  ): void {
    if (holder === null) return

    if (this.held(holder)) {
      g.lineStyle(THREAD_PX, COLOR_FORM, 0.9)
      g.lineBetween(from[0], from[1], to[0], to[1])
      return
    }

    if (this.snapT < 0 || this.snapT >= SNAP) return
    const e = this.snapT / SNAP
    const mx = (from[0] + to[0]) / 2
    const my = (from[1] + to[1]) / 2
    const pull = THREAD_SNAP_PX * e
    g.lineStyle(THREAD_PX, COLOR_FORM, 1 - e)
    g.lineBetween(from[0], from[1], mx - pull, my - pull / 2)
    g.lineBetween(to[0], to[1], mx + pull, my + pull / 2)
  }
}
